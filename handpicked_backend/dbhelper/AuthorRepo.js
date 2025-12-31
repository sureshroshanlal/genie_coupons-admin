import { supabase } from "./dbclient.js";

export async function list({ name = null, email = null } = {}) {
  let query = supabase
    .from("authors")
    .select("*")
    .order("id", { ascending: true });

  if (name) query = query.ilike("name", `%${name}%`);
  if (email) query = query.ilike("email", `%${email}%`);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getById(id) {
  const { data, error } = await supabase
    .from("authors")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function insert(fields) {
  const { data, error } = await supabase
    .from("authors")
    .insert([fields])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function update(id, fields) {
  const { data, error } = await supabase
    .from("authors")
    .update(fields)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function remove(id) {
  const { error } = await supabase.from("authors").delete().eq("id", id);
  if (error) throw error;
  return true;
}
