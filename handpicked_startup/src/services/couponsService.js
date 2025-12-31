// src/services/couponsService.js
import axios from "axios";
import { API_BASE_URL } from "../config/api";

const http = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  withCredentials: true,
});

// List with filters + pagination
export async function listCoupons(params = {}) {
  const qp = new URLSearchParams();
  if (params.search) qp.set("search", params.search);
  if (params.store_id) qp.set("store_id", String(params.store_id));
  if (params.type) qp.set("type", params.type); // 'coupon' | 'deal'
  if (params.status) qp.set("status", params.status); // 'published' | 'unpublished'
  if (params.category_id) qp.set("category_id", String(params.category_id));
  if (params.filter) qp.set("filter", params.filter); // custom freeform
  if (params.from_date) qp.set("from_date", params.from_date);
  if (params.to_date) qp.set("to_date", params.to_date);
  qp.set("page", String(params.page || 1));
  qp.set("limit", String(params.limit || 20));

  const res = await http.get(`/coupons?${qp.toString()}`);
  return {
    data: Array.isArray(res.data?.data?.rows) ? res.data.data.rows : [],
    total: Number(res.data?.data?.total || 0),
    error: res.data?.error || null,
  };
}

// Detail
export async function getCoupon(id) {
  try {
    const res = await http.get(`/coupons/${id}`);
    return res.data?.data ?? null;
  } catch {
    return null;
  }
}

// Create (multipart)
export async function addCoupon(formData) {
  const res = await http.post(`/coupons`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return { data: res.data?.data ?? null, error: res.data?.error ?? null };
}

// Update (multipart)
export async function updateCoupon(id, formData) {
  const res = await http.put(`/coupons/${id}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return { data: res.data?.data ?? null, error: res.data?.error ?? null };
}

// Delete
export async function removeCoupon(id) {
  const res = await http.delete(`/coupons/${id}`);
  return { data: res.data?.data ?? null, error: res.data?.error ?? null };
}

// Toggle publish
export async function togglePublish(id) {
  const res = await http.patch(`/coupons/${id}/publish`);
  return { data: res.data?.data ?? null, error: res.data?.error ?? null };
}

// Toggle editor pick
export async function toggleEditorPick(id) {
  const res = await http.patch(`/coupons/${id}/editor-pick`);
  return { data: res.data?.data ?? null, error: res.data?.error ?? null };
}
