import React, { useEffect, useState } from "react";
import {
  listBlogCategories,
  createBlogCategory,
} from "../../services/blogCategoryService";
import useEscClose from "../hooks/useEscClose";

export default function AddBlogCategoryModal({ onClose, onSave }) {
  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    seo_title: "",
    seo_keywords: "",
    seo_description: "",
    h1_title: "",
    parent_id: "",
    category_order: "",
    is_top: false,
    show_in_sidebar: false,
    is_publish: false,
  });
  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loadingCats, setLoadingCats] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await listBlogCategories();
      setCategories(Array.isArray(data) ? data : []);
      setLoadingCats(false);
    })();
  }, []);

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
    if (!form.name || !form.slug) return;

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

    const { error } = await createBlogCategory(payload);
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

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-4xl rounded shadow-lg p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">Add Blog Category</h2>
        {/* Form fields same as earlier example */}
        {/* ... */}
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
            onClick={handleSubmit}
            className="bg-blue-600 text-white px-4 py-2 rounded disabled:bg-gray-400"
          >
            {saving ? "Saving..." : "Add Category"}
          </button>
        </div>
      </div>
    </div>
  );
}
