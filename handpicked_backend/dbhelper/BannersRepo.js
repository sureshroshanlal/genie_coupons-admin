import { supabase } from "./dbclient.js";
import { deleteImageByPublicUrl } from "../services/storageService.js";

const COLS = `
  id, store_id, image_url, click_url, alt_text, label,
  is_active, display_order, created_at, updated_at,
  merchants:store_id (id, name, slug)
`;

const BUCKET = process.env.UPLOAD_BUCKET || "coupon-images";

export async function list({ page = 1, limit = 20, store_id, is_active } = {}) {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let q = supabase
    .from("merchant_banners")
    .select(COLS, { count: "exact" })
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (store_id) q = q.eq("store_id", store_id);
  if (is_active !== undefined) q = q.eq("is_active", is_active);

  const { data, error, count } = await q;
  if (error) throw error;

  return {
    rows: (data || []).map(normalize),
    total: count || 0,
  };
}

export async function getById(id) {
  const { data, error } = await supabase
    .from("merchant_banners")
    .select(COLS)
    .eq("id", id)
    .single();
  if (error) throw error;
  return normalize(data);
}

export async function insert(payload) {
  const { data, error } = await supabase
    .from("merchant_banners")
    .insert(payload)
    .select(COLS)
    .single();
  if (error) throw error;
  return normalize(data);
}

export async function update(id, patch) {
  const clean = Object.fromEntries(
    Object.entries(patch).filter(([, v]) => v !== undefined),
  );
  clean.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("merchant_banners")
    .update(clean)
    .eq("id", id)
    .select(COLS)
    .single();
  if (error) throw error;
  return normalize(data);
}

export async function remove(id) {
  const { data: row, error: fe } = await supabase
    .from("merchant_banners")
    .select("image_url")
    .eq("id", id)
    .single();
  if (fe) throw fe;

  // Best-effort storage delete — don't block on failure
  if (row?.image_url) {
    await deleteImageByPublicUrl(BUCKET, row.image_url).catch((e) =>
      console.error("Banner image delete failed:", e),
    );
  }

  const { error } = await supabase.from("merchant_banners").delete().eq("id", id);
  if (error) throw error;
  return true;
}

export async function toggleActive(id) {
  const { data: cur, error: ge } = await supabase
    .from("merchant_banners")
    .select("is_active")
    .eq("id", id)
    .single();
  if (ge) throw ge;

  const { data, error } = await supabase
    .from("merchant_banners")
    .update({ is_active: !cur.is_active, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(COLS)
    .single();
  if (error) throw error;
  return normalize(data);
}

// ── Internal ──────────────────────────────────────────────────────────────────

function normalize(row) {
  if (!row) return null;
  return {
    id: row.id,
    store_id: row.store_id,
    store_name: row.merchants?.name || null,
    store_slug: row.merchants?.slug || null,
    image_url: row.image_url,
    click_url: row.click_url,
    alt_text: row.alt_text,
    label: row.label,
    is_active: row.is_active,
    display_order: row.display_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
