// src/components/blogs/ViewBlogModal.jsx
import React, { useEffect, useState } from "react";
import { getBlog } from "../../services/blogService";
import useEscClose from "../hooks/useEscClose";
import DOMPurify from "dompurify";

export default function ViewBlogModal({ blogId, onClose }) {
  const [blog, setBlog] = useState(null);

  useEffect(() => {
    (async () => {
      const data = await getBlog(blogId);
      setBlog(data);
    })();
  }, [blogId]);

  // close on ESC
  useEscClose(onClose);

  if (!blog) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 text-white">
        Loading blog...
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-3xl rounded shadow-lg p-6 max-h-[90vh] overflow-y-auto">
        {/* Title */}
        <h2 className="text-xl font-bold mb-4">{blog.title}</h2>

        {/* Meta info (basic) */}
        <p className="text-sm text-gray-500 mb-1">Slug: {blog.slug}</p>
        <p className="text-sm text-gray-500 mb-1">
          Category: {blog.category?.name ?? blog.category_name ?? "—"}
        </p>
        <p className="text-sm text-gray-500 mb-4">
          Author: {blog.author?.name ?? blog.author_name ?? "—"}
        </p>

        {/* Blog Content */}
        <div
          className="my-6 prose max-w-none prose-img:rounded prose-img:max-h-[400px] prose-img:object-contain"
          dangerouslySetInnerHTML={{
            __html: DOMPurify.sanitize(blog.content || ""),
          }}
        />

        {/* Featured Images */}
        {blog.featured_thumb && (
          <div className="my-4">
            <strong>Featured Thumb:</strong>
            <img
              src={blog.featured_thumb}
              alt="Thumb"
              className="mt-2 max-h-40 object-cover rounded border"
            />
          </div>
        )}
        {blog.featured_image && (
          <div className="my-4">
            <strong>Featured Image:</strong>
            <img
              src={blog.featured_image}
              alt="Featured"
              className="mt-2 max-h-60 object-cover rounded border"
            />
          </div>
        )}

        {/* SEO Meta */}
        <div className="mt-4 text-sm">
          <p>
            <strong>Meta Title:</strong> {blog.meta_title}
          </p>
          <p>
            <strong>Meta Keywords:</strong> {blog.meta_keywords}
          </p>
          <p>
            <strong>Meta Description:</strong> {blog.meta_description}
          </p>
        </div>

        {/* Status */}
        <div className="mt-4 text-sm">
          <p>
            <strong>Published:</strong> {blog.is_publish ? "Yes" : "No"}
          </p>
          <p>
            <strong>Featured:</strong> {blog.is_featured ? "Yes" : "No"}
          </p>
          <p>
            <strong>Top:</strong> {blog.is_top ? "Yes" : "No"}
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="border px-4 py-2 rounded hover:bg-gray-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
