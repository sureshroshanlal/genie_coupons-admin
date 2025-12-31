// src/pages/TagsPage.jsx
import React, { useEffect, useState } from "react";
import { FaPlus, FaEdit, FaTrash, FaStore } from "react-icons/fa";
import AddTagModal from "../components/modals/AddTagModal";
import EditTagModal from "../components/modals/EditTagModal";
import TagStoresModal from "../components/modals/TagStoresModal";
import { getTags, deleteTag } from "../services/tagService";

export default function TagsPage() {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showStoresModal, setShowStoresModal] = useState(false);

  const [selectedTag, setSelectedTag] = useState(null);

  // Fetch tags
  const fetchTags = async () => {
    setLoading(true);
    // UPDATED: Using new { data, error } structure
    const { data, error } = await getTags();
    if (error) {
      console.error("Error fetching tags:", error.message);
      setTags([]);
    } else {
      setTags(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTags();
  }, []);

  const handleAddClick = () => {
    setSelectedTag(null);
    setShowAddModal(true);
  };

  const handleEditClick = (tag) => {
    setSelectedTag(tag);
    setShowEditModal(true);
  };

  const handleStoresClick = (tagId) => {
    setSelectedTag(tagId);
    setShowStoresModal(true);
  };

  const handleDeleteClick = async (tagId) => {
    if (window.confirm("Are you sure you want to delete this tag?")) {
      // UPDATED: Using new { data, error } structure
      const { error } = await deleteTag(tagId);
      if (error) {
        console.error("Delete failed:", error.message);
      } else {
        fetchTags();
      }
    }
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Tags</h1>
        <button
          onClick={handleAddClick}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
        >
          <FaPlus /> Add Tag
        </button>
      </div>

      {loading ? (
        <p>Loading tags...</p>
      ) : tags.length === 0 ? (
        <p>No tags found.</p>
      ) : (
        <div className="overflow-x-auto bg-white shadow rounded">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 text-gray-700 uppercase text-xs">
              <tr>
                <th className="px-4 py-2 text-left">ID</th>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">Slug</th>
                <th className="px-4 py-2 text-left">Parent Tag</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tags.map((tag) => (
                <tr
                  key={tag.id}
                  className="border-b hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-2">{tag.id}</td>
                  <td className="px-4 py-2">{tag.name}</td>
                  <td className="px-4 py-2">{tag.slug}</td>
                  <td className="px-4 py-2">
                    {tag.parentTagName || <em>None</em>}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        tag.isActive
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {tag.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-2 flex justify-center gap-3">
                    <button
                      onClick={() => handleEditClick(tag)}
                      className="text-blue-600 hover:text-blue-800"
                      title="Edit Tag"
                    >
                      <FaEdit />
                    </button>
                    <button
                      onClick={() => handleStoresClick(tag.id)}
                      className="text-blue-500 hover:text-blue-700"
                      title="View Stores"
                    >
                      <FaStore />
                    </button>
                    <button
                      onClick={() => handleDeleteClick(tag.id)}
                      className="text-red-600 hover:text-red-800"
                      title="Delete Tag"
                    >
                      <FaTrash />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Tag Modal */}
      {showAddModal && (
        <AddTagModal
          onClose={() => setShowAddModal(false)}
          onSave={fetchTags}
        />
      )}

      {/* Edit Tag Modal */}
      {showEditModal && selectedTag && (
        <EditTagModal
          tag={selectedTag}
          onClose={() => setShowEditModal(false)}
          onSave={fetchTags}
        />
      )}

      {/* Tag Stores Modal */}
      {showStoresModal && selectedTag && (
        <TagStoresModal
          tagId={selectedTag}
          onClose={() => setShowStoresModal(false)}
        />
      )}
    </div>
  );
}