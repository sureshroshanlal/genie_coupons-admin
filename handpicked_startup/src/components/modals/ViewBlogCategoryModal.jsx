// src/pages/modals/ViewBlogCategoryModal.jsx
import React, { useEffect, useState } from "react";
import { getBlogCategory } from "../../services/blogCategoryService";
import useEscClose from "../hooks/useEscClose";

export default function ViewBlogCategoryModal({ categoryId, onClose }) {
  const [cat, setCat] = useState(null);

  useEffect(() => {
    (async () => {
      const data = await getBlogCategory(categoryId);
      setCat(data);
    })();
  }, [categoryId]);

  // close on ESC
  useEscClose(onClose);

  if (!cat) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 text-white">
        Loading category...
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-3xl rounded shadow-lg p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">{cat.name}</h2>

        <p>
          <strong>Slug:</strong> {cat.slug}
        </p>
        <p>
          <strong>Description:</strong> {cat.description || "—"}
        </p>
        <p>
          <strong>SEO Title:</strong> {cat.seo_title}
        </p>
        <p>
          <strong>SEO Keywords:</strong> {cat.seo_keywords}
        </p>
        <p>
          <strong>SEO Description:</strong> {cat.seo_description}
        </p>
        <p>
          <strong>H1 Title:</strong> {cat.h1_title}
        </p>
        <p>
          <strong>Parent ID:</strong> {cat.parent_id || "—"}
        </p>
        <p>
          <strong>Category Order:</strong> {cat.category_order ?? "—"}
        </p>
        <p>
          <strong>Top Category:</strong> {cat.is_top ? "Yes" : "No"}
        </p>
        <p>
          <strong>Sidebar:</strong> {cat.show_in_sidebar ? "Yes" : "No"}
        </p>
        <p>
          <strong>Published:</strong> {cat.is_publish ? "Yes" : "No"}
        </p>

        <div className="flex justify-end mt-6">
          <button onClick={onClose} className="border px-4 py-2 rounded">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
