// src/pages/blogs/BlogsListPage.jsx
import React, { useState, useEffect } from "react";
import {
  listBlogs,
  deleteBlog,
  updateBlogStatus,
} from "../services/blogService.js";
import AddBlogModal from "../components/modals/AddBlogModal.jsx";
import ViewBlogModal from "../components/modals/ViewBlogModal.jsx";
import EditBlogModal from "../components/modals/EditBlogModal.jsx";

export default function BlogsListPage() {
  const [blogs, setBlogs] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showAdd, setShowAdd] = useState(false);
  const [viewBlogId, setViewBlogId] = useState(null);
  const [editBlogId, setEditBlogId] = useState(null);

  const fetchBlogs = async () => {
    setLoading(true);
    const { data } = await listBlogs(q ? { title: q } : {});
    setBlogs(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => {
    fetchBlogs();
  }, []);

  const handleToggleStatus = async (id, currentStatus) => {
    if (
      !window.confirm(
        `Mark this blog as ${currentStatus ? "Inactive" : "Active"}?`
      )
    )
      return;
    const { error } = await updateBlogStatus(id, !currentStatus);
    if (!error) fetchBlogs();
  };

  const handleViewBlog = (id) => {
    setViewBlogId(id);
  };

  const handleEditBlog = (id) => {
    setEditBlogId(id);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this blog?")) return;
    const { error } = await deleteBlog(id);
    if (!error) fetchBlogs();
  };

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex justify-between mb-4">
        <h1 className="text-xl font-semibold">Blog List</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
        >
          + Add Blog
        </button>
      </div>

      {/* Search */}
      <div className="mb-4 flex gap-2">
        <input
          className="border px-3 py-2 rounded"
          placeholder="Search by title"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button onClick={fetchBlogs} className="px-3 py-2 border rounded">
          Search
        </button>
        <button
          onClick={() => {
            setQ("");
            fetchBlogs();
          }}
          className="px-3 py-2 border rounded"
        >
          Reset
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 text-left">ID</th>
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Top Category</th>
              <th className="p-3 text-left">Category Order</th>
              <th className="p-3 text-left">Blogs</th>
              <th className="p-3 text-left">Category</th>
              <th className="p-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="p-4">
                  Loading...
                </td>
              </tr>
            ) : blogs.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-4">
                  No records found
                </td>
              </tr>
            ) : (
              blogs.map((b) => (
                <tr key={b.id} className="border-t">
                  <td className="p-3">{b.id}</td>
                  <td className="p-3">{b.title}</td>
                  <td className="p-3">
                    {b.category?.is_top ? "true" : "false"}
                  </td>
                  <td className="p-3">{b.category?.category_order ?? 0}</td>
                  <td className="p-3">{b.blogs_count ?? 0}</td>
                  <td className="p-3">{b.category_name ?? b.top_category_name ?? "---"}</td>
                  <td className="p-3 flex gap-2 items-center">
                    {/* Status toggle */}
                    <button
                      onClick={() => handleToggleStatus(b.id, b.is_publish)}
                      className={`px-2 py-1 text-xs rounded ${
                        b.is_publish
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {b.is_publish ? "Active" : "Inactive"}
                    </button>
                    {/* View */}
                    <button
                      onClick={() => handleViewBlog(b.id)}
                      className="px-2 py-1 text-xs text-white bg-gray-600 rounded hover:bg-gray-700"
                    >
                      View
                    </button>
                    {/* Edit */}
                    <button
                      onClick={() => handleEditBlog(b.id)}
                      className="px-2 py-1 text-xs text-white bg-blue-600 rounded hover:bg-blue-700"
                    >
                      Edit
                    </button>
                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(b.id)}
                      className="px-2 py-1 text-xs text-white bg-red-600 rounded hover:bg-red-700"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {showAdd && (
        <AddBlogModal onClose={() => setShowAdd(false)} onSave={fetchBlogs} />
      )}

      {viewBlogId && (
        <ViewBlogModal
          blogId={viewBlogId}
          onClose={() => setViewBlogId(null)}
        />
      )}

      {editBlogId && (
        <EditBlogModal
          blogId={editBlogId}
          onClose={() => setEditBlogId(null)}
          onSave={fetchBlogs}
        />
      )}
    </div>
  );
}
