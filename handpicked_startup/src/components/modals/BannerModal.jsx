import React, { useEffect, useState, useRef } from "react";
import {
  addBanner,
  getBanner,
  updateBanner,
} from "../../services/bannersService";
import { listMerchants } from "../../services/merchantService";
import useEscClose from "../hooks/useEscClose";

export default function BannerModal({ id, onClose }) {
  const isEdit = !!id;

  const [form, setForm] = useState({
    store_id: "",
    alt_text: "",
    label: "",
    aff_url: "",
    display_order: 0,
    is_active: true,
  });

  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [busy, setBusy] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    document.body.classList.add("modal-open");
    return () => document.body.classList.remove("modal-open");
  }, []);

  // Load banner for edit
  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        const row = await getBanner(id);
        if (!row) return;
        setForm({
          store_id: String(row.store_id ?? ""),
          alt_text: row.alt_text || "",
          label: row.label || "",
          aff_url: row.click_url || "",
          display_order: row.display_order ?? 0,
          is_active: row.is_active ?? true,
        });
        setSearch(row.store_name || "");
        setPreviewUrl(row.image_url || null);
      } catch (err) {
        console.error("Load banner failed:", err);
      }
    })();
  }, [id, isEdit]);

  // Store async search
  useEffect(() => {
    if (search.length < 3) {
      setSearchResults([]);
      return;
    }
    (async () => {
      setSearchLoading(true);
      const res = await listMerchants({ name: search, limit: 10 });
      setSearchResults(
        (res?.data || []).map((m) => ({
          id: String(m.id),
          name: m.name,
          aff_url: m.aff_url || "",
          web_url: m.web_url || "",
        })),
      );
      setHighlightIndex(-1);
      setSearchLoading(false);
    })();
  }, [search]);

  const selectStore = (store) => {
    setForm((prev) => ({
      ...prev,
      store_id: store.id,
      // aff_url priority
      aff_url: store.aff_url || store.web_url || prev.aff_url,
    }));
    setSearch(store.name);
    setSearchResults([]);
    setHighlightIndex(-1);
  };

  const onSearchKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, searchResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && highlightIndex >= 0) {
      e.preventDefault();
      selectStore(searchResults[highlightIndex]);
    } else if (e.key === "Escape") {
      setSearch("");
      setSearchResults([]);
      setHighlightIndex(-1);
    }
  };

  const onFileChange = (e) => {
    const file = e.target.files?.[0] || null;
    setImageFile(file);
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (busy) return;

    if (!form.store_id) {
      alert("Select a store");
      return;
    }
    if (!isEdit && !imageFile) {
      alert("Banner image is required");
      return;
    }
    if (!form.aff_url.trim()) {
      alert("Click URL is required");
      return;
    }

    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("store_id", form.store_id);
      fd.append("alt_text", form.alt_text);
      fd.append("label", form.label);
      fd.append("aff_url", form.aff_url);
      fd.append("display_order", String(form.display_order));
      fd.append("is_active", String(form.is_active));
      if (imageFile) fd.append("image", imageFile);

      const res = isEdit ? await updateBanner(id, fd) : await addBanner(fd);
      if (res?.error) {
        alert(res.error.message || "Save failed");
        return;
      }
      onClose?.();
    } finally {
      setBusy(false);
    }
  };

  useEscClose(onClose);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-xl rounded shadow-lg p-6 max-h-[95vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            {isEdit ? "Edit Banner" : "Add Banner"}
          </h2>
          <button className="border px-3 py-1 rounded" onClick={onClose}>
            Back
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {/* Store search */}
          <div>
            <label className="block mb-1">
              Store <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={onSearchKeyDown}
                placeholder="Type at least 3 characters…"
                className="w-full border px-3 py-2 rounded"
              />
              {searchLoading && (
                <div className="text-xs text-gray-500 mt-1">Searching…</div>
              )}
              {searchResults.length > 0 && (
                <div className="absolute z-10 bg-white border w-full max-h-60 overflow-y-auto rounded shadow">
                  {searchResults.map((s, i) => (
                    <div
                      key={s.id}
                      className={`px-3 py-2 cursor-pointer ${i === highlightIndex ? "bg-blue-100" : "hover:bg-gray-50"}`}
                      onMouseDown={() => selectStore(s)}
                    >
                      {s.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Click URL */}
          <div>
            <label className="block mb-1">
              Click URL (aff_url / web_url){" "}
              <span className="text-red-500">*</span>
            </label>
            <input
              value={form.aff_url}
              onChange={(e) => setForm({ ...form, aff_url: e.target.value })}
              placeholder="Auto-filled from store, override if needed"
              className="w-full border px-3 py-2 rounded"
            />
          </div>

          {/* Banner image */}
          <div>
            <label className="block mb-1">
              Banner Image {!isEdit && <span className="text-red-500">*</span>}
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={onFileChange}
              className="block"
            />
            <div className="text-xs text-gray-500 mt-1">
              Any format — converted to WebP automatically. Max 5MB.
            </div>
            {previewUrl && (
              <img
                src={previewUrl}
                alt="Preview"
                className="mt-3 rounded border object-cover w-full max-h-40"
              />
            )}
          </div>

          {/* Alt text */}
          <div>
            <label className="block mb-1">Alt Text</label>
            <input
              value={form.alt_text}
              onChange={(e) => setForm({ ...form, alt_text: e.target.value })}
              placeholder="Describe the banner image"
              className="w-full border px-3 py-2 rounded"
            />
          </div>

          {/* Label */}
          <div>
            <label className="block mb-1">
              Label{" "}
              <span className="text-xs text-gray-400">
                (overlay text on carousel)
              </span>
            </label>
            <input
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="e.g. Up to 40% off"
              className="w-full border px-3 py-2 rounded"
            />
          </div>

          {/* Display order + Active */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-1">Display Order</label>
              <input
                type="number"
                value={form.display_order}
                onChange={(e) =>
                  setForm({
                    ...form,
                    display_order: Number(e.target.value || 0),
                  })
                }
                className="w-full border px-3 py-2 rounded"
              />
            </div>
            <div>
              <label className="block mb-1">Active?</label>
              <label className="inline-flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) =>
                    setForm({ ...form, is_active: e.target.checked })
                  }
                />
                <span>Yes</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={busy}
              className="bg-blue-600 text-white px-4 py-2 rounded disabled:bg-gray-400"
            >
              {busy ? "Saving…" : isEdit ? "Update Banner" : "Create Banner"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
