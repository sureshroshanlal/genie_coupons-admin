// src/controllers/tags.controller.js
import { supabase } from "../dbhelper/dbclient.js";
import { toSlug } from "../utils/slug.js";
import { normalizeTagPayload, validateTagPayload } from "../utils/validation.js";
import { uploadImageBuffer, deleteImageByPublicUrl } from "../services/storageService.js";

const BUCKET = "tag-images";
const FOLDER = "tags";

const toError = (err, msg = "Server error") => ({
  data: null,
  error: { message: msg, details: err?.message || err },
});

// GET all tags
export async function listTags(_req, res) {
  const { data, error } = await supabase
    .from("tags")
    .select("*, parent:parent_id(tag_name)")
    .order("display_order", { ascending: true });

  if (error) return res.status(500).json(toError(error, "Error fetching tags"));

  res.json({
    data: data.map(t => ({
      ...t,
      parentTagName: t.parent?.tag_name || null,
      name: t.tag_name,
      isActive: t.active,
    })),
    error: null,
  });
}

// GET tag by ID
export async function getTag(req, res) {
  const { id } = req.params;
  const { data, error } = await supabase.from("tags").select("*").eq("id", id).single();
  if (error || !data) return res.status(404).json(toError(error, "Tag not found"));
  res.json({ data, error: null });
}
//CREATE tag
export async function createTag(req, res) {
  try {
    const fields = normalizeTagPayload(req.body);

    // Auto-generate slug
    fields.slug = fields.slug
      ? toSlug(fields.slug)
      : toSlug(fields.tag_name);

    // Validate required fields
    const v = validateTagPayload(fields, { requireName: true, requireSlug: true });
    if (!v.ok) {
      return res.status(400).json({
        data: null,
        error: { message: "Validation failed", details: v.errors },
      });
    }

    // Upload image if provided
    let image_url = null;
    if (req.file) {
      const { url, error } = await uploadImageBuffer(
        BUCKET, FOLDER,
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );
      
      if (error) {
        return res.status(500).json(toError(error, "Image upload failed"));
      }
      image_url = url;
    }

    // --- Remove helper field before sending to DB ---
    const { existing_image_url, ...dbFields } = fields;

    // Final object to insert
    const insertData = {
      ...dbFields,
      image_url,
      created_at: new Date().toISOString(), // optional if DB has default
    };

    // Insert into Supabase
    const { data, error } = await supabase
      .from("tags")
      .insert([insertData])
      .select()
      .single();

    if (error) {
      return res.status(500).json(toError(error, "Error creating tag"));
    }

    return res.status(201).json({ data, error: null });
  } catch (err) {
    return res.status(500).json(toError(err));
  }
}

//UPDATE tag
export async function updateTag(req, res) {
  try {
    const { id } = req.params;
    const { data: current } = await supabase
      .from("tags")
      .select("*")
      .eq("id", id)
      .single();
    if (!current) return res.status(404).json(toError({}, "Tag not found"));

    const fields = normalizeTagPayload(req.body);

    // Prevent parent = self
    if (fields.parent_id && Number(fields.parent_id) === Number(id)) {
      return res
        .status(400)
        .json({ data: null, error: { message: "parent_id cannot equal tag id" } });
    }

    // Auto-slug
    fields.slug = fields.slug
      ? toSlug(fields.slug)
      : toSlug(fields.tag_name || current.tag_name);

    // Validate
    const v = validateTagPayload(fields, { requireName: false, requireSlug: true });
    if (!v.ok)
      return res
        .status(400)
        .json({ data: null, error: { message: "Validation failed", details: v.errors } });

    // Image handling
    let image_url = current.image_url;
    if (req.file) {
      const { url, error } = await uploadImageBuffer(
        BUCKET, FOLDER,
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );
      if (error) return res.status(500).json(toError(error, "Image upload failed"));
      await deleteImageByPublicUrl(BUCKET, image_url);
      image_url = url;
    } else if (fields.existing_image_url === null) {
      await deleteImageByPublicUrl(BUCKET, image_url);
      image_url = null;
    }

    // Remove helper field so Supabase doesn't see it as a column
    const { existing_image_url, ...dbFields } = fields;

    const updateData = {
      ...current,
      ...dbFields,
      image_url,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from("tags")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();
    if (error) return res.status(500).json(toError(error, "Error updating tag"));

    res.json({ data, error: null });
  } catch (err) {
    res.status(500).json(toError(err));
  }
}

// DELETE tag
export async function deleteTag(req, res) {
  const { id } = req.params;
  const { data: tag } = await supabase.from("tags").select("image_url").eq("id", id).single();
  if (tag?.image_url) await deleteImageByPublicUrl(BUCKET, tag.image_url);
  const { error } = await supabase.from("tags").delete().eq("id", id);
  if (error) return res.status(500).json(toError(error, "Error deleting tag"));
  res.json({ data: { success: true }, error: null });
}