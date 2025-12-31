// src/components/tags/TagStoresModal.jsx
import React, { useState, useEffect, useRef } from "react";
import {
  getStoresByTag,
  addStoreToTag,
  removeStoreFromTag,
  searchStores,
} from "../../services/tagStoreService";
import useEscClose from "../hooks/useEscClose";

export default function TagStoresModal({ tagId, onClose }) {
  const [linkedStores, setLinkedStores] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedStore, setSelectedStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const searchRef = useRef(null);

  // Fetch linked stores
  useEffect(() => {
    const fetchLinkedStores = async () => {
      const { data, error } = await getStoresByTag(tagId);
      if (error) {
        console.error("Error fetching linked merchants:", error.message);
        setLinkedStores([]);
      } else if (Array.isArray(data)) {
        setLinkedStores(data);
      }
      setLoading(false);
    };
    fetchLinkedStores();
  }, [tagId]);

  // Live search with debounce
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }
    const delayDebounce = setTimeout(async () => {
      const { data, error } = await searchStores(searchTerm);
      console.log("searchResults:", { data, error });
      if (error) {
        console.error("Error searching merchants:", error.message);
        setSearchResults([]);
      } else if (Array.isArray(data)) {
        setSearchResults(data);
      }
    }, 300);
    return () => clearTimeout(delayDebounce);
  }, [searchTerm]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchResults([]);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectStore = (store) => {
    setSelectedStore(store);
    setSearchTerm(store.name);
    setSearchResults([]); // hide dropdown immediately
  };

  const handleAddStore = async () => {
    if (!selectedStore) return;
    setAdding(true);
    const { error } = await addStoreToTag(tagId, selectedStore.id);
    if (error) {
      console.error("Error adding merchant to tag:", error.message);
    } else {
      setLinkedStores((prev) => [...prev, selectedStore]);
      setSelectedStore(null);
      setSearchTerm("");
    }
    setAdding(false);
  };

  const handleRemoveStore = async (storeId) => {
    setRemovingId(storeId);
    const { error } = await removeStoreFromTag(tagId, storeId);
    if (error) {
      console.error("Error removing merchant:", error.message);
    } else {
      setLinkedStores((prev) => prev.filter((s) => s.id !== storeId));
    }
    setRemovingId(null);
  };

  // close on ESC
  useEscClose(onClose);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-3xl p-6 relative">
        <h2 className="text-xl font-semibold mb-4">Manage Merchants for Tag</h2>

        {/* Search */}
        <div className="relative mb-4" ref={searchRef}>
          <input
            type="text"
            placeholder="Search for merchant..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setSelectedStore(null);
            }}
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring focus:border-blue-300"
          />
          {console.log("render searchResults:", searchResults)}
          {searchResults.length > 0 && (
            <ul className="absolute z-10 bg-white border w-full rounded mt-1 max-h-48 overflow-y-auto shadow">
              {searchResults.map((store) => (
                <li
                  key={store.id}
                  onClick={() => handleSelectStore(store)}
                  className="px-3 py-2 text-sm hover:bg-gray-100 cursor-pointer"
                >
                  {store.name}
                  {store.slug && (
                    <span className="ml-2 text-xs text-gray-500">
                      ({store.slug})
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Add store button */}
        <div className="mb-6">
          <button
            type="button"
            onClick={handleAddStore}
            disabled={!selectedStore || adding}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            {adding ? "Adding..." : "Add Merchant"}
          </button>
        </div>

        {/* Linked stores list */}
        <div>
          <h3 className="text-lg font-medium mb-2">Linked Merchants</h3>
          {loading ? (
            <p className="text-sm text-gray-500">Loading Merchants...</p>
          ) : linkedStores.length === 0 ? (
            <p className="text-sm text-gray-500">
              No Merchant linked to this tag.
            </p>
          ) : (
            <ul className="divide-y">
              {linkedStores.map((store) => (
                <li
                  key={store.id}
                  className="flex justify-between items-center py-2"
                >
                  <span>{store.name}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveStore(store.id)}
                    disabled={removingId === store.id}
                    className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-gray-400 text-sm"
                  >
                    {removingId === store.id ? "Removing..." : "Remove"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Close button */}
        <div className="flex justify-end gap-3 pt-4 border-t mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
