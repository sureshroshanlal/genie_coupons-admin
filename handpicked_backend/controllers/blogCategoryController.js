// src/controllers/blogCategoryController.js
import * as blogCategoryRepo from "../dbhelper/BlogCategoryRepo.js";
import { toSlug } from "../utils/slug.js";

const toError = (err, msg = "Server error") => ({
  data: null,
  error: { message: msg, details: err?.message || err },
});
const toBool = (v) => v === true || v === "true" || v === 1 || v === "1";

export async function listCategories(req, res) {
  try {
    const { name } = req.query;
    const rows = await blogCategoryRepo.list({ name: name || null });
    return res.json({ data: rows, error: null });
  } catch (err) {
    return res.status(500).json(toError(err, "Error fetching blog categories"));
  }
}

export async function getCategory(req, res) {
  try {
    const row = await blogCategoryRepo.getById(req.params.id);
    if (!row) return res.status(404).json(toError({}, "Blog category not found"));
    return res.json({ data: row, error: null });
  } catch (err) {
    return res.status(500).json(toError(err, "Error fetching blog category"));
  }
}

export async function createCategory(req, res) {
  try {
    const body = req.body || {};
    if (!body.name || !String(body.name).trim()) {
      return res.status(400).json({ data: null, error: { message: "Name is required" } });
    }

    let slug = toSlug(body.slug || body.name);
    slug = await blogCategoryRepo.ensureUniqueSlug(slug);

    const created = await blogCategoryRepo.insert({
      name: body.name,
      slug,
      description: body.description || "",
      seo_title: body.seo_title || "",
      seo_keywords: body.seo_keywords || "",
      seo_description: body.seo_description || "",
      h1_title: body.h1_title || "",
      parent_id: body.parent_id || null,
      category_order: body.category_order ? Number(body.category_order) : 0,
      is_top: toBool(body.is_top),
      show_in_sidebar: toBool(body.show_in_sidebar),
      is_publish: toBool(body.is_publish),
    });

    return res.status(201).json({ data: created, error: null });
  } catch (err) {
    return res.status(500).json(toError(err, "Error creating blog category"));
  }
}

export async function updateCategory(req, res) {
  try {
    const { id } = req.params;
    const body = req.body || {};

    const patch = {
      name: body.name,
      description: body.description,
      seo_title: body.seo_title,
      seo_keywords: body.seo_keywords,
      seo_description: body.seo_description,
      h1_title: body.h1_title,
      parent_id: body.parent_id || null,
      category_order: body.category_order !== undefined ? Number(body.category_order) : undefined,
      is_top: body.is_top !== undefined ? toBool(body.is_top) : undefined,
      show_in_sidebar: body.show_in_sidebar !== undefined ? toBool(body.show_in_sidebar) : undefined,
      is_publish: body.is_publish !== undefined ? toBool(body.is_publish) : undefined,
    };

    if (body.slug) {
      patch.slug = await blogCategoryRepo.ensureUniqueSlugOnUpdate(id, toSlug(body.slug));
    } else if (body.name) {
      patch.slug = await blogCategoryRepo.ensureUniqueSlugOnUpdate(id, toSlug(body.name));
    }

    const updated = await blogCategoryRepo.update(id, patch);
    return res.json({ data: updated, error: null });
  } catch (err) {
    return res.status(500).json(toError(err, "Error updating blog category"));
  }
}

export async function updateCategoryStatus(req, res) {
  try {
    const updated = await blogCategoryRepo.update(req.params.id, {
      is_publish: toBool(req.body.is_publish),
    });
    return res.json({ data: updated, error: null });
  } catch (err) {
    return res.status(500).json(toError(err, "Error updating blog category status"));
  }
}

export async function deleteCategory(req, res) {
  try {
    const { id } = req.params;
    await blogCategoryRepo.remove(id);
    return res.json({ data: { id: Number(id) }, error: null });
  } catch (err) {
    return res.status(500).json(toError(err, "Error deleting blog category"));
  }
}
