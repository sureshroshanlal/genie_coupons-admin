// src/components/blogs/EditBlogModal.jsx
import React, { useState, useEffect, useRef } from "react";
import {
  getBlog,
  updateBlog,
  fetchBlogAux,
  uploadBlogImage,
} from "../../services/blogService";
import useEscClose from "../hooks/useEscClose";
import SafeQuill from "../common/SafeQuill.jsx";

export default function EditBlogModal({ blogId, onClose, onSave }) {
  const [form, setForm] = useState(null);
  const [thumb, setThumb] = useState(null);
  const [image, setImage] = useState(null);
  const [categories, setCategories] = useState([]);
  const [authors, setAuthors] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingAux, setLoadingAux] = useState(true);

  const quillRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const aux = await fetchBlogAux();
        if (!mounted) return;
        setCategories(Array.isArray(aux?.categories) ? aux.categories : []);
        setAuthors(Array.isArray(aux?.authors) ? aux.authors : []);
        setLoadingAux(false);

        const blog = await getBlog(blogId);
        if (!mounted) return;

        setForm({
          id: blog?.id,
          title: blog?.title || "",
          slug: blog?.slug || "",
          category_id: blog?.category_id || "",
          author_id: blog?.author_id || "",
          content: blog?.content || "",
          meta_title: blog?.meta_title || "",
          meta_keywords: blog?.meta_keywords || "",
          meta_description: blog?.meta_description || "",
          is_publish: !!blog?.is_publish,
          is_featured: !!blog?.is_featured,
          is_top: !!blog?.is_top,
          featured_thumb_url: blog?.featured_thumb_url || "",
          featured_image_url: blog?.featured_image_url || "",
        });
      } catch (e) {
        console.error("Failed to load blog or aux:", e?.message || e);
        setForm({
          title: "",
          slug: "",
          category_id: "",
          author_id: "",
          content: "",
          meta_title: "",
          meta_keywords: "",
          meta_description: "",
          is_publish: false,
          is_featured: false,
          is_top: false,
        });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [blogId]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  };

  const handleTitleBlur = () => {
    const t = String(form?.title || "").trim();
    if (!form.slug && t) {
      const slug = t
        .toLowerCase()
        .replace(/['"]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      setForm((f) => ({ ...f, slug }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form?.title || !form?.slug) return;
    setSaving(true);

    const fd = new FormData();
    fd.append("title", form.title);
    fd.append("slug", form.slug);
    fd.append("content", form.content || "");
    fd.append("meta_title", form.meta_title || "");
    fd.append("meta_keywords", form.meta_keywords || "");
    fd.append("meta_description", form.meta_description || "");
    fd.append("is_publish", String(!!form.is_publish));
    fd.append("is_featured", String(!!form.is_featured));
    fd.append("is_top", String(!!form.is_top));
    if (form.category_id) fd.append("category_id", String(form.category_id));
    if (form.author_id) fd.append("author_id", String(form.author_id));
    if (thumb) fd.append("featured_thumb", thumb);
    if (image) fd.append("featured_image", image);

    const { error } = await updateBlog(blogId, fd);
    setSaving(false);
    if (!error) {
      onSave?.();
      onClose();
    } else {
      console.error("Error updating blog:", error.message);
    }
  };

  // ✅ custom image handler
  const imageHandler = () => {
    const input = document.createElement("input");
    input.setAttribute("type", "file");
    input.setAttribute("accept", "image/*");
    input.click();

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      try {
        const url = await uploadBlogImage(file);
        if (url) {
          const editor = quillRef.current?.getEditor();
          const range = editor.getSelection(true);
          editor.insertEmbed(range.index, "image", url);
          editor.setSelection(range.index + 1);
        }
      } catch (err) {
        console.error("Image upload failed:", err);
        alert("Image upload failed. Please try again.");
      }
    };
  };

  const formats = [
    "header",
    "bold",
    "italic",
    "underline",
    "strike",
    "list",
    "link",
    "image",
  ];

  const modules = {
    toolbar: {
      container: [
        [{ header: [1, 2, 3, false] }],
        ["bold", "italic", "underline", "strike"],
        [{ list: "ordered" }, { list: "bullet" }],
        ["link", "image"],
        ["clean"],
      ],
      handlers: { image: imageHandler },
    },
    history: {
      delay: 500,
      maxStack: 200,
      userOnly: true,
    },
    keyboard: {
      bindings: {
        undo: {
          key: "z",
          shortKey: true,
          handler() {
            this.quill.history.undo();
          },
        },
        redo: {
          key: "y",
          shortKey: true,
          handler() {
            this.quill.history.redo();
          },
        },
        redoMac: {
          key: "z",
          shortKey: true,
          shiftKey: true,
          handler() {
            this.quill.history.redo();
          },
        },
      },
    },
  };

  // ✅ Direct keydown fallback to guarantee undo/redo
  useEffect(() => {
    const editor = quillRef.current?.getEditor?.();
    if (!editor) return;

    const root = editor.root;
    const history = editor.getModule("history");
    const isMac =
      typeof navigator !== "undefined" &&
      /Mac|iPod|iPhone|iPad/.test(navigator.platform);

    const onKeyDown = (e) => {
      const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;
      if (!ctrlOrCmd) return;

      const key = e.key?.toLowerCase?.();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        history.undo();
      } else if (key === "y" || (key === "z" && e.shiftKey)) {
        e.preventDefault();
        history.redo();
      }
    };

    root.addEventListener("keydown", onKeyDown);
    return () => root.removeEventListener("keydown", onKeyDown);
  }, [quillRef]);

  useEscClose(onClose);

  if (loading || !form) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 text-white">
        Loading blog...
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-4xl rounded shadow-lg p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">Edit Blog</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title & Slug */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label>Title</label>
              <input
                name="title"
                value={form.title}
                onChange={handleChange}
                onBlur={handleTitleBlur}
                className="w-full border px-3 py-2 rounded"
                required
              />
            </div>
            <div>
              <label>Slug</label>
              <input
                name="slug"
                value={form.slug}
                onChange={handleChange}
                className="w-full border px-3 py-2 rounded"
                required
              />
            </div>
          </div>

          {/* Category & Author */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label>Blog Category</label>
              {loadingAux ? (
                <div className="text-sm text-gray-500">Loading categories…</div>
              ) : (
                <select
                  name="category_id"
                  value={form.category_id}
                  onChange={handleChange}
                  className="w-full border px-3 py-2 rounded"
                >
                  <option value="">Select</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label>Blog Author</label>
              {loadingAux ? (
                <div className="text-sm text-gray-500">Loading authors…</div>
              ) : (
                <select
                  name="author_id"
                  value={form.author_id}
                  onChange={handleChange}
                  className="w-full border px-3 py-2 rounded"
                >
                  <option value="">Select</option>
                  {authors.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name ||
                        a.full_name ||
                        a.display_name ||
                        `Author #${a.id}`}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Content */}
          <div>
            <label>Content</label>
            <div
              className="h-80 border rounded bg-white
                        [&_.ql-container]:h-full
                        [&_.ql-editor]:h-full
                        [&_.ql-editor]:overflow-y-auto"
            >
              <SafeQuill
                ref={quillRef}
                theme="snow"
                value={form.content}
                onChange={(val) => setForm((f) => ({ ...f, content: val }))}
                modules={modules}
                formats={formats}
                className="h-full"
              />
            </div>
          </div>

          {/* Meta fields */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label>Meta Title</label>
              <input
                name="meta_title"
                value={form.meta_title}
                onChange={handleChange}
                className="w-full border px-3 py-2 rounded"
              />
            </div>
            <div>
              <label>Meta Keywords</label>
              <input
                name="meta_keywords"
                value={form.meta_keywords}
                onChange={handleChange}
                className="w-full border px-3 py-2 rounded"
              />
            </div>
            <div>
              <label>Meta Description</label>
              <input
                name="meta_description"
                value={form.meta_description}
                onChange={handleChange}
                className="w-full border px-3 py-2 rounded"
              />
            </div>
          </div>

          {/* File uploads */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block mb-1">Featured Thumb (optional)</label>
              {form.featured_thumb_url ? (
                <img
                  src={form.featured_thumb_url}
                  alt="Featured thumb"
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
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  setThumb(f);
                  if (f) {
                    const url = URL.createObjectURL(f);
                    setForm((prev) => ({ ...prev, featured_thumb_url: url }));
                  }
                }}
              />
            </div>
            <div>
              <label className="block mb-1">Featured Image (optional)</label>
              {form.featured_image_url ? (
                <img
                  src={form.featured_image_url}
                  alt="Featured image"
                  className="w-48 h-32 object-cover border rounded mb-2"
                />
              ) : (
                <div className="w-48 h-32 border rounded mb-2 flex items-center justify-center text-xs text-gray-500">
                  No image
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  setImage(f);
                  if (f) {
                    const url = URL.createObjectURL(f);
                    setForm((prev) => ({ ...prev, featured_image_url: url }));
                  }
                }}
              />
            </div>
          </div>

          {/* Toggles */}
          <div className="flex gap-6">
            <label className="flex gap-2 items-center">
              <input
                type="checkbox"
                name="is_publish"
                checked={!!form.is_publish}
                onChange={handleChange}
              />
              Publish
            </label>
            <label className="flex gap-2 items-center">
              <input
                type="checkbox"
                name="is_featured"
                checked={!!form.is_featured}
                onChange={handleChange}
              />
              Featured
            </label>
            <label className="flex gap-2 items-center">
              <input
                type="checkbox"
                name="is_top"
                checked={!!form.is_top}
                onChange={handleChange}
              />
              Top
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
              {saving ? "Updating..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
