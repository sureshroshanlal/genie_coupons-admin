// src/components/merchantCategories/AddMerchantCategoryModal.jsx
import React, { useState } from "react";
import { addMerchantCategory } from "../../services/merchantCategoryService";
import useEscClose from "../hooks/useEscClose";

export default function AddMerchantCategoryModal({
  onClose,
  onSave,
  parents = [],
}) {
  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    meta_title: "",
    meta_keywords: "",
    meta_description: "",
    parent_id: "",
    top_banner_link_url: "",
    side_banner_link_url: "",
    show_home: false,
    show_deals_page: false,
    is_publish: false,
    is_header: false,
  });

  const [thumb, setThumb] = useState(null);
  const [topBanner, setTopBanner] = useState(null);
  const [sideBanner, setSideBanner] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  };

  const handleNameBlur = () => {
    if (!form.slug && form.name) {
      const slug = String(form.name)
        .trim()
        .toLowerCase()
        .replace(/['"]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      setForm((f) => ({ ...f, slug }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (!form.name || !form.slug) return;

    setSaving(true);
    const fd = new FormData();
    fd.append("name", form.name);
    fd.append("slug", form.slug);
    fd.append("description", form.description || "");
    fd.append("meta_title", form.meta_title || "");
    fd.append("meta_keywords", form.meta_keywords || "");
    fd.append("meta_description", form.meta_description || "");
    if (form.parent_id) fd.append("parent_id", String(form.parent_id));
    fd.append("top_banner_link_url", form.top_banner_link_url || "");
    fd.append("side_banner_link_url", form.side_banner_link_url || "");
    fd.append("show_home", String(!!form.show_home));
    fd.append("show_deals_page", String(!!form.show_deals_page));
    fd.append("is_publish", String(!!form.is_publish));
    fd.append("is_header", String(!!form.is_header));
    if (thumb) fd.append("thumb", thumb);
    if (topBanner) fd.append("top_banner", topBanner);
    if (sideBanner) fd.append("side_banner", sideBanner);

    try {
      const resp = await addMerchantCategory(fd);
      if (resp.error) {
        alert(resp.error.message || "Create failed");
        return;
      }
      onSave?.();
      onClose?.();
    } catch (err) {
      const msg = err?.message || "Request failed";
      alert(msg);
      console.error("Add merchant category failed:", msg || err);
    } finally {
      setSaving(false);
    }
  };

  // close on ESC
  useEscClose(onClose);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-5xl rounded shadow-lg p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">Add Category</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name & Slug */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-1">Name</label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                onBlur={handleNameBlur}
                className="w-full border px-3 py-2 rounded"
                required
              />
            </div>
            <div>
              <label className="block mb-1">Slug</label>
              <input
                name="slug"
                value={form.slug}
                onChange={handleChange}
                className="w-full border px-3 py-2 rounded"
                required
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block mb-1">Description</label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={6}
              className="w-full border px-3 py-2 rounded"
            />
          </div>

          {/* Meta */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block mb-1">Meta Title</label>
              <input
                name="meta_title"
                value={form.meta_title}
                onChange={handleChange}
                className="w-full border px-3 py-2 rounded"
              />
            </div>
            <div>
              <label className="block mb-1">Meta Keywords</label>
              <input
                name="meta_keywords"
                value={form.meta_keywords}
                onChange={handleChange}
                className="w-full border px-3 py-2 rounded"
              />
            </div>
            <div>
              <label className="block mb-1">Meta Description</label>
              <input
                name="meta_description"
                value={form.meta_description}
                onChange={handleChange}
                className="w-full border px-3 py-2 rounded"
              />
            </div>
          </div>

          {/* Parent */}
          <div>
            <label className="block mb-1">Parent Category</label>
            <select
              name="parent_id"
              value={form.parent_id}
              onChange={handleChange}
              className="w-full border px-3 py-2 rounded"
            >
              <option value="">None</option>
              {parents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Uploads */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div>
              <label className="block mb-1">Thumbnail (webp/png)</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setThumb(e.target.files?.[0] || null)}
              />
            </div>
            <div>
              <label className="block mb-1">Top Banner</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setTopBanner(e.target.files?.[0] || null)}
              />
              <input
                name="top_banner_link_url"
                value={form.top_banner_link_url}
                onChange={handleChange}
                placeholder="Top Banner Url"
                className="w-full border px-3 py-2 rounded mt-2"
              />
            </div>
            <div>
              <label className="block mb-1">Side Banner</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setSideBanner(e.target.files?.[0] || null)}
              />
              <input
                name="side_banner_link_url"
                value={form.side_banner_link_url}
                onChange={handleChange}
                placeholder="Side Banner Url"
                className="w-full border px-3 py-2 rounded mt-2"
              />
            </div>
          </div>

          {/* Toggles */}
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="show_home"
                checked={!!form.show_home}
                onChange={handleChange}
              />
              Show Home
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="show_deals_page"
                checked={!!form.show_deals_page}
                onChange={handleChange}
              />
              Show Deals Page
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="is_publish"
                checked={!!form.is_publish}
                onChange={handleChange}
              />
              Publish
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="is_header"
                checked={!!form.is_header}
                onChange={handleChange}
              />
              Is Header
            </label>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              className="border px-4 py-2 rounded"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              aria-busy={saving}
              className="bg-blue-600 text-white px-4 py-2 rounded disabled:bg-gray-400"
            >
              {saving ? "Adding..." : "Add Category"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
