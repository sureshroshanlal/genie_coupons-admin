// src/dbhelper/BlogCategoryRepo.js
import { supabase } from "./dbclient.js";

// List categories (optional name filter)
export async function list({ name = null } = {}) {
  let query = supabase
    .from("blog_categories")
    .select("*")
    .order("category_order", { ascending: true });

  if (name) {
    query = query.ilike("name", `%${name}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// Get category by ID
export async function getById(id) {
  const { data, error } = await supabase
    .from("blog_categories")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

// Insert category
export async function insert(fields) {
  const { data, error } = await supabase
    .from("blog_categories")
    .insert([fields])
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Update category by ID
export async function update(id, fields) {
  const { data, error } = await supabase
    .from("blog_categories")
    .update(fields)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Delete category
export async function remove(id) {
  const { error } = await supabase
    .from("blog_categories")
    .delete()
    .eq("id", id);

  if (error) throw error;
  return true;
}

// Ensure unique slug (for create)
export async function ensureUniqueSlug(baseSlug) {
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const { data, error } = await supabase
      .from("blog_categories")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (error) throw error;

    if (!data) break; // no conflict
    slug = `${baseSlug}-${counter++}`;
  }
  return slug;
}

// Ensure unique slug on update (ignore current category)
export async function ensureUniqueSlugOnUpdate(id, baseSlug) {
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const { data, error } = await supabase
      .from("blog_categories")
      .select("id")
      .eq("slug", slug)
      .neq("id", id)
      .maybeSingle();

    if (error) throw error;

    if (!data) break; // no conflict
    slug = `${baseSlug}-${counter++}`;
  }
  return slug;
}
