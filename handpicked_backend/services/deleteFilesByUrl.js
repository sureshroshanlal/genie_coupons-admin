// src/utils/deleteFilesByUrls.js
import { supabase } from "../dbhelper/dbclient.js";

/**
 * Parse a public URL or a bucket-relative path into a storage path string.
 */
function parseToPath(urlOrPath, fallbackBucket) {
  const raw = String(urlOrPath || "");
  if (!raw) return "";

  //relative path.
  if (!/^https?:\/\//i.test(raw)) {
    return raw.replace(/^\/+/, "");
  }

  // URL
  try {
    const u = new URL(raw);
    const m = u.pathname.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/);
    if (m) {
      // If the URL's bucket matches the provided bucket, use its path portion.
      const urlBucket = m[1];
      const path = m[2];
      if (!fallbackBucket || urlBucket === fallbackBucket) return path;
      // If buckets differ, still return the path; caller controls bucket param.
      return path;
    }

    //bucket
    const parts = u.pathname.replace(/^\/+/, "").split("/");
    if (!parts.length) return "";
    parts.shift();
    return parts.join("/");
  } catch {
    // If URL parsing fails, treat as path
    return raw.replace(/^\/+/, "");
  }
}

/**
 * Delete multiple files from a single storage bucket.
 * @param {string} bucket - Target storage bucket name (required).
 * @param {Array<string>} urlsOrPaths - Array of public URLs or bucket-relative paths.
 * @returns {Promise<Array<{ ok: boolean, count?: number, error?: any }>>}
 */
export async function deleteFilesByUrls(bucket, urlsOrPaths = []) {
  if (!bucket || typeof bucket !== "string") {
    throw new Error(
      "deleteFilesByUrls: 'bucket' is required and must be a string."
    );
  }
  if (!Array.isArray(urlsOrPaths) || urlsOrPaths.length === 0) {
    return [];
  }

  // Convert inputs to bucket-relative paths
  const paths = [];
  for (const item of urlsOrPaths) {
    const path = parseToPath(item, bucket);
    if (path) paths.push(path);
  }
  if (paths.length === 0) return [];

  try {
    const { error } = await supabase.storage.from(bucket).remove(paths);
    if (error) {
      // Log and return a single aggregated result describing the failure
      console.error(`deleteFilesByUrls: failed for bucket=${bucket}`, error);
      return [{ ok: false, error }];
    }
    return [{ ok: true, count: paths.length }];
  } catch (err) {
    console.error(
      `deleteFilesByUrls: exception for bucket=${bucket}`,
      err?.message || err
    );
    return [{ ok: false, error: err }];
  }
}
