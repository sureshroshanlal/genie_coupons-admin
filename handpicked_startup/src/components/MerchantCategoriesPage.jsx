// src/pages/merchants/MerchantCategoriesPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  listMerchantCategories,
  toggleMerchantCategoryStatus,
  removeMerchantCategory,
} from "../services/merchantCategoryService.js";
import ViewMerchantCategoryModal from "../components/modals/ViewMerchantCategoryModal";
import AddMerchantCategoryModal from "../components/modals/AddMerchantCategoryModal";
import EditMerchantCategoryModal from "../components/modals/EditMerchantCategoryModal";

export default function MerchantCategoriesPage() {
  const [filters, setFilters] = useState({
    name: "",
    show_home: undefined,
    show_deals_page: undefined,
    is_publish: undefined,
    is_header: undefined,
  });

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Modals
  const [showAdd, setShowAdd] = useState(false);
  const [viewId, setViewId] = useState(null);
  const [editId, setEditId] = useState(null);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / limit)),
    [total, limit]
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const { data, total: t } = await listMerchantCategories({
          name: filters.name,
          show_home: filters.show_home,
          show_deals_page: filters.show_deals_page,
          is_publish: filters.is_publish,
          is_header: filters.is_header,
          page,
          limit,
          include_store_count: true,
        });
        setRows(Array.isArray(data) ? data : []);
        setTotal(Number(t || 0));
      } catch (e) {
        console.error("Failed to load merchant categories:", e?.message || e);
        if (mounted) {
          setRows([]);
          setTotal(0);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [filters, page, limit, refreshKey]);

  const applyFilters = () => {
    setPage(1);
    setRefreshKey((k) => k + 1);
  };

  const resetFilters = () => {
    setFilters({
      name: "",
      show_home: undefined,
      show_deals_page: undefined,
      is_publish: undefined,
      is_header: undefined,
    });
    setPage(1);
    setRefreshKey((k) => k + 1);
  };

  const onAfterMutate = () => {
    setShowAdd(false);
    setEditId(null);
    setViewId(null);
    setRefreshKey((k) => k + 1);
  };

  const handleToggleStatus = async (id) => {
    try {
      await toggleMerchantCategoryStatus(id);
      onAfterMutate();
    } catch (e) {
      console.error("Toggle status failed:", e?.message || e);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this category?")) return;
    try {
      await removeMerchantCategory(id);
      onAfterMutate();
    } catch (e) {
      console.error("Delete failed:", e?.message || e);
    }
  };

  const BoolIcon = ({ value }) => (
    <span
      className={`inline-block w-3 h-3 rounded ${
        value ? "bg-green-500" : "bg-gray-300"
      }`}
    />
  );

  const formatDate = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
  };

  // Checkbox filter helper: tri-state behavior -> undefined when unchecked, true when checked
  const onFilterCheck = (key) => (e) => {
    setFilters((f) => ({ ...f, [key]: e.target.checked ? true : undefined }));
  };

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Merchant Categories</h1>
        <button
          className="bg-blue-600 text-white px-3 py-2 rounded"
          onClick={() => setShowAdd(true)}
        >
          + Add
        </button>
      </div>

      {/* Filters */}
      <div className="border rounded mb-4">
        <div className="p-3 font-medium border-b">Filters</div>
        <div className="p-3 space-y-3">
          <div className="grid grid-cols-4 gap-4 items-end">
            <div className="col-span-2">
              <label className="block text-sm mb-1">Name</label>
              <input
                value={filters.name}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, name: e.target.value }))
                }
                className="w-full border px-3 py-2 rounded"
                placeholder="Search by name"
              />
            </div>
            <div className="flex items-center gap-4 col-span-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!filters.show_home}
                  onChange={onFilterCheck("show_home")}
                />
                Show Home
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!filters.show_deals_page}
                  onChange={onFilterCheck("show_deals_page")}
                />
                Show Deals Page
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!filters.is_publish}
                  onChange={onFilterCheck("is_publish")}
                />
                Publish
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!filters.is_header}
                  onChange={onFilterCheck("is_header")}
                />
                Is Header
              </label>
            </div>
          </div>

          <div className="mt-2 flex gap-2">
            <button
              className="bg-blue-600 text-white px-3 py-2 rounded"
              onClick={applyFilters}
            >
              Apply
            </button>
            <button
              className="bg-gray-200 px-3 py-2 rounded"
              onClick={resetFilters}
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2 border-b">Id</th>
                <th className="text-left p-2 border-b">Name</th>
                <th className="text-left p-2 border-b">ShowHome</th>
                <th className="text-left p-2 border-b">ShowDealsPage</th>
                <th className="text-left p-2 border-b">Publish</th>
                <th className="text-left p-2 border-b">Stores</th>
                <th className="text-left p-2 border-b">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-4 text-center">
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-4 text-center">
                    No categories found.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="odd:bg-white even:bg-gray-50">
                    <td className="p-2 border-b">{r.id}</td>
                    <td className="p-2 border-b">{r.name || "—"}</td>
                    <td className="p-2 border-b">
                      <BoolIcon value={!!r.show_home} />
                    </td>
                    <td className="p-2 border-b">
                      <BoolIcon value={!!r.show_deals_page} />
                    </td>
                    <td className="p-2 border-b">
                      <BoolIcon value={!!r.is_publish} />
                    </td>
                    <td className="p-2 border-b">
                      <button
                        className="text-blue-600 underline"
                        onClick={() => {
                          // TODO: navigate(`/merchants?category_id=${r.id}`)
                          alert(`Stores in "${r.name}": ${r.store_count ?? 0}`);
                        }}
                      >
                        {r.store_count ?? 0}
                      </button>
                    </td>
                    <td className="p-2 border-b">
                      <div className="flex gap-2">
                        {/* green: toggle publish */}
                        <button
                          title="Toggle Publish"
                          className="bg-green-600 text-white px-2 py-1 rounded"
                          onClick={() => handleToggleStatus(r.id)}
                        >
                          ✓
                        </button>
                        {/* yellow: view */}
                        <button
                          title="View"
                          className="bg-yellow-500 text-white px-2 py-1 rounded"
                          onClick={() => setViewId(r.id)}
                        >
                          👁
                        </button>
                        {/* blue: edit */}
                        <button
                          title="Edit"
                          className="bg-blue-600 text-white px-2 py-1 rounded"
                          onClick={() => setEditId(r.id)}
                        >
                          ✎
                        </button>
                        {/* red: delete */}
                        <button
                          title="Delete"
                          className="bg-red-600 text-white px-2 py-1 rounded"
                          onClick={() => handleDelete(r.id)}
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-2">
          <div className="flex items-center gap-2">
            <span className="text-sm">Page Size</span>
            <select
              className="border px-2 py-1 rounded"
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
            >
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <span className="text-sm text-gray-500">Total: {total}</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              className="border px-2 py-1 rounded"
              onClick={() => setPage(1)}
              disabled={page === 1}
            >
              «
            </button>
            <button
              className="border px-2 py-1 rounded"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              ‹
            </button>
            <span className="px-2 text-sm">
              {page} / {totalPages}
            </span>
            <button
              className="border px-2 py-1 rounded"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              ›
            </button>
            <button
              className="border px-2 py-1 rounded"
              onClick={() => setPage(totalPages)}
              disabled={page >= totalPages}
            >
              »
            </button>
          </div>
        </div>
      </div>

      {/* Modals (will be provided next) */}
      {showAdd && (
        <AddMerchantCategoryModal
          onClose={() => setShowAdd(false)}
          onSave={onAfterMutate}
        />
      )}
      {viewId && (
        <ViewMerchantCategoryModal
          categoryId={viewId}
          onClose={() => setViewId(null)}
        />
      )}
      {editId && (
        <EditMerchantCategoryModal
          categoryId={editId}
          onClose={() => setEditId(null)}
          onSave={onAfterMutate}
        />
      )}
    </div>
  );
}
