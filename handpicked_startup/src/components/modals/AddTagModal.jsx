// src/components/tags/AddTagModal.jsx
import { useState, useEffect } from "react";
import { getTags, createTagWithImage } from "../../services/tagService";
import useEscClose from "../hooks/useEscClose";

export default function AddTagModal({ onClose, onSave }) {
  const [formData, setFormData] = useState({
    tag_name: "",
    slug: "",
    parent_id: "",
    active: true,
    display_order: 0,
    meta_title: "",
    meta_description: "",
    meta_keywords: "",
    image: null,
  });

  const [tags, setTags] = useState([]);
  const [loadingTags, setLoadingTags] = useState(true); // UPDATED
  const [saving, setSaving] = useState(false); // UPDATED

  // UPDATED: Fetch tags for parent dropdown using service
  useEffect(() => {
    const fetchTagsList = async () => {
      const { data, error } = await getTags();
      if (error) {
        console.error("Error fetching parent tags:", error.message);
        setTags([]);
      } else if (Array.isArray(data)) {
        setTags(data);
      }
      setLoadingTags(false);
    };
    fetchTagsList();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : files ? files[0] : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true); // UPDATED
    const payload = new FormData();
    Object.keys(formData).forEach((key) => {
      payload.append(key, formData[key]);
    });

    // UPDATED: Use createTagWithImage service function
    const { error } = await createTagWithImage(payload);
    if (error) {
      console.error("Error creating tag:", error.message);
    } else {
      if (typeof onSave === "function") onSave(); // refresh or reload tags in parent
      onClose();
    }
    setSaving(false);
  };
0
  // close on ESC
  useEscClose(onClose);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-3xl p-6 overflow-y-auto max-h-screen">
        <h2 className="text-xl font-bold mb-4">Add Tag</h2>
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          {/* Tag Name */}
          <div>
            <label className="block font-medium mb-1">Tag Name</label>
            <input
              type="text"
              name="tag_name"
              value={formData.tag_name}
              onChange={handleChange}
              className="w-full border rounded p-2"
              required
            />
          </div>

          {/* Slug */}
          <div>
            <label className="block font-medium mb-1">Slug</label>
            <input
              type="text"
              name="slug"
              value={formData.slug}
              onChange={handleChange}
              className="w-full border rounded p-2"
              required
            />
          </div>

          {/* Parent Tag */}
          <div>
            <label className="block font-medium mb-1">Parent Tag</label>
            {loadingTags ? (
              <p className="text-sm text-gray-500">Loading tags...</p>
            ) : (
              <select
                name="parent_id"
                value={formData.parent_id}
                onChange={handleChange}
                className="w-full border rounded p-2"
              >
                <option value="">None</option>
                {tags.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.tag_name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Active */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              name="active"
              checked={formData.active}
              onChange={handleChange}
            />
            <label className="font-medium">Active</label>
          </div>

          {/* Display Order */}
          <div>
            <label className="block font-medium mb-1">Display Order</label>
            <input
              type="number"
              name="display_order"
              value={formData.display_order}
              onChange={handleChange}
              className="w-full border rounded p-2"
            />
          </div>

          {/* Meta Title */}
          <div>
            <label className="block font-medium mb-1">Meta Title</label>
            <input
              type="text"
              name="meta_title"
              value={formData.meta_title}
              onChange={handleChange}
              className="w-full border rounded p-2"
            />
          </div>

          {/* Meta Description */}
          <div className="md:col-span-2">
            <label className="block font-medium mb-1">Meta Description</label>
            <textarea
              name="meta_description"
              value={formData.meta_description}
              onChange={handleChange}
              className="w-full border rounded p-2"
              rows={3}
            />
          </div>

          {/* Meta Keywords */}
          <div className="md:col-span-2">
            <label className="block font-medium mb-1">Meta Keywords</label>
            <input
              type="text"
              name="meta_keywords"
              value={formData.meta_keywords}
              onChange={handleChange}
              className="w-full border rounded p-2"
              placeholder="comma,separated,keywords"
            />
          </div>

          {/* Image Upload */}
          <div className="md:col-span-2">
            <label className="block font-medium mb-1">Tag Image</label>
            <input
              type="file"
              name="image"
              accept="image/*"
              onChange={handleChange}
              className="w-full"
            />
          </div>

          {/* Actions */}
          <div className="md:col-span-2 flex justify-end space-x-2 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="bg-gray-200 px-4 py-2 rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 text-white px-4 py-2 rounded"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
