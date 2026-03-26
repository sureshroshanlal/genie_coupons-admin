import axios from "axios";
import { API_BASE_URL } from "../config/api";

const http = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  withCredentials: true,
});

export async function listReviews(params = {}) {
  try {
    const res = await http.get("/coupon-reviews", { params });
    return {
      data: res.data?.data ?? [],
      total: res.data?.total ?? 0,
      error: res.data?.error ?? null,
    };
  } catch (err) {
    return { data: [], total: 0, error: { message: err.message } };
  }
}

export async function getReview(id) {
  try {
    const res = await http.get(`/coupon-reviews/${id}`);
    return { data: res.data?.data ?? null, error: res.data?.error ?? null };
  } catch (err) {
    return { data: null, error: { message: err.message } };
  }
}

export async function updateReviewStatus(id, status) {
  try {
    const res = await http.patch(`/coupon-reviews/${id}/status`, { status });
    return { data: res.data?.data ?? null, error: res.data?.error ?? null };
  } catch (err) {
    return { data: null, error: { message: err.message } };
  }
}

export async function bulkUpdateReviewStatus(ids, status) {
  try {
    const res = await http.post("/coupon-reviews/bulk-status", { ids, status });
    return { data: res.data?.data ?? null, error: res.data?.error ?? null };
  } catch (err) {
    return { data: null, error: { message: err.message } };
  }
}
