import React, { useEffect, useState } from "react";
import { getAuthor, updateAuthor } from "../../services/authorService";
import useEscClose from "../hooks/useEscClose";

export default function EditAuthorModal({ authorId, onClose, onSave }) {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const a = await getAuthor(authorId);
      if (!mounted) return;
      setForm({
        name: a?.name || "",
        email: a?.email || "",
        is_active: !!a?.is_active,
      });
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [authorId]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form?.name) return;
    setSaving(true);
    const payload = {
      name: form.name,
      email: form.email || null,
      is_active: !!form.is_active,
    };
    const { error } = await updateAuthor(authorId, payload);
    setSaving(false);
    if (!error) {
      onSave?.();
      onClose();
    }
  };

  // close on ESC
  useEscClose(onClose);

  if (loading || !form) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 text-white">
        Loading author...
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-lg rounded shadow-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Edit Author</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label>Name *</label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              className="w-full border px-3 py-2 rounded"
              required
            />
          </div>
          <div>
            <label>Email</label>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              className="w-full border px-3 py-2 rounded"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              name="is_active"
              checked={form.is_active}
              onChange={handleChange}
            />
            <span>Active</span>
          </div>
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
