import axios from "axios";
import { API_BASE_URL } from "../config/api";

const http = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  withCredentials: true,
});

export async function listBlogCategories(params = {}) {
  try {
    const res = await http.get("/blog-categories", { params });
    return { data: res.data?.data ?? [], error: res.data?.error ?? null };
  } catch (err) {
    return { data: [], error: { message: err.message } };
  }
}

export async function getBlogCategory(id) {
  try {
    const res = await http.get(`/blog-categories/${id}`);
    return res.data?.data ?? null;
  } catch (err) {
    return null;
  }
}

export async function createBlogCategory(payload) {
  try {
    const res = await http.post("/blog-categories", payload);
    return { data: res.data?.data ?? null, error: res.data?.error ?? null };
  } catch (err) {
    return { data: null, error: { message: err.message } };
  }
}

export async function updateBlogCategory(id, payload) {
  try {
    const res = await http.put(`/blog-categories/${id}`, payload);
    return { data: res.data?.data ?? null, error: res.data?.error ?? null };
  } catch (err) {
    return { data: null, error: { message: err.message } };
  }
}

export async function deleteBlogCategory(id) {
  try {
    const res = await http.delete(`/blog-categories/${id}`);
    return { data: res.data?.data ?? null, error: res.data?.error ?? null };
  } catch (err) {
    return { data: null, error: { message: err.message } };
  }
}

export async function updateBlogCategoryStatus(id, is_publish) {
  try {
    const res = await http.patch(`/blog-categories/${id}/status`, {
      is_publish,
    });
    return { data: res.data?.data ?? null, error: res.data?.error ?? null };
  } catch (err) {
    return { data: null, error: { message: err.message } };
  }
}
