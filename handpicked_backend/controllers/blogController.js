import * as blogRepo from "../dbhelper/BlogRepo.js";
import { toSlug } from "../utils/slug.js";
import {
  uploadImageBuffer,
  deleteImageByPublicUrl,
} from "../services/storageService.js";

const BUCKET = "blog-images";
const FOLDER = "blogs";

// Helpers
const toError = (err, msg = "Server error") => ({
  data: null,
  error: { message: msg, details: err?.message || err },
});
const toBool = (v) => v === true || v === "true" || v === 1 || v === "1";

export async function listBlogs(req, res) {
  try {
    const title = req.query?.title || null;
    const rows = await blogRepo.list({ title });
    return res.json({ data: rows, error: null });
  } catch (err) {
    return res.status(500).json(toError(err, "Error fetching blogs"));
  }
}

export async function getBlog(req, res) {
  try {
    const blog = await blogRepo.getById(req.params.id);
    if (!blog) return res.status(404).json(toError({}, "Blog not found"));
    return res.json({ data: blog, error: null });
  } catch (err) {
    return res.status(500).json(toError(err, "Error fetching blog"));
  }
}

export async function createBlog(req, res) {
  try {
    console.log("BODY:", req.body);
    console.log("FILES:", req.files);

    const body = req.body || {};

    if (!body.title || !String(body.title).trim()) {
      return res
        .status(400)
        .json({ data: null, error: { message: "Title is required" } });
    }

    // Server-side slug generation
    let slug = toSlug(body.slug || body.title);
    slug = await blogRepo.ensureUniqueSlug(slug);

    // Upload featured_thumb if present
    let featured_thumb_url = null;
    if (req.files?.featured_thumb?.[0]) {
      const file = req.files.featured_thumb[0];
      const { url, error } = await uploadImageBuffer(
        BUCKET,
        FOLDER,
        file.buffer,
        file.originalname,
        file.mimetype
      );
      if (error)
        return res
          .status(500)
          .json(toError(error, "Featured thumb upload failed"));
      featured_thumb_url = url;
    }

    // Upload featured_image if present
    let featured_image_url = null;
    if (req.files?.featured_image?.[0]) {
      const file = req.files.featured_image[0];
      const { url, error } = await uploadImageBuffer(
        BUCKET,
        FOLDER,
        file.buffer,
        file.originalname,
        file.mimetype
      );
      if (error)
        return res
          .status(500)
          .json(toError(error, "Featured image upload failed"));
      featured_image_url = url;
    }

    const created = await blogRepo.insert({
      title: body.title,
      slug,
      category_id: body.category_id || null,
      author_id: body.author_id || null,
      content: body.content || "",
      meta_title: body.meta_title || "",
      meta_keywords: body.meta_keywords || "",
      meta_description: body.meta_description || "",
      featured_thumb_url,
      featured_image_url,
      is_publish: toBool(body.is_publish),
      is_featured: toBool(body.is_featured),
      is_top: toBool(body.is_top),
      top_category_name: body.top_category_name || null,
      category_order: body.category_order ? Number(body.category_order) : null,
      blogs_count: body.blogs_count ? Number(body.blogs_count) : 0,
    });

    return res.status(201).json({ data: created, error: null });
  } catch (err) {
    console.error("Create Blog Error:", err);
    return res.status(500).json(toError(err, "Error creating blog"));
  }
}

export async function updateBlog(req, res) {
  try {
    const { id } = req.params;
    const body = req.body || {};

    const patch = {
      title: body.title ?? undefined,
      category_id:
        body.category_id !== undefined
          ? toNumOrNull(body.category_id)
          : undefined,
      author_id:
        body.author_id !== undefined ? toNumOrNull(body.author_id) : undefined,
      content: body.content ?? undefined,
      meta_title: body.meta_title ?? undefined,
      meta_keywords: body.meta_keywords ?? undefined,
      meta_description: body.meta_description ?? undefined,
      is_publish:
        body.is_publish !== undefined ? toBool(body.is_publish) : undefined,
      is_featured:
        body.is_featured !== undefined ? toBool(body.is_featured) : undefined,
      is_top: body.is_top !== undefined ? toBool(body.is_top) : undefined,
      top_category_name: body.top_category_name ?? undefined,
      category_order:
        body.category_order !== undefined
          ? Number(body.category_order)
          : undefined,
      blogs_count:
        body.blogs_count !== undefined ? Number(body.blogs_count) : undefined,
    };

    // Re-slugify if slug is provided
    if (body.slug !== undefined) {
      const proposed = toSlug(body.slug || "");
      patch.slug = await blogRepo.ensureUniqueSlugOnUpdate(id, proposed);
    } else if (body.title !== undefined && body.title) {
      patch.slug = await blogRepo.ensureUniqueSlugOnUpdate(
        id,
        toSlug(body.title)
      );
    }

    // Handle updated featured_thumb
    if (req.files?.featured_thumb?.[0]) {
      const file = req.files.featured_thumb[0];
      const { url, error } = await uploadImageBuffer(
        BUCKET,
        FOLDER,
        file.buffer,
        file.originalname,
        file.mimetype
      );
      if (error)
        return res
          .status(500)
          .json(toError(error, "Featured thumb upload failed"));
      patch.featured_thumb_url = url;
    }

    // Handle updated featured_image
    if (req.files?.featured_image?.[0]) {
      const file = req.files.featured_image[0];
      const { url, error } = await uploadImageBuffer(
        BUCKET,
        FOLDER,
        file.buffer,
        file.originalname,
        file.mimetype
      );
      if (error)
        return res
          .status(500)
          .json(toError(error, "Featured image upload failed"));
      patch.featured_image_url = url;
    }

    const updated = await blogRepo.update(id, patch);
    return res.json({ data: updated, error: null });
  } catch (err) {
    console.error("Update Blog Error:", err);
    return res.status(500).json(toError(err, "Error updating blog"));
  }
}

export async function updateBlogStatus(req, res) {
  try {
    const updated = await blogRepo.update(req.params.id, {
      is_publish: toBool(req.body.is_publish),
    });
    return res.json({ data: updated, error: null });
  } catch (err) {
    return res.status(500).json(toError(err, "Error updating blog status"));
  }
}

export async function deleteBlog(req, res) {
  try {
    const { id } = req.params;

    // Optionally — get current blog to delete images from Supabase
    const blog = await blogRepo.getById(id);
    if (blog?.featured_thumb_url) {
      await deleteImageByPublicUrl(BUCKET, blog.featured_thumb_url);
    }
    if (blog?.featured_image_url) {
      await deleteImageByPublicUrl(BUCKET, blog.featured_image_url);
    }

    await blogRepo.remove(id);
    return res.json({ data: { id: Number(id) }, error: null });
  } catch (err) {
    console.error("Delete Blog Error:", err);
    return res.status(500).json(toError(err, "Error deleting blog"));
  }
}

export async function uploadBlogImage(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: { message: "No file uploaded" } });
    }

    const file = req.file;
    const { url, error } = await uploadImageBuffer(
      BUCKET,
      FOLDER,
      file.buffer,
      file.originalname,
      file.mimetype
    );

    if (error) {
      return res
        .status(500)
        .json({ error: { message: "Upload failed", details: error } });
    }

    return res.json({ url });
  } catch (err) {
    console.error("Upload Blog Image Error:", err);
    return res
      .status(500)
      .json({ error: { message: "Error uploading image" } });
  }
}
