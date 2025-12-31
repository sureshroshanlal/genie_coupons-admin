// src/pages/blogs/BlogCategoriesListPage.jsx
import React, { useEffect, useState } from "react";
import {
  listBlogCategories,
  deleteBlogCategory,
  updateBlogCategoryStatus,
} from "../services/blogCategoryService.js";
import AddBlogCategoryModal from "../components/modals/AddBlogCategoryModal.jsx";
import ViewBlogCategoryModal from "../components/modals/ViewBlogCategoryModal.jsx";
import EditBlogCategoryModal from "../components/modals/EditBlogCategoryModal.jsx";

export default function BlogCategoriesListPage() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showAdd, setShowAdd] = useState(false);
  const [viewCatId, setViewCatId] = useState(null);
  const [editCatId, setEditCatId] = useState(null);

  const fetchRows = async () => {
    setLoading(true);
    const params = q ? { name: q } : {};
    const { data } = await listBlogCategories(params);
    setRows(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => {
    fetchRows();
  }, []);

  const handleToggle = async (id, current) => {
    if (
      !window.confirm(
        `Mark this category as ${current ? "Inactive" : "Active"}?`
      )
    )
      return;
    const { error } = await updateBlogCategoryStatus(id, !current);
    if (!error) fetchRows();
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this category?")) return;
    const { error } = await deleteBlogCategory(id);
    if (!error) fetchRows();
  };

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex justify-between mb-4">
        <h1 className="text-xl font-semibold">Blog Categories</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
        >
          + Add Category
        </button>
      </div>

      {/* Search */}
      <div className="mb-4 flex gap-2">
        <input
          className="border px-3 py-2 rounded"
          placeholder="Search by name"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button onClick={fetchRows} className="px-3 py-2 border rounded">
          Search
        </button>
        <button
          onClick={() => {
            setQ("");
            fetchRows();
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
              <th className="p-3 text-left">Id</th>
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Top Category</th>
              <th className="p-3 text-left">Order</th>
              <th className="p-3 text-left">Blogs</th>
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
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-4">
                  No records found
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3">{r.id}</td>
                  <td className="p-3">{r.name}</td>
                  <td className="p-3">{r.is_top ? "Yes" : "No"}</td>
                  <td className="p-3">{r.category_order ?? 0}</td>
                  <td className="p-3">
                    <button className="text-blue-600 hover:underline">
                      View Blogs
                    </button>
                  </td>
                  <td className="p-3 flex gap-2 items-center">
                    {/* Status toggle */}
                    <button
                      onClick={() => handleToggle(r.id, r.is_publish)}
                      className={`px-2 py-1 text-xs rounded ${
                        r.is_publish
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {r.is_publish ? "Active" : "Inactive"}
                    </button>
                    {/* View */}
                    <button
                      onClick={() => setViewCatId(r.id)}
                      className="px-2 py-1 text-xs text-white bg-gray-600 rounded hover:bg-gray-700"
                    >
                      View
                    </button>
                    {/* Edit */}
                    <button
                      onClick={() => setEditCatId(r.id)}
                      className="px-2 py-1 text-xs text-white bg-blue-600 rounded hover:bg-blue-700"
                    >
                      Edit
                    </button>
                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(r.id)}
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
        <AddBlogCategoryModal
          onClose={() => setShowAdd(false)}
          onSave={fetchRows}
        />
      )}
      {viewCatId && (
        <ViewBlogCategoryModal
          categoryId={viewCatId}
          onClose={() => setViewCatId(null)}
        />
      )}
      {editCatId && (
        <EditBlogCategoryModal
          categoryId={editCatId}
          onClose={() => setEditCatId(null)}
          onSave={fetchRows}
        />
      )}
    </div>
  );
}
