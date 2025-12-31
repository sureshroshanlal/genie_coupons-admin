import React, { useEffect, useState } from "react";
import {
  addCoupon,
  getCoupon,
  updateCoupon,
} from "../../services/couponsService";
import { listMerchants } from "../../services/merchantService";
import useEscClose from "../hooks/useEscClose";

export default function CouponModal({ id, onClose }) {
  const isEdit = !!id;

  const [form, setForm] = useState({
    store_id: "",
    coupon_type: "coupon", // 'coupon' | 'deal'
    title: "",
    h_block: "", // H2/H3 selection or key
    coupon_code: "",
    aff_url: "",
    description: "",
    filter_id: "",
    category_id: "",
    show_proof: false,
    expiry_date: "",
    schedule_date: "",
    editor_pick: false,
    editor_order: 0,
    coupon_style: "custom",
    special_msg_type: "",
    special_msg: "",
    push_to: "",
    level: "",
    home: false,
    is_brand_coupon: false,
    is_publish: true, // <-- default true
  });

  const [stores, setStores] = useState([]);
  const [storesLoading, setStoresLoading] = useState(false);
  const [storesError, setStoresError] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [proofFile, setProofFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [availableCategories, setAvailableCategories] = useState([]);

  // Lock body scroll like your Merchants modal does
  useEffect(() => {
    document.body.classList.add("modal-open");
    return () => document.body.classList.remove("modal-open");
  }, []);

  // Load stores from DB with loading & error handling
  useEffect(() => {
    (async () => {
      setStoresLoading(true);
      setStoresError(null);
      try {
        const res = await listMerchants(); // from merchantService
        if (res?.data) {
          const processedStores = res.data.map((m) => ({
            id: String(m.id),
            name: m.name,
            aff_url: m.aff_url || "",
            website: m.web_url || "",
            categories: m.category_names || [],
          }));
          setStores(processedStores);
        } else {
          setStores([]);
        }
      } catch (err) {
        console.error("Failed to load merchants:", err);
        setStoresError("Failed to load stores");
      } finally {
        setStoresLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!isEdit) return;

    (async () => {
      try {
        const result = await getCoupon(id);
        console.log("Edit API result:", result);

        if (!result) return;
        setForm({
          store_id: String(result.merchant_id ?? ""),
          coupon_type: result.coupon_type || "coupon",
          title: result.title || "",
          h_block: result.h_block || "",
          coupon_code: result.coupon_code || "",
          aff_url: result.aff_url || result.url || "",
          description: result.description || "",
          filter_id: String(result.filter_id ?? ""),
          category_id: String(result.category_id ?? ""),
          show_proof: Boolean(result.show_proof),
          expiry_date: result.ends_at?.slice(0, 10) || "",
          schedule_date: result.starts_at?.slice(0, 10) || "",
          editor_pick: Boolean(result.is_editor),
          editor_order: Number(result.editor_order ?? 0),
          coupon_style: result.coupon_style || "custom",
          special_msg_type: result.special_msg_type || "",
          special_msg: result.special_msg || "",
          push_to: result.push_to || "",
          level: result.level || "",
          home: Boolean(result.home),
          is_brand_coupon: !!result.is_brand_coupon,
          is_publish:
            result.is_publish !== undefined ? !!result.is_publish : true, // respect existing or default true
        });
      } catch (err) {
        console.error(err);
      }
    })();
  }, [id, isEdit]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (v === null || v === undefined) return;
        fd.append(k, typeof v === "boolean" ? String(v) : String(v));
      });
      // assign click_count randomly between 400 and 600 for new coupons
      if (!isEdit) {
        const rand = Math.floor(Math.random() * (600 - 400 + 1)) + 400;
        fd.append("click_count", String(rand));
      }
      if (logoFile) fd.append("image", logoFile);
      if (proofFile) fd.append("proof_image", proofFile);

      const res = isEdit ? await updateCoupon(id, fd) : await addCoupon(fd);
      if (res?.error) {
        alert(res.error.message || "Save failed");
      } else {
        onClose?.();
      }
    } finally {
      setBusy(false);
    }
  };

  // close on ESC
  useEscClose(onClose);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-6xl rounded shadow-lg p-6 max-h-[95vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            {isEdit ? "Update coupon or deal" : "Add coupon or deal"}
          </h2>
          <button className="border px-3 py-1 rounded" onClick={onClose}>
            Back
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {/* Store */}
          <div>
            <label className="block mb-1">Store</label>
            {storesLoading ? (
              <div className="text-gray-500 text-sm">Loading stores...</div>
            ) : storesError ? (
              <div className="text-red-500 text-sm">{storesError}</div>
            ) : (
              <select
                value={form.store_id}
                onChange={(e) => {
                  const storeId = e.target.value;
                  setForm({ ...form, store_id: storeId });

                  const selectedStore = stores.find((s) => s.id === storeId);
                  if (selectedStore) {
                    setForm((prev) => ({
                      ...prev,
                      aff_url:
                        selectedStore.aff_url || selectedStore.website || "",
                      category_id:
                        selectedStore.categories?.[0] || prev.category_id,
                    }));
                    setAvailableCategories(selectedStore.categories || []);
                  } else {
                    setAvailableCategories([]);
                  }
                }}
                className="w-full border px-3 py-2 rounded"
              >
                <option value="">Select store</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Coupon or Deal */}
          <div>
            <label className="block mb-1">Coupon or Deal</label>
            <select
              value={form.coupon_type}
              onChange={(e) =>
                setForm({ ...form, coupon_type: e.target.value })
              }
              className="w-full border px-3 py-2 rounded"
            >
              <option value="coupon">Coupon</option>
              <option value="deal">Deal</option>
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="block mb-1">Title</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full border px-3 py-2 rounded"
            />
          </div>

          {/* Select H2 or H3 */}
          <div>
            <label className="block mb-1">Select H2 or H3</label>
            <select
              value={form.h_block}
              onChange={(e) => setForm({ ...form, h_block: e.target.value })}
              className="w-full border px-3 py-2 rounded"
            >
              <option value="">--Select--</option>
              {/* TODO: populate H2/H3 options */}
            </select>
          </div>

          {/* Coupon Code (only when type = coupon) */}
          {form.coupon_type === "coupon" && (
            <div>
              <label className="block mb-1">Coupon Code</label>
              <input
                value={form.coupon_code}
                onChange={(e) =>
                  setForm({ ...form, coupon_code: e.target.value })
                }
                className="w-full border px-3 py-2 rounded"
              />
            </div>
          )}

          {/* Website or Affiliate URL */}
          <div>
            <label className="block mb-1">Website or Affiliate URL</label>
            <input
              value={form.aff_url}
              onChange={(e) => setForm({ ...form, aff_url: e.target.value })}
              className="w-full border px-3 py-2 rounded"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block mb-1">Description</label>
            <textarea
              rows={6}
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              className="w-full border px-3 py-2 rounded"
            />
          </div>

          {/* Coupon or Brand Image */}
          <div>
            <label className="block mb-1">Coupon or Brand Image</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
              className="block"
            />
            <div className="text-xs text-gray-500 mt-1">
              jpg & png image only; max-width:122px; max-height:54px;
              max-size:2MB
            </div>
          </div>

          {/* Filter */}
          <div>
            <label className="block mb-1">Filter</label>
            <select
              value={form.filter_id}
              onChange={(e) => setForm({ ...form, filter_id: e.target.value })}
              className="w-full border px-3 py-2 rounded"
            >
              <option value="">None Selected</option>
              {/* TODO: populate filters */}
            </select>
          </div>

          {/* Store Category */}
          <div>
            <label className="block mb-1">Store Category</label>
            <select
              value={form.category_id}
              onChange={(e) =>
                setForm({ ...form, category_id: e.target.value })
              }
              className="w-full border px-3 py-2 rounded"
            >
              <option value="">Select category</option>
              {availableCategories.map((cat, idx) => (
                <option key={idx} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Proof image + Show proof */}
          <div>
            <label className="block mb-1">Proof image</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setProofFile(e.target.files?.[0] || null)}
              className="block"
            />
            <div className="text-xs text-gray-500 mt-1">
              jpg & png image only; max-width:650px; max-height:350px;
              max-size:2MB
            </div>
            <label className="inline-flex items-center gap-2 mt-2">
              <input
                type="checkbox"
                checked={form.show_proof}
                onChange={(e) =>
                  setForm({ ...form, show_proof: e.target.checked })
                }
              />
              <span>Show proof?</span>
            </label>
          </div>

          {/* Expiry/Schedule */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block mb-1">Expiry Date</label>
              <input
                type="date"
                value={form.expiry_date}
                onChange={(e) =>
                  setForm({ ...form, expiry_date: e.target.value })
                }
                className="w-full border px-3 py-2 rounded"
              />
            </div>
            <div>
              <label className="block mb-1">Schedule Date</label>
              <input
                type="date"
                value={form.schedule_date}
                onChange={(e) =>
                  setForm({ ...form, schedule_date: e.target.value })
                }
                className="w-full border px-3 py-2 rounded"
              />
            </div>
          </div>

          {/* Editor pick + order */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block mb-1">Editor Pick?</label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.editor_pick}
                  onChange={(e) =>
                    setForm({ ...form, editor_pick: e.target.checked })
                  }
                />
                <span>Yes</span>
              </label>
            </div>
            <div>
              <label className="block mb-1">Editor order</label>
              <input
                type="number"
                value={form.editor_order}
                onChange={(e) =>
                  setForm({
                    ...form,
                    editor_order: Number(e.target.value || 0),
                  })
                }
                className="w-full border px-3 py-2 rounded"
              />
            </div>
          </div>

          {/* Coupon Type + Special Message Type */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block mb-1">Coupon Type</label>
              <select
                value={form.coupon_style}
                onChange={(e) =>
                  setForm({ ...form, coupon_style: e.target.value })
                }
                className="w-full border px-3 py-2 rounded"
              >
                <option value="custom">Custom</option>
                {/* Add more styles if needed */}
              </select>
            </div>
            <div>
              <label className="block mb-1">Special Message Type</label>
              <select
                value={form.special_msg_type}
                onChange={(e) =>
                  setForm({ ...form, special_msg_type: e.target.value })
                }
                className="w-full border px-3 py-2 rounded"
              >
                <option value="">None</option>
                {/* Add options */}
              </select>
            </div>
          </div>

          {/* Special Message + Push to */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block mb-1">Special Message</label>
              <input
                value={form.special_msg}
                onChange={(e) =>
                  setForm({ ...form, special_msg: e.target.value })
                }
                className="w-full border px-3 py-2 rounded"
              />
            </div>
            <div>
              <label className="block mb-1">Push to</label>
              <select
                value={form.push_to}
                onChange={(e) => setForm({ ...form, push_to: e.target.value })}
                className="w-full border px-3 py-2 rounded"
              >
                <option value="">None</option>
                {/* Add options */}
              </select>
            </div>
          </div>

          {/* Level + Display in home */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block mb-1">Level</label>
              <select
                value={form.level}
                onChange={(e) => setForm({ ...form, level: e.target.value })}
                className="w-full border px-3 py-2 rounded"
              >
                <option value="">None</option>
                {/* Add options */}
              </select>
            </div>
            <div>
              <label className="block mb-1">Display in home?</label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.home}
                  onChange={(e) => setForm({ ...form, home: e.target.checked })}
                />
                <span>Yes</span>
              </label>
            </div>
          </div>

          {/* Is Brand Coupon? */}
          <div>
            <label className="block mb-1">Is Brand Coupon?</label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.is_brand_coupon}
                onChange={(e) =>
                  setForm({ ...form, is_brand_coupon: e.target.checked })
                }
              />
              <span>Yes</span>
            </label>
          </div>

          {/* Publish toggle (default true) */}
          <div>
            <label className="block mb-1">Publish?</label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.is_publish}
                onChange={(e) =>
                  setForm({ ...form, is_publish: e.target.checked })
                }
              />
              <span>Yes</span>
            </label>
          </div>

          {/* Footer actions */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={busy}
              className="bg-blue-600 text-white px-4 py-2 rounded disabled:bg-gray-400"
            >
              {busy ? "Saving..." : isEdit ? "Update Coupon" : "Create Coupon"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
