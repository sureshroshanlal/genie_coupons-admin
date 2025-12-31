// src/dbhelper/ImportsRepo.js
import { supabase } from "./dbclient.js";

// Helpers
const toSlug = (s) =>
  String(s || "")
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// ---------- Merchants ----------

export async function getMerchantIdBySlug(slug) {
  const s = toSlug(slug);
  if (!s) return null;
  const { data, error } = await supabase
    .from("merchants")
    .select("id")
    .eq("slug", s)
    .maybeSingle();
  if (error) throw error;
  return data?.id || null;
}

export async function upsertMerchantBasic(row) {
  const payload = {
    name: row.name,
    slug: toSlug(row.slug || row.name),
    h1keyword: row.h1keyword || "",
    web_url: row.web_url || "",
    aff_url: row.aff_url || "",
    meta_title: row.seo_title || "",
    meta_description: row.seo_desc || "",
  };

  if (!payload.slug || !payload.name) {
    throw new Error("Missing required merchant fields (name/slug).");
  }

  // Check existing by slug
  const { data: existing, error: ge } = await supabase
    .from("merchants")
    .select("id")
    .eq("slug", payload.slug)
    .maybeSingle();
  if (ge) throw ge;

  if (existing?.id) {
    const { data, error } = await supabase
      .from("merchants")
      .update(payload)
      .eq("id", existing.id)
      .select("id")
      .single();
    if (error) throw error;
    return { action: "update", id: data.id };
  } else {
    const { data, error } = await supabase
      .from("merchants")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw error;
    return { action: "insert", id: data.id };
  }
}

export async function updateMerchantFirstParagraphBySlug(slug, html) {
  const s = toSlug(slug);
  const { data, error } = await supabase
    .from("merchants")
    .update({ side_description_html: html || "" })
    .eq("slug", s)
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id, updated: 1 };
}

export async function updateMerchantSeoDescBySlug(slug, desc) {
  const s = toSlug(slug);
  const { data, error } = await supabase
    .from("merchants")
    .update({ meta_description: desc || "" })
    .eq("slug", s)
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id, updated: 1 };
}

export async function updateMerchantSlug(oldSlug, newSlugSeed) {
  const sOld = toSlug(oldSlug);
  const sNew = toSlug(newSlugSeed);
  if (!sOld || !sNew) throw new Error("Invalid old_slug or new_slug.");

  // Find target merchant
  const { data: cur, error: ge } = await supabase
    .from("merchants")
    .select("id")
    .eq("slug", sOld)
    .maybeSingle();
  if (ge) throw ge;
  if (!cur?.id) throw new Error(`Merchant not found for slug '${sOld}'`);

  // Ensure new slug uniqueness (simple suffixing)
  let candidate = sNew;
  for (let i = 0; i < 100; i++) {
    const { data: taken, error: ce } = await supabase
      .from("merchants")
      .select("id")
      .eq("slug", candidate)
      .neq("id", cur.id)
      .limit(1);
    if (ce) throw ce;
    if (!taken || taken.length === 0) break;
    candidate = `${sNew}-${i + 1}`;
  }

  const { data, error } = await supabase
    .from("merchants")
    .update({ slug: candidate })
    .eq("id", cur.id)
    .select("id, slug")
    .single();
  if (error) throw error;
  return { id: data.id, slug: data.slug };
}

// ---------- Tags & Relations ----------

export async function getTagIdBySlug(slug) {
  const s = toSlug(slug);
  if (!s) return null;
  const { data, error } = await supabase
    .from("tags")
    .select("id")
    .eq("slug", s)
    .maybeSingle();
  if (error) throw error;
  return data?.id || null;
}

export async function ensureStoreTagRelation(merchantId, tagId) {
  if (!merchantId || !tagId) throw new Error("merchantId and tagId required");

  const { data: existing, error: ge } = await supabase
    .from("tag_stores")
    .select("merchant_id, tag_id")
    .eq("merchant_id", merchantId)
    .eq("tag_id", tagId)
    .maybeSingle();
  if (ge) throw ge;

  if (existing) return { created: 0 };

  const { error } = await supabase
    .from("tag_stores")
    .insert({ merchant_id: merchantId, tag_id: tagId });
  if (error) throw error;

  return { created: 1 };
}

// ---------- Coupons / Deals ----------

/**
 * Natural key upsert to avoid duplicates:
 * (merchant_id, coupon_type, title, coalesce(coupon_code,''))
 * Fields supported from Step 3: descp -> description, type_text, is_editor
 */
export async function upsertCouponDealByNaturalKey(merchantId, payload) {
  if (!merchantId) throw new Error("merchantId required");
  const couponType = String(payload.coupon_type || "").toLowerCase();
  if (couponType !== "coupon" && couponType !== "deal") {
    throw new Error(`Invalid coupon_type '${payload.coupon_type}'`);
  }
  if (!payload.title) throw new Error("title required");

  const normalizedCode =
    couponType === "coupon" ? payload.coupon_code || "" : "";

  // Find existing by natural key
  const { data: existing, error: ge } = await supabase
    .from("coupons")
    .select("id")
    .eq("merchant_id", merchantId)
    .eq("coupon_type", couponType)
    .eq("title", payload.title)
    .eq("coupon_code", normalizedCode)
    .maybeSingle();
  if (ge) throw ge;

  const patch = {
    description: payload.descp || "",
    type_text: payload.type_text || "",
    is_editor: !!payload.is_editor,
  };

  if (existing?.id) {
    const { data, error } = await supabase
      .from("coupons")
      .update(patch)
      .eq("id", existing.id)
      .select("id")
      .single();
    if (error) throw error;
    return { action: "update", id: data.id };
  } else {
    const row = {
      merchant_id: merchantId,
      coupon_type: couponType,
      title: payload.title,
      coupon_code: normalizedCode,
      description: patch.description,
      type_text: patch.type_text,
      is_editor: patch.is_editor,
      is_publish: false, // default for new
    };
    const { data, error } = await supabase
      .from("coupons")
      .insert(row)
      .select("id")
      .single();
    if (error) throw error;
    return { action: "insert", id: data.id };
  }
}
