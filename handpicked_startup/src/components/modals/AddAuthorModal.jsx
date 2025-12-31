import React, { useState } from "react";
import { createAuthor } from "../../services/authorService";
import useEscClose from "../hooks/useEscClose";

export default function AddAuthorModal({ onClose, onSave }) {
  const [form, setForm] = useState({ name: "", email: "", is_active: true });
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name) return;
    setSaving(true);
    const payload = {
      name: form.name,
      email: form.email || null,
      is_active: !!form.is_active,
    };
    const { error } = await createAuthor(payload);
    setSaving(false);
    if (!error) {
      onSave?.();
      onClose();
    }
  };

   // close on ESC
  useEscClose(onClose);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-lg rounded shadow-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Add Author</h2>
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
              className="bg-green-600 text-white px-4 py-2 rounded disabled:bg-gray-400"
            >
              {saving ? "Saving..." : "Add Author"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
