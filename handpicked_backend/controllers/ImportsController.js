// src/controllers/importsController.js
import {
  parseExcelBuffer,
  normalizeBoolean,
  str,
  num,
} from "../utils/importsExcelUtils.js";
import {
  processStep1Stores,
  processStep2TagStoreRelations,
  processStep3CouponsDeals,
  processStep4FirstParagraph,
  processStep5SeoDescCheck,
  processStep6SlugsDefault,
} from "../services/importsProcessors.js";

// Common response helper
function ok(res, data) {
  return res.json({ data, error: null });
}
function bad(res, code, message, details) {
  return res.status(code).json({ data: null, error: { message, details } });
}

function getDryRun(req) {
  const v = req.body?.dry_run ?? req.query?.dry_run;
  return normalizeBoolean(v);
}

async function handleImport(req, res, schema, processor) {
  try {
    if (!req.file?.buffer) {
      return bad(
        res,
        400,
        "File is required",
        "Missing multipart file field 'file'."
      );
    }

    const dryRun = getDryRun(req);

    // Parse sheet1 into rows of plain objects
    const rows = await parseExcelBuffer(req.file.buffer, schema);

    if (!rows.length) {
      return ok(res, {
        inserted: 0,
        updated: 0,
        skipped: 0,
        failed: 0,
        total: 0,
        dry_run: dryRun,
        message: "No rows found.",
      });
    }

    // Execute step-specific processor
    const summary = await processor(rows, { dryRun });

    // Ensure default fields exist in summary
    const out = {
      inserted: summary.inserted || 0,
      updated: summary.updated || 0,
      skipped: summary.skipped || 0,
      failed: summary.failed || 0,
      total: summary.total ?? rows.length,
      errors: summary.errors || [],
      dry_run: !!dryRun,
      message: summary.message,
      job_id: summary.job_id,
    };

    return ok(res, out);
  } catch (err) {
    return bad(res, 500, "Import failed", err?.message || err);
  }
}

// Step 1
export async function importStores(req, res) {
  // Required/optional headers exactly per your sample
  const schema = {
    sheet: 0, // Sheet1
    headers: [
      "name",
      "slug",
      "h1keyword",
      "web_url",
      "aff_url",
      "parent_slug",
      "seo_title",
      "seo_desc",
    ],
    // You can mark required here if you want strict validation
    required: ["name"], // slug can be auto-generated server-side if blank
    map: (row) => ({
      name: str(row.name),
      slug: str(row.slug),
      h1keyword: str(row.h1keyword),
      web_url: str(row.web_url),
      aff_url: str(row.aff_url),
      parent_slug: str(row.parent_slug),
      seo_title: str(row.seo_title),
      seo_desc: str(row.seo_desc),
    }),
  };
  return handleImport(req, res, schema, processStep1Stores);
}

// Step 2
export async function importTagStoreRelations(req, res) {
  const schema = {
    sheet: 0,
    headers: ["store_slug", "tag_slug"],
    required: ["store_slug", "tag_slug"],
    map: (row) => ({
      store_slug: str(row.store_slug),
      tag_slug: str(row.tag_slug),
    }),
  };
  return handleImport(req, res, schema, processStep2TagStoreRelations);
}

// Step 3
export async function importStoreCouponsDeals(req, res) {
  const schema = {
    sheet: 0,
    headers: [
      "slug",
      "coupon_type",
      "coupon_code",
      "title",
      "descp",
      "type_text",
      "is_editor",
    ],
    required: ["slug", "coupon_type", "title"],
    map: (row) => ({
      slug: str(row.slug),
      coupon_type: str(row.coupon_type), // "coupon" | "deal"
      coupon_code: str(row.coupon_code),
      title: str(row.title),
      descp: str(row.descp),
      type_text: str(row.type_text),
      is_editor: normalizeBoolean(row.is_editor),
    }),
  };
  return handleImport(req, res, schema, processStep3CouponsDeals);
}

// Step 4
export async function importFirstParagraph(req, res) {
  const schema = {
    sheet: 0,
    headers: ["slug", "first_paragraph"],
    required: ["slug", "first_paragraph"],
    map: (row) => ({
      slug: str(row.slug),
      first_paragraph: str(row.first_paragraph),
    }),
  };
  return handleImport(req, res, schema, processStep4FirstParagraph);
}

// Step 5
export async function importSeoDescCheck(req, res) {
  const schema = {
    sheet: 0,
    headers: ["slug", "seo_desc"],
    required: ["slug", "seo_desc"],
    map: (row) => ({
      slug: str(row.slug),
      seo_desc: str(row.seo_desc),
    }),
  };
  return handleImport(req, res, schema, processStep5SeoDescCheck);
}

// Step 6
export async function importStoreSlugsDefaultContent(req, res) {
  const schema = {
    sheet: 0,
    headers: ["old_slug", "new_slug"],
    required: ["old_slug", "new_slug"],
    map: (row) => ({
      old_slug: str(row.old_slug),
      new_slug: str(row.new_slug),
    }),
  };
  return handleImport(req, res, schema, processStep6SlugsDefault);
}
