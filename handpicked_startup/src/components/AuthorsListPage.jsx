import React, { useEffect, useState } from "react";
import {
  listAuthors,
  deleteAuthor,
  updateAuthorStatus,
} from "../services/authorService.js";
import AddAuthorModal from "../components/modals/AddAuthorModal";
import EditAuthorModal from "../components/modals/EditAuthorModal";
import ViewAuthorModal from "../components/modals/ViewAuthorModal";

export default function AuthorsListPage() {
  const [rows, setRows] = useState([]);
  const [qName, setQName] = useState("");
  const [qEmail, setQEmail] = useState("");
  const [loading, setLoading] = useState(true);

  const [showAdd, setShowAdd] = useState(false);
  const [viewId, setViewId] = useState(null);
  const [editId, setEditId] = useState(null);

  const fetchRows = async () => {
    setLoading(true);
    const params = {};
    if (qName) params.name = qName;
    if (qEmail) params.email = qEmail;
    const { data } = await listAuthors(params);
    setRows(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => {
    fetchRows();
  }, []);

  const handleToggle = async (id, isActive) => {
    if (
      !window.confirm(
        `Mark this author as ${isActive ? "Inactive" : "Active"}?`
      )
    )
      return;
    const { error } = await updateAuthorStatus(id, !isActive);
    if (!error) fetchRows();
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this author?")) return;
    const { error } = await deleteAuthor(id);
    if (!error) fetchRows();
  };

  return (
    <div className="p-4">
      <div className="flex justify-between mb-4">
        <h1 className="text-xl font-semibold">Authors</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
        >
          + Add
        </button>
      </div>
      <div className="mb-4 flex gap-2">
        <input
          className="border px-3 py-2 rounded"
          placeholder="Search by name"
          value={qName}
          onChange={(e) => setQName(e.target.value)}
        />
        <input
          className="border px-3 py-2 rounded"
          placeholder="Search by email"
          value={qEmail}
          onChange={(e) => setQEmail(e.target.value)}
        />
        <button onClick={fetchRows} className="px-3 py-2 border rounded">
          Apply
        </button>
        <button
          onClick={() => {
            setQName("");
            setQEmail("");
            fetchRows();
          }}
          className="px-3 py-2 border rounded"
        >
          Reset
        </button>
      </div>

      <div className="bg-white rounded shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 text-left">Id</th>
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Email</th>
              <th className="p-3 text-left">Active</th>
              <th className="p-3 text-left">Created</th>
              <th className="p-3 text-left">Updated</th>
              <th className="p-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="p-4">
                  Loading...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-4">
                  No records found
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3">{r.id}</td>
                  <td className="p-3">{r.name}</td>
                  <td className="p-3">{r.email || "—"}</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-1 text-xs rounded ${
                        r.is_active
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {r.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="p-3">
                    {r.created_at
                      ? new Date(r.created_at).toLocaleString()
                      : "—"}
                  </td>
                  <td className="p-3">
                    {r.updated_at
                      ? new Date(r.updated_at).toLocaleString()
                      : "—"}
                  </td>
                  <td className="p-3 flex gap-2 items-center">
                    <button
                      onClick={() => handleToggle(r.id, r.is_active)}
                      className="px-2 py-1 text-xs rounded border"
                    >
                      Toggle
                    </button>
                    <button
                      onClick={() => setViewId(r.id)}
                      className="px-2 py-1 text-xs text-white bg-gray-600 rounded hover:bg-gray-700"
                    >
                      View
                    </button>
                    <button
                      onClick={() => setEditId(r.id)}
                      className="px-2 py-1 text-xs text-white bg-blue-600 rounded hover:bg-blue-700"
                    >
                      Edit
                    </button>
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

      {showAdd && (
        <AddAuthorModal onClose={() => setShowAdd(false)} onSave={fetchRows} />
      )}
      {viewId && (
        <ViewAuthorModal authorId={viewId} onClose={() => setViewId(null)} />
      )}
      {editId && (
        <EditAuthorModal
          authorId={editId}
          onClose={() => setEditId(null)}
          onSave={fetchRows}
        />
      )}
    </div>
  );
}
