// src/services/blogService.js
import axios from "axios";
import { API_BASE_URL } from "../config/api";

const http = axios.create({
  baseURL: `${API_BASE_URL}/api`, // matches your other services
  withCredentials: true,
});

export async function listBlogs(params = {}) {
  try {
    const res = await http.get("/blogs", { params });
    return { data: res.data?.data ?? [], error: res.data?.error ?? null };
  } catch (err) {
    return { data: [], error: { message: err.message } };
  }
}

export async function createBlog(formData) {
  try {
    const res = await http.post("/blogs", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return { data: res.data?.data ?? null, error: res.data?.error ?? null };
  } catch (err) {
    return { data: null, error: { message: err.message } };
  }
}

export async function deleteBlog(id) {
  try {
    const res = await http.delete(`/blogs/${id}`);
    return { data: res.data?.data ?? null, error: res.data?.error ?? null };
  } catch (err) {
    return { data: null, error: { message: err.message } };
  }
}

export async function fetchBlogAux() {
  try {
    const [catsRes, authsRes] = await Promise.all([
      http.get("/blog-categories"),
      http.get("/authors"),
    ]);
    const rawCategories = Array.isArray(catsRes.data?.data)
      ? catsRes.data.data
      : [];
    const rawAuthors = Array.isArray(authsRes.data?.data)
      ? authsRes.data.data
      : [];

    // Normalize to ensure predictable fields for the selects
    const categories = rawCategories.map((c) => ({
      id: c.id,
      name: c.name ?? c.category_name ?? `Category #${c.id}`,
    }));

    const authors = rawAuthors.map((a) => ({
      id: a.id,
      name: a.name ?? a.full_name ?? a.display_name ?? `Author #${a.id}`,
      // Keep originals if UI wants to display differently later
      full_name: a.full_name,
      display_name: a.display_name,
    }));

    return { categories, authors };
  } catch (err) {
    console.error("fetchBlogAux failed:", err?.message || err);
    return { categories: [], authors: [] };
  }
}

export async function updateBlogStatus(id, is_publish) {
  try {
    const res = await http.patch(`/blogs/${id}/status`, { is_publish });
    return { data: res.data?.data ?? null, error: res.data?.error ?? null };
  } catch (err) {
    return { data: null, error: { message: err.message } };
  }
}

export async function updateBlog(id, formData) {
  try {
    const res = await http.put(`/blogs/${id}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return { data: res.data?.data ?? null, error: res.data?.error ?? null };
  } catch (err) {
    return { data: null, error: { message: err.message } };
  }
}

export async function getBlog(id) {
  try {
    const res = await http.get(`/blogs/${id}`);
    return res.data?.data ?? null;
  } catch (err) {
    return null;
  }
}

export async function uploadBlogImage(file) {
  const fd = new FormData();
  fd.append("file", file);

  try {
    const res = await http.post("/blogs/upload", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    if (res.data?.error) {
      throw new Error(res.data.error.message || "Image upload failed");
    }

    return res.data.url; // backend returns { url }
  } catch (err) {
    console.error("Upload image failed:", err);
    throw err;
  }
}
