import { supabase } from "../dbhelper/dbclient.js";

/**
 * Upload a file buffer to any bucket/folder
 * @param {string} bucket - Supabase bucket name
 * @param {string} folder - Folder inside bucket
 * @param {Buffer} buffer - File buffer
 * @param {string} filename - Original file name
 * @param {string} mimetype - MIME type
 */
export async function uploadImageBuffer(bucket, folder, buffer, filename, mimetype) {
    // basic validation
    if (!buffer) {
      return { url: null, error: new Error("uploadImageBuffer: missing buffer"), path: null, size: 0 };
    }

    // Buffer or ArrayBuffer-like
    const size = typeof buffer.byteLength === "number" ? buffer.byteLength : (Buffer.isBuffer(buffer) ? buffer.length : null);
    if (!size || size === 0) {
      return { url: null, error: new Error("uploadImageBuffer: buffer is empty (0 bytes)"), path: null, size: 0 };
    }
  const now = new Date();
  const datePath = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}`;
  const safeName = String(filename || "file").toLowerCase().replace(/\s+/g, "-");
  const path = `${folder}/${datePath}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, buffer, {
      contentType: mimetype || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) return { url: null, error: uploadError };

  const { data: pubData } = supabase.storage.from(bucket).getPublicUrl(path);
  return { url: pubData?.publicUrl || null, error: null, path };
}

/**
 * Delete by public URL from a given bucket
 * @param {string} bucket - Supabase bucket name
 * @param {string} publicUrl - Full public URL
 */
export async function deleteImageByPublicUrl(bucket, publicUrl) {
  if (!publicUrl) return { error: null };
  try {
    const url = new URL(publicUrl);
    const marker = `/storage/v1/object/public/${bucket}/`;
    const idx = url.pathname.indexOf(marker);
    if (idx === -1) return { error: null };
    const objectPath = decodeURIComponent(url.pathname.slice(idx + marker.length));

    const { error } = await supabase.storage.from(bucket).remove([objectPath]);
    return { error };
  } catch {
    return { error: null };
  }
}