import { supabase } from "../dbhelper/dbclient.js";

const toError = (err, msg) => ({ data: null, error: { message: msg, details: err?.message } });

// GET stores linked to a tag
export async function getStoresByTag(req, res) {
  const { tagId } = req.params;
  const { data, error } = await supabase
    .from("tag_stores")
    .select("store_id, stores(name)")
    .eq("tag_id", tagId);

  if (error) return res.status(500).json(toError(error, "Error fetching stores"));

  const mapped = data.map((row) => ({
    id: row.store_id,
    name: row.stores?.name || null,
  }));

  res.json({ data: mapped, error: null });
}

// Search stores
export async function searchStores(req, res) {
  const { query } = req.query;
  const { data, error } = await supabase
    .from("stores")
    .select("*")
    .ilike("name", `%${query}%`)
    .limit(20);

  if (error) return res.status(500).json(toError(error, "Error searching stores"));
  res.json({ data, error: null });
}

// Add store to tag
export async function addStoreToTag(req, res) {
  const { tagId } = req.params;
  const { storeId } = req.body;

  const { data, error } = await supabase
    .from("tag_stores")
    .insert([{ tag_id: tagId, store_id: storeId }])
    .select()
    .single();

  if (error) return res.status(500).json(toError(error, "Error linking store"));
  res.status(201).json({ data, error: null });
}

// Remove store
export async function removeStoreFromTag(req, res) {
  const { tagId, storeId } = req.params;
  const { error } = await supabase
    .from("tag_stores")
    .delete()
    .eq("tag_id", tagId)
    .eq("store_id", storeId);

  if (error) return res.status(500).json(toError(error, "Error removing store"));
  res.json({ data: { success: true }, error: null });
}