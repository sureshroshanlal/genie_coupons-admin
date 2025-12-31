// src/pages/modals/EditBlogCategoryModal.jsx
import React, { useEffect, useState } from "react";
import {
  getBlogCategory,
  updateBlogCategory,
  listBlogCategories,
} from "../../services/blogCategoryService";
import useEscClose from "../hooks/useEscClose";

export default function EditBlogCategoryModal({ categoryId, onClose, onSave }) {
  const [form, setForm] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const category = await getBlogCategory(categoryId);
      const { data } = await listBlogCategories();
      setCategories(Array.isArray(data) ? data : []);
      setForm(category);
      setLoading(false);
    })();
  }, [categoryId]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  };

  const handleNameBlur = () => {
    if (!form.slug && form.name) {
      const slug = String(form.name)
        .toLowerCase()
        .trim()
        .replace(/['"]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      setForm((f) => ({ ...f, slug }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name: form.name,
      slug: form.slug,
      description: form.description,
      seo_title: form.seo_title,
      seo_keywords: form.seo_keywords,
      seo_description: form.seo_description,
      h1_title: form.h1_title,
      parent_id: form.parent_id || null,
      category_order: form.category_order ? Number(form.category_order) : 0,
      is_top: !!form.is_top,
      show_in_sidebar: !!form.show_in_sidebar,
      is_publish: !!form.is_publish,
    };
    const { error } = await updateBlogCategory(categoryId, payload);
    setSaving(false);
    if (!error) {
      if (onSave) onSave();
      onClose();
    } else {
      console.error(error.message);
    }
  };

  // close on ESC
  useEscClose(onClose);

  if (loading || !form) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 text-white">
        Loading category...
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-4xl rounded shadow-lg p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">Edit Blog Category</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name & Slug */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label>Category Name *</label>
              <input
                name="name"
                value={form.name || ""}
                onChange={handleChange}
                onBlur={handleNameBlur}
                className="w-full border px-3 py-2 rounded"
                required
              />
            </div>
            <div>
              <label>Slug *</label>
              <input
                name="slug"
                value={form.slug || ""}
                onChange={handleChange}
                className="w-full border px-3 py-2 rounded"
                required
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label>Description</label>
            <textarea
              name="description"
              value={form.description || ""}
              onChange={handleChange}
              rows={4}
              className="w-full border px-3 py-2 rounded"
            />
          </div>

          {/* SEO */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label>SEO Title</label>
              <input
                name="seo_title"
                value={form.seo_title || ""}
                onChange={handleChange}
                className="w-full border px-3 py-2 rounded"
              />
            </div>
            <div>
              <label>SEO Keywords</label>
              <input
                name="seo_keywords"
                value={form.seo_keywords || ""}
                onChange={handleChange}
                className="w-full border px-3 py-2 rounded"
              />
            </div>
            <div>
              <label>SEO Description</label>
              <input
                name="seo_description"
                value={form.seo_description || ""}
                onChange={handleChange}
                className="w-full border px-3 py-2 rounded"
              />
            </div>
          </div>

          {/* H1, Parent, Order */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label>H1 Title</label>
              <input
                name="h1_title"
                value={form.h1_title || ""}
                onChange={handleChange}
                className="w-full border px-3 py-2 rounded"
              />
            </div>
            <div>
              <label>Parent Category</label>
              <select
                name="parent_id"
                value={form.parent_id || ""}
                onChange={handleChange}
                className="w-full border px-3 py-2 rounded"
              >
                <option value="">None</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Category Order</label>
              <input
                name="category_order"
                type="number"
                value={form.category_order || ""}
                onChange={handleChange}
                className="w-full border px-3 py-2 rounded"
              />
            </div>
          </div>

          {/* Toggles */}
          <div className="flex gap-6">
            <label className="flex gap-2 items-center">
              <input
                type="checkbox"
                name="is_top"
                checked={!!form.is_top}
                onChange={handleChange}
              />
              Top Category
            </label>
            <label className="flex gap-2 items-center">
              <input
                type="checkbox"
                name="show_in_sidebar"
                checked={!!form.show_in_sidebar}
                onChange={handleChange}
              />
              Sidebar
            </label>
            <label className="flex gap-2 items-center">
              <input
                type="checkbox"
                name="is_publish"
                checked={!!form.is_publish}
                onChange={handleChange}
              />
              Publish
            </label>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="border px-4 py-2 rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 text-white px-4 py-2 rounded disabled:bg-gray-400"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
