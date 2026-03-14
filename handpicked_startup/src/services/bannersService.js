// src/services/bannersService.js
import axios from "axios";
import { API_BASE_URL } from "../config/api";

const http = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  withCredentials: true,
});

// List with filters + pagination
export async function listBanners({
  page = 1,
  limit = 20,
  store_id = "",
  is_active = "",
} = {}) {
  try {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(limit));
    if (store_id !== "") params.set("store_id", String(store_id));
    if (is_active !== "") params.set("is_active", String(is_active));
    const res = await http.get(`/banners?${params.toString()}`);
    return {
      rows: Array.isArray(res.data?.data?.rows) ? res.data.data.rows : [],
      total: Number(res.data?.data?.total || 0),
      error: res.data?.error || null,
    };
  } catch (err) {
    return { rows: [], total: 0, error: { message: err.message } };
  }
}

// Detail
export async function getBanner(id) {
  try {
    const res = await http.get(`/banners/${id}`);
    return res.data?.data ?? null;
  } catch (err) {
    return null;
  }
}

// Create (multipart)
export async function addBanner(formData) {
  try {
    const res = await http.post(`/banners`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return { data: res.data?.data ?? null, error: res.data?.error ?? null };
  } catch (err) {
    return { data: null, error: { message: err.message } };
  }
}

// Update (multipart)
export async function updateBanner(id, formData) {
  try {
    const res = await http.put(`/banners/${id}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return { data: res.data?.data ?? null, error: res.data?.error ?? null };
  } catch (err) {
    return { data: null, error: { message: err.message } };
  }
}

// Toggle active/inactive
export async function toggleBanner(id) {
  try {
    const res = await http.patch(`/banners/${id}/toggle`);
    return { data: res.data?.data ?? null, error: res.data?.error ?? null };
  } catch (err) {
    return { data: null, error: { message: err.message } };
  }
}

// Delete
export async function removeBanner(id) {
  try {
    const res = await http.delete(`/banners/${id}`);
    return { data: res.data?.data ?? null, error: res.data?.error ?? null };
  } catch (err) {
    return { data: null, error: { message: err.message } };
  }
}
