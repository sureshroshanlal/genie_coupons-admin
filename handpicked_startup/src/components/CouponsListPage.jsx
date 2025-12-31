import React, { useEffect, useMemo, useState } from "react";
import {
  listCoupons,
  togglePublish,
  toggleEditorPick,
  removeCoupon,
} from "../services/couponsService.js";
import CouponModal from "../components/modals/CouponModal.jsx";
import ViewCouponModal from "../components/modals/ViewCouponModal.jsx";

export default function CouponsListPage() {
  const [filters, setFilters] = useState({
    store_id: "",
    type: "",
    status: "",
    category_id: "",
    filter: "",
    from_date: "",
    to_date: "",
    search: "",
    page: 1,
    limit: 20,
  });
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState(null);
  const [viewId, setViewId] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const { data, total } = await listCoupons(filters);
      setRows(data);
      setTotal(total);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters)]);

  const onClear = () => {
    setFilters((f) => ({
      ...f,
      store_id: "",
      type: "",
      status: "",
      category_id: "",
      filter: "",
      from_date: "",
      to_date: "",
      search: "",
      page: 1,
    }));
  };

  const onApply = () => load();

  const pages = useMemo(
    () => Math.max(1, Math.ceil(total / (filters.limit || 20))),
    [total, filters.limit]
  );

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="text-xl font-semibold">Coupon & Deals lists</div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          Add new coupon
        </button>
      </div>

      <div className="cp-filters">
        <select
          value={filters.store_id}
          onChange={(e) =>
            setFilters((f) => ({ ...f, store_id: e.target.value, page: 1 }))
          }
        >
          <option value="">Store: none</option>
          {/* TODO: populate with stores options */}
        </select>

        <select
          value={filters.type}
          onChange={(e) =>
            setFilters((f) => ({ ...f, type: e.target.value, page: 1 }))
          }
        >
          <option value="">Coupon/Deal</option>
          <option value="coupon">Coupon</option>
          <option value="deal">Deal</option>
        </select>

        <select
          value={filters.status}
          onChange={(e) =>
            setFilters((f) => ({ ...f, status: e.target.value, page: 1 }))
          }
        >
          <option value="">Status</option>
          <option value="published">Published</option>
          <option value="unpublished">Unpublished</option>
        </select>

        <select
          value={filters.category_id}
          onChange={(e) =>
            setFilters((f) => ({ ...f, category_id: e.target.value, page: 1 }))
          }
        >
          <option value="">All</option>
          {/* TODO: categories options */}
        </select>

        <input
          placeholder="Filter"
          value={filters.filter}
          onChange={(e) =>
            setFilters((f) => ({ ...f, filter: e.target.value }))
          }
        />

        <input
          type="date"
          value={filters.from_date}
          onChange={(e) =>
            setFilters((f) => ({ ...f, from_date: e.target.value }))
          }
        />
        <input
          type="date"
          value={filters.to_date}
          onChange={(e) =>
            setFilters((f) => ({ ...f, to_date: e.target.value }))
          }
        />

        <input
          placeholder="Search"
          value={filters.search}
          onChange={(e) =>
            setFilters((f) => ({ ...f, search: e.target.value }))
          }
        />
        <button className="btn" onClick={onApply}>
          Search
        </button>
        <button className="btn" onClick={onClear}>
          Clear
        </button>
      </div>

      <div className="cp-table">
        <table>
          <thead>
            <tr>
              <th style={{ width: 24 }}></th>
              <th>ID</th>
              <th>Detail</th>
              <th>Store</th>
              <th>Categories</th>
              <th>Posted</th>
              <th>Reports</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8}>Loading...</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8}>No data</td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <input type="checkbox" />
                  </td>
                  <td>{r.id}</td>
                  <td className="cp-detail">
                    <div>
                      <b>Title:</b> {r.title}
                    </div>
                    {r.coupon_type === "coupon" && r.coupon_code ? (
                      <div>
                        <b>Code:</b> {r.coupon_code}
                      </div>
                    ) : null}
                    {r.aff_url ? (
                      <div>
                        <b>URL:</b> {r.aff_url}
                      </div>
                    ) : null}
                  </td>
                  <td>{r.store_name || r.store_slug}</td>
                  <td>{r.categories?.join(", ") || "-"}</td>
                  <td>{r.posted_at || r.created_at?.slice(0, 10)}</td>
                  <td>{r.reports || 0}</td>
                  <td className="cp-actions">
                    <button
                      title="Publish/Unpublish"
                      onClick={async () => {
                        await togglePublish(r.id);
                        load();
                      }}
                    >
                      🟢
                    </button>
                    <button
                      title="Editor pick"
                      onClick={async () => {
                        await toggleEditorPick(r.id);
                        load();
                      }}
                    >
                      ⭐
                    </button>
                    <button title="Copy">📋</button>
                    <button title="View" onClick={() => setViewId(r.id)}>
                      👁️
                    </button>
                    <button title="Edit" onClick={() => setEditId(r.id)}>
                      ✏️
                    </button>
                    <button
                      title="Delete"
                      onClick={async () => {
                        if (confirm("Delete?")) {
                          await removeCoupon(r.id);
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
        <CouponModal
          onClose={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}
      {editId && (
        <CouponModal
          id={editId}
          onClose={() => {
            setEditId(null);
            load();
          }}
        />
      )}
      {viewId && (
        <ViewCouponModal id={viewId} onClose={() => setViewId(null)} />
      )}
    </div>
  );
}
