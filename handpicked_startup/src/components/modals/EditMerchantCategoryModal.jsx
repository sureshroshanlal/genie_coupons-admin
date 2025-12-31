// src/components/merchantCategories/EditMerchantCategoryModal.jsx
import React, { useEffect, useState } from "react";
import {
  getMerchantCategory,
  updateMerchantCategory,
} from "../../services/merchantCategoryService";
import useEscClose from "../hooks/useEscClose";

export default function EditMerchantCategoryModal({
  categoryId,
  onClose,
  onSave,
  parents = [],
}) {
  const [form, setForm] = useState(null);
  const [thumb, setThumb] = useState(null);
  const [topBanner, setTopBanner] = useState(null);
  const [sideBanner, setSideBanner] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // temp object URLs for previews
  const [tempThumbUrl, setTempThumbUrl] = useState(null);
  const [tempTopUrl, setTempTopUrl] = useState(null);
  const [tempSideUrl, setTempSideUrl] = useState(null);

  const [removeThumb, setRemoveThumb] = useState(false);
  const [removeTop, setRemoveTop] = useState(false);
  const [removeSide, setRemoveSide] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const m = await getMerchantCategory(categoryId);
        if (!mounted) return;
        setForm({
          id: m?.id,
          name: m?.name || "",
          slug: m?.slug || "",
          description: m?.description || "",
          meta_title: m?.meta_title || "",
          meta_keywords: m?.meta_keywords || "",
          meta_description: m?.meta_description || "",
          parent_id: m?.parent_id || "",
          top_banner_link_url: m?.top_banner_link_url || "",
          side_banner_link_url: m?.side_banner_link_url || "",
          show_home: !!m?.show_home,
          show_deals_page: !!m?.show_deals_page,
          is_publish: !!m?.is_publish,
          is_header: !!m?.is_header,
          thumb_url: m?.thumb_url || "",
          top_banner_url: m?.top_banner_url || "",
          side_banner_url: m?.side_banner_url || "",
        });
      } catch (e) {
        console.error("Load category failed:", e?.message || e);
        setForm({
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
          thumb_url: "",
          top_banner_url: "",
          side_banner_url: "",
        });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
      if (tempThumbUrl) URL.revokeObjectURL(tempThumbUrl);
      if (tempTopUrl) URL.revokeObjectURL(tempTopUrl);
      if (tempSideUrl) URL.revokeObjectURL(tempSideUrl);
    };
  }, [categoryId, tempThumbUrl, tempTopUrl, tempSideUrl]);

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

  const pickThumb = (file) => {
    setRemoveThumb(false);
    setThumb(file);
    if (tempThumbUrl) URL.revokeObjectURL(tempThumbUrl);
    if (file) {
      const url = URL.createObjectURL(file);
      setTempThumbUrl(url);
      setForm((f) => ({ ...f, thumb_url: url }));
    }
  };
  const pickTop = (file) => {
    setRemoveTop(false);
    setTopBanner(file);
    if (tempTopUrl) URL.revokeObjectURL(tempTopUrl);
    if (file) {
      const url = URL.createObjectURL(file);
      setTempTopUrl(url);
      setForm((f) => ({ ...f, top_banner_url: url }));
    }
  };
  const pickSide = (file) => {
    setRemoveSide(false);
    setSideBanner(file);
    if (tempSideUrl) URL.revokeObjectURL(tempSideUrl);
    if (file) {
      const url = URL.createObjectURL(file);
      setTempSideUrl(url);
      setForm((f) => ({ ...f, side_banner_url: url }));
    }
  };

  const clearThumb = () => {
    setThumb(null);
    setRemoveThumb(true);
    setForm((f) => ({ ...f, thumb_url: "" }));
  };
  const clearTop = () => {
    setTopBanner(null);
    setRemoveTop(true);
    setForm((f) => ({ ...f, top_banner_url: "" }));
  };
  const clearSide = () => {
    setSideBanner(null);
    setRemoveSide(true);
    setForm((f) => ({ ...f, side_banner_url: "" }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (!form?.name || !form?.slug) return;

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
    if (removeThumb) fd.append("remove_thumb", "true");
    if (removeTop) fd.append("remove_top_banner", "true");
    if (removeSide) fd.append("remove_side_banner", "true");

    try {
      const resp = await updateMerchantCategory(categoryId, fd);
      if (resp.error) {
        alert(resp.error.message || "Update failed");
        return;
      }
      onSave?.();
      onClose?.();
    } catch (err) {
      const msg = err?.message || "Request failed";
      alert(msg);
      console.error("Update merchant category failed:", msg || err);
    } finally {
      setSaving(false);
    }
  };

  // close on ESC
  useEscClose(onClose);

  if (loading || !form) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 text-white">
        Loading category…
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-5xl rounded shadow-lg p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">Edit Category</h2>

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

          {/* Uploads with previews */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div>
              <label className="block mb-1">Thumbnail</label>
              {form.thumb_url ? (
                <img
                  src={form.thumb_url}
                  alt="Thumb"
                  className="w-32 h-32 object-cover border rounded mb-2"
                />
              ) : (
                <div className="w-32 h-32 border rounded mb-2 flex items-center justify-center text-xs text-gray-500">
                  No thumbnail
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => pickThumb(e.target.files?.[0] || null)}
              />
              {form.thumb_url && (
                <button
                  type="button"
                  className="border px-2 py-1 rounded"
                  onClick={clearThumb}
                >
                  Remove
                </button>
              )}
            </div>

            <div>
              <label className="block mb-1">Top Banner</label>
              {form.top_banner_url ? (
                <img
                  src={form.top_banner_url}
                  alt="Top banner"
                  className="w-48 h-24 object-cover border rounded mb-2"
                />
              ) : (
                <div className="w-48 h-24 border rounded mb-2 flex items-center justify-center text-xs text-gray-500">
                  No top banner
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => pickTop(e.target.files?.[0] || null)}
              />
              {form.top_banner_url && (
                <button
                  type="button"
                  className="border px-2 py-1 rounded"
                  onClick={clearTop}
                >
                  Remove
                </button>
              )}
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
              {form.side_banner_url ? (
                <img
                  src={form.side_banner_url}
                  alt="Side banner"
                  className="w-40 h-40 object-cover border rounded mb-2"
                />
              ) : (
                <div className="w-40 h-40 border rounded mb-2 flex items-center justify-center text-xs text-gray-500">
                  No side banner
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => pickSide(e.target.files?.[0] || null)}
              />
              {form.side_banner_url && (
                <button
                  type="button"
                  className="border px-2 py-1 rounded"
                  onClick={clearSide}
                >
                  Remove
                </button>
              )}
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
              {saving ? "Updating..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
