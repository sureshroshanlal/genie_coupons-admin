// src/services/importsService.js
import axios from "axios";
import { API_BASE_URL } from "../config/api";

const http = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  withCredentials: true,
});

// Helper to POST a single file to an endpoint and return normalized result
async function postFile(url, file, extra = {}) {
  const fd = new FormData();
  fd.append("file", file);
  // Optional flags, e.g., dry run
  Object.entries(extra).forEach(([k, v]) => {
    if (v !== undefined && v !== null) fd.append(k, String(v));
  });

  const res = await http.post(url, fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  // Expect server to return { data: { ...summary }, error } shape
  const payload = res?.data;
  const error = payload?.error;
  if (error) {
    const msg = error?.message || "Import failed";
    const details = error?.details;
    throw new Error(details ? `${msg}: ${details}` : msg);
  }

  // Normalized result for UI
  const data = payload?.data || payload || {};
  return {
    ok: true,
    inserted: data.inserted,
    updated: data.updated,
    skipped: data.skipped,
    failed: data.failed,
    total: data.total,
    dry_run: data.dry_run,
    errors: data.errors,
    message: data.message,
    job_id: data.job_id,
  };
}

// Step 1: Import Stores
export async function importStores(file, { dryRun = false } = {}) {
  return postFile("/imports/stores", file, { dry_run: dryRun });
}

// Step 2: Import Tag–Store Relations
export async function importTagStoreRelations(file, { dryRun = false } = {}) {
  return postFile("/imports/tag-store-relations", file, { dry_run: dryRun });
}

// Step 3: Import Store Coupons/Deals
export async function importStoreCouponsDeals(file, { dryRun = false } = {}) {
  return postFile("/imports/store-coupons-deals", file, { dry_run: dryRun });
}

// Step 4: Import First Paragraph (for Stores)
export async function importFirstParagraph(file, { dryRun = false } = {}) {
  return postFile("/imports/store-first-paragraph", file, { dry_run: dryRun });
}

// Step 5: Import Stores SEO Desc Check
export async function importSeoDescCheck(file, { dryRun = false } = {}) {
  return postFile("/imports/store-seo-desc-check", file, { dry_run: dryRun });
}

// Step 6: Import Stores Slugs for Default Content
export async function importStoreSlugsDefaultContent(
  file,
  { dryRun = false } = {}
) {
  return postFile("/imports/store-slugs-default-content", file, {
    dry_run: dryRun,
  });
}
