import React, { useEffect, useState, useCallback } from "react";
import {
  listReviews,
  updateReviewStatus,
  bulkUpdateReviewStatus,
} from "../services/couponReviewsService.js";

const STATUS_COLORS = {
  pending: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

const STARS = (n) =>
  Array.from({ length: 5 }, (_, i) => (
    <span key={i} className={i < n ? "text-yellow-400" : "text-gray-300"}>
      ★
    </span>
  ));

const PAGE_LIMIT = 20;

export default function CouponReviewsListPage() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [qStatus, setQStatus] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState(null); // { msg, type }
  const [imgModal, setImgModal] = useState(null); // screenshot url

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchRows = useCallback(
    async (p = page, status = qStatus) => {
      setLoading(true);
      setSelected(new Set());
      const params = { page: p, limit: PAGE_LIMIT };
      if (status) params.status = status;
      const { data, total: t } = await listReviews(params);
      setRows(Array.isArray(data) ? data : []);
      setTotal(t ?? 0);
      setLoading(false);
    },
    [page, qStatus],
  );

  useEffect(() => {
    fetchRows(page, qStatus);
  }, [page, qStatus]);

  // ── Single status update ──────────────────────────────────────────
  const handleAction = async (id, status) => {
    const label = status === "approved" ? "Approve" : "Reject";
    if (!window.confirm(`${label} this review?`)) return;
    setActionLoading(true);
    const { error } = await updateReviewStatus(id, status);
    setActionLoading(false);
    if (error) return showToast(`Failed: ${error.message}`, "error");
    showToast(`Review ${status}.`);
    fetchRows(page, qStatus);
  };

  // ── Bulk ──────────────────────────────────────────────────────────
  const handleBulk = async (status) => {
    if (selected.size === 0) return;
    const label = status === "approved" ? "Approve" : "Reject";
    if (!window.confirm(`${label} ${selected.size} review(s)?`)) return;
    setActionLoading(true);
    const { error } = await bulkUpdateReviewStatus([...selected], status);
    setActionLoading(false);
    if (error) return showToast(`Failed: ${error.message}`, "error");
    showToast(`${selected.size} review(s) ${status}.`);
    fetchRows(page, qStatus);
  };

  // ── Selection ─────────────────────────────────────────────────────
  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === rows.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(rows.map((r) => r.id)));
    }
  };

  const totalPages = Math.ceil(total / PAGE_LIMIT);

  return (
    <div className="p-4 relative">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2 rounded shadow text-white text-sm
            ${toast.type === "error" ? "bg-red-600" : "bg-green-600"}`}
        >
          {toast.msg}
        </div>
      )}

      {/* Screenshot modal */}
      {imgModal && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center"
          onClick={() => setImgModal(null)}
        >
          <img
            src={imgModal}
            alt="Screenshot"
            className="max-w-3xl max-h-[90vh] rounded shadow-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-semibold">Coupon Reviews</h1>
        <span className="text-sm text-gray-500">{total} total</span>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-2 items-center">
        <select
          className="border px-3 py-2 rounded text-sm"
          value={qStatus}
          onChange={(e) => {
            setQStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>

        <button
          onClick={() => {
            setQStatus("pending");
            setPage(1);
          }}
          className="px-3 py-2 border rounded text-sm"
        >
          Reset
        </button>

        {/* Bulk actions — visible only when rows selected */}
        {selected.size > 0 && (
          <div className="flex gap-2 ml-auto">
            <span className="text-sm text-gray-600 self-center">
              {selected.size} selected
            </span>
            <button
              disabled={actionLoading}
              onClick={() => handleBulk("approved")}
              className="px-3 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded disabled:opacity-50"
            >
              Bulk Approve
            </button>
            <button
              disabled={actionLoading}
              onClick={() => handleBulk("rejected")}
              className="px-3 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded disabled:opacity-50"
            >
              Bulk Reject
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 text-left w-8">
                <input
                  type="checkbox"
                  checked={rows.length > 0 && selected.size === rows.length}
                  onChange={toggleAll}
                />
              </th>
              <th className="p-3 text-left">ID</th>
              <th className="p-3 text-left">Coupon</th>
              <th className="p-3 text-left">User</th>
              <th className="p-3 text-left">Rating</th>
              <th className="p-3 text-left">Comment</th>
              <th className="p-3 text-left">Screenshot</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Submitted</th>
              <th className="p-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} className="p-4 text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-4 text-gray-400">
                  No reviews found
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t hover:bg-gray-50">
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => toggleSelect(r.id)}
                    />
                  </td>
                  <td className="p-3 text-gray-500">{r.id}</td>
                  <td
                    className="p-3 font-medium max-w-[160px] truncate"
                    title={r.coupons?.title}
                  >
                    {r.coupons?.title || `#${r.coupon_id}`}
                  </td>
                  <td className="p-3">
                    <div className="font-medium leading-tight">
                      {r.profiles?.full_name || "—"}
                    </div>
                    <div className="text-xs text-gray-400">
                      {r.profiles?.email || "—"}
                    </div>
                  </td>
                  <td className="p-3 whitespace-nowrap">{STARS(r.rating)}</td>
                  <td className="p-3 max-w-[200px]">
                    {r.comment ? (
                      <span title={r.comment} className="line-clamp-2 block">
                        {r.comment}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    {r.screenshot_url ? (
                      <button
                        onClick={() => setImgModal(r.screenshot_url)}
                        className="text-blue-600 hover:underline text-xs"
                      >
                        View
                      </button>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-1 text-xs rounded ${STATUS_COLORS[r.status] ?? ""}`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="p-3 whitespace-nowrap text-gray-500">
                    {r.created_at
                      ? new Date(r.created_at).toLocaleString()
                      : "—"}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      {r.status !== "approved" && (
                        <button
                          disabled={actionLoading}
                          onClick={() => handleAction(r.id, "approved")}
                          className="px-2 py-1 text-xs text-white bg-green-600 hover:bg-green-700 rounded disabled:opacity-50"
                        >
                          Approve
                        </button>
                      )}
                      {r.status !== "rejected" && (
                        <button
                          disabled={actionLoading}
                          onClick={() => handleAction(r.id, "rejected")}
                          className="px-2 py-1 text-xs text-white bg-red-600 hover:bg-red-700 rounded disabled:opacity-50"
                        >
                          Reject
                        </button>
                      )}
                      {r.status !== "pending" && (
                        <button
                          disabled={actionLoading}
                          onClick={() => handleAction(r.id, "pending")}
                          className="px-2 py-1 text-xs border rounded hover:bg-gray-50 disabled:opacity-50"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex gap-2 items-center justify-end text-sm">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1 border rounded disabled:opacity-40"
          >
            Prev
          </button>
          <span className="text-gray-600">
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page === totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1 border rounded disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
