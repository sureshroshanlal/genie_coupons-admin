import React, { useEffect, useMemo, useState } from "react";
import {
  listBanners,
  toggleBanner,
  removeBanner,
} from "../services/bannersService.js";
import BannerModal from "./modals/BannerModal.jsx";

export default function BannersListPage() {
  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    store_id: "",
    is_active: "",
  });
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const params = { ...filters };
      if (params.is_active === "") delete params.is_active;
      const { rows, total } = await listBanners(params);
      setRows(rows);
      setTotal(total);
    } catch (err) {
      console.error("listBanners failed:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [JSON.stringify(filters)]);

  const pages = useMemo(
    () => Math.max(1, Math.ceil(total / (filters.limit || 20))),
    [total, filters.limit],
  );

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="text-xl font-semibold">Banners</div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          Add Banner
        </button>
      </div>

      {/* Filters */}
      <div className="cp-filters">
        <select
          value={filters.is_active}
          onChange={(e) =>
            setFilters((f) => ({ ...f, is_active: e.target.value, page: 1 }))
          }
        >
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
        <button className="btn" onClick={load}>
          Refresh
        </button>
      </div>

      {/* Table */}
      <div className="cp-table">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Preview</th>
              <th>Store</th>
              <th>Label</th>
              <th>Click URL</th>
              <th>Order</th>
              <th>Status</th>
              <th>Created</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9}>Loading…</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={9}>No banners found</td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>
                    <img
                      src={r.image_url}
                      alt={r.alt_text || "Banner"}
                      style={{
                        width: 120,
                        height: 50,
                        objectFit: "cover",
                        borderRadius: 4,
                      }}
                    />
                  </td>
                  <td>{r.store_name || r.store_id}</td>
                  <td>{r.label || "—"}</td>
                  <td
                    className="cp-detail"
                    style={{ maxWidth: 180, wordBreak: "break-all" }}
                  >
                    <a
                      href={r.click_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline text-xs"
                    >
                      {r.click_url}
                    </a>
                  </td>
                  <td>{r.display_order}</td>
                  <td>{r.is_active ? "✅ Active" : "⛔ Inactive"}</td>
                  <td>{r.created_at?.slice(0, 10)}</td>
                  <td className="cp-actions">
                    <button
                      title={r.is_active ? "Deactivate" : "Activate"}
                      onClick={async () => {
                        await toggleBanner(r.id);
                        load();
                      }}
                    >
                      {r.is_active ? "🟢" : "⚫"}
                    </button>
                    <button title="Edit" onClick={() => setEditId(r.id)}>
                      ✏️
                    </button>
                    <button
                      title="Delete"
                      onClick={async () => {
                        if (
                          confirm(
                            "Delete this banner? The image will also be removed from storage.",
                          )
                        ) {
                          await removeBanner(r.id);
                          load();
                        }
                      }}
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="cp-pagination">
          <span>
            Showing {rows.length} of {total} entries
          </span>
          <div className="cp-pages">
            {Array.from({ length: pages }).map((_, i) => (
              <button
                key={i}
                className={filters.page === i + 1 ? "btn btn-primary" : "btn"}
                onClick={() => setFilters((f) => ({ ...f, page: i + 1 }))}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      </div>

      {showCreate && (
        <BannerModal
          onClose={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}
      {editId && (
        <BannerModal
          id={editId}
          onClose={() => {
            setEditId(null);
            load();
          }}
        />
      )}
    </div>
  );
}
