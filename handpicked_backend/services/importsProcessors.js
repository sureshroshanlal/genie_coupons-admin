// src/services/importsProcessors.js
import * as ImportsRepo from "../dbhelper/ImportsRepo.js";

// Local helpers
const toSlug = (s) =>
  String(s || "")
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/**
 * Step 1: Import Stores (with default content)
 * Input headers: name, slug, h1keyword, web_url, aff_url, parent_slug, seo_title, seo_desc
 */
export async function processStep1Stores(rows, { dryRun }) {
  const errors = [];
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  const seenSlugs = new Set();

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNo = i + 2;

    // Derive and normalize slug
    let slug = r.slug ? toSlug(r.slug) : toSlug(r.name);
    if (!r.name || !slug) {
      errors.push({
        row: rowNo,
        message: "Missing required 'name' or unable to derive 'slug'.",
      });
      continue;
    }
    if (seenSlugs.has(slug)) {
      errors.push({ row: rowNo, message: `Duplicate slug in file: ${slug}` });
      continue;
    }
    seenSlugs.add(slug);

    const payload = {
      name: r.name,
      slug,
      h1keyword: r.h1keyword || "",
      web_url: r.web_url || "",
      aff_url: r.aff_url || "",
      seo_title: r.seo_title || "",
      seo_desc: r.seo_desc || "",
    };

    try {
      if (dryRun) {
        // Count as update-or-insert intention; you may split counts if desired
        updated += 1;
        continue;
      }

      const res = await ImportsRepo.upsertMerchantBasic(payload);
      if (res?.action === "insert") inserted += 1;
      else if (res?.action === "update") updated += 1;
      else skipped += 1;

      // Optional: parent_slug handling if you decide to add parent_id support
      // if (r.parent_slug) { /* resolve and update */ }
    } catch (e) {
      errors.push({ row: rowNo, message: e?.message || String(e) });
    }
  }

  const failed = errors.length;
  return { inserted, updated, skipped, failed, total: rows.length, errors };
}

/**
 * Step 2: Import Tag–Store Relations
 * Input headers: store_slug, tag_slug
 */
export async function processStep2TagStoreRelations(rows, { dryRun }) {
  const errors = [];
  let inserted = 0;
  let skipped = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNo = i + 2;

    const storeSlug = toSlug(r.store_slug);
    const tagSlug = toSlug(r.tag_slug);

    if (!storeSlug || !tagSlug) {
      errors.push({ row: rowNo, message: "Invalid store_slug or tag_slug." });
      continue;
    }

    try {
      if (dryRun) {
        inserted += 1;
        continue;
      }

      const merchantId = await ImportsRepo.getMerchantIdBySlug(storeSlug);
      if (!merchantId) {
        errors.push({
          row: rowNo,
          message: `Merchant not found for slug '${storeSlug}'`,
        });
        continue;
      }

      const tagId = await ImportsRepo.getTagIdBySlug(tagSlug);
      if (!tagId) {
        errors.push({
          row: rowNo,
          message: `Tag not found for slug '${tagSlug}'`,
        });
        continue;
      }

      const { created } = await ImportsRepo.ensureStoreTagRelation(
        merchantId,
        tagId
      );
      if (created) inserted += 1;
      else skipped += 1;
    } catch (e) {
      errors.push({ row: rowNo, message: e?.message || String(e) });
    }
  }

  return {
    inserted,
    updated: 0,
    skipped,
    failed: errors.length,
    total: rows.length,
    errors,
  };
}

/**
 * Step 3: Import Store Coupons/Deals
 * Input headers: slug, coupon_type, coupon_code, title, descp, type_text, is_editor
 */
export async function processStep3CouponsDeals(rows, { dryRun }) {
  const errors = [];
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNo = i + 2;

    const storeSlug = toSlug(r.slug);
    const type = String(r.coupon_type || "").toLowerCase();

    if (!storeSlug) {
      errors.push({ row: rowNo, message: "Missing slug for merchant." });
      continue;
    }
    if (type !== "coupon" && type !== "deal") {
      errors.push({
        row: rowNo,
        message: `Invalid coupon_type '${r.coupon_type}'`,
      });
      continue;
    }
    if (type === "coupon" && !r.coupon_code) {
      errors.push({
        row: rowNo,
        message: "coupon_code required for type=coupon",
      });
      continue;
    }
    if (!r.title) {
      errors.push({ row: rowNo, message: "title is required" });
      continue;
    }

    try {
      if (dryRun) {
        inserted += 1;
        continue;
      }

      const merchantId = await ImportsRepo.getMerchantIdBySlug(storeSlug);
      if (!merchantId) {
        errors.push({
          row: rowNo,
          message: `Merchant not found for slug '${storeSlug}'`,
        });
        continue;
      }

      // Prefer idempotent upsert by natural key to avoid duplicates:
      const res = await ImportsRepo.upsertCouponDealByNaturalKey(merchantId, {
        coupon_type: type,
        coupon_code: r.coupon_code,
        title: r.title,
        descp: r.descp,
        type_text: r.type_text,
        is_editor: r.is_editor,
      });

      if (res?.action === "insert") inserted += 1;
      else if (res?.action === "update") updated += 1;
      else skipped += 1;
    } catch (e) {
      errors.push({ row: rowNo, message: e?.message || String(e) });
    }
  }

  return {
    inserted,
    updated,
    skipped,
    failed: errors.length,
    total: rows.length,
    errors,
  };
}

/**
 * Step 4: Import first paragraph (for Stores)
 * Input headers: slug, first_paragraph
 */
export async function processStep4FirstParagraph(rows, { dryRun }) {
  const errors = [];
  let updated = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNo = i + 2;

    const storeSlug = toSlug(r.slug);
    const html = r.first_paragraph || "";

    if (!storeSlug || !html) {
      errors.push({ row: rowNo, message: "Missing slug or first_paragraph." });
      continue;
    }

    try {
      if (dryRun) {
        updated += 1;
        continue;
      }

      const merchantId = await ImportsRepo.getMerchantIdBySlug(storeSlug);
      if (!merchantId) {
        errors.push({
          row: rowNo,
          message: `Merchant not found for slug '${storeSlug}'`,
        });
        continue;
      }

      await ImportsRepo.updateMerchantFirstParagraphBySlug(storeSlug, html);
      updated += 1;
    } catch (e) {
      errors.push({ row: rowNo, message: e?.message || String(e) });
    }
  }

  return {
    inserted: 0,
    updated,
    skipped: 0,
    failed: errors.length,
    total: rows.length,
    errors,
  };
}

/**
 * Step 5: Import Stores SEO Desc Check
 * Input headers: slug, seo_desc
 */
export async function processStep5SeoDescCheck(rows, { dryRun }) {
  const errors = [];
  let updated = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNo = i + 2;

    const storeSlug = toSlug(r.slug);
    const desc = r.seo_desc || "";

    if (!storeSlug || !desc) {
      errors.push({ row: rowNo, message: "Missing slug or seo_desc." });
      continue;
    }

    // Optional: soft validation for reasonable length
    if (desc.length > 220) {
      errors.push({ row: rowNo, message: "seo_desc too long (>220 chars)" });
      continue;
    }

    try {
      if (dryRun) {
        updated += 1;
        continue;
      }

      const merchantId = await ImportsRepo.getMerchantIdBySlug(storeSlug);
      if (!merchantId) {
        errors.push({
          row: rowNo,
          message: `Merchant not found for slug '${storeSlug}'`,
        });
        continue;
      }

      await ImportsRepo.updateMerchantSeoDescBySlug(storeSlug, desc);
      updated += 1;
    } catch (e) {
      errors.push({ row: rowNo, message: e?.message || String(e) });
    }
  }

  return {
    inserted: 0,
    updated,
    skipped: 0,
    failed: errors.length,
    total: rows.length,
    errors,
    message: "SEO descriptions processed",
  };
}

/**
 * Step 6: Import Stores Slugs for Default Content
 * Input headers: old_slug, new_slug
 */
export async function processStep6SlugsDefault(rows, { dryRun }) {
  const errors = [];
  let updated = 0;
  const seenNew = new Set();

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNo = i + 2;

    const oldSlug = toSlug(r.old_slug);
    const newSlugSeed = toSlug(r.new_slug);

    if (!oldSlug || !newSlugSeed) {
      errors.push({ row: rowNo, message: "Invalid old_slug or new_slug." });
      continue;
    }
    if (seenNew.has(newSlugSeed)) {
      errors.push({
        row: rowNo,
        message: `Duplicate new_slug in file: ${newSlugSeed}`,
      });
      continue;
    }
    seenNew.add(newSlugSeed);

    try {
      if (dryRun) {
        updated += 1;
        continue;
      }

      const res = await ImportsRepo.updateMerchantSlug(oldSlug, newSlugSeed);
      if (res?.id) updated += 1;
      else errors.push({ row: rowNo, message: "Failed to update slug" });
    } catch (e) {
      errors.push({ row: rowNo, message: e?.message || String(e) });
    }
  }

  return {
    inserted: 0,
    updated,
    skipped: 0,
    failed: errors.length,
    total: rows.length,
    errors,
  };
}
