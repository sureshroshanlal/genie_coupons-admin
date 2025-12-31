// src/services/tagService.js
import axios from "axios";
import { API_BASE_URL } from "src/config/api";

// Centralized axios instance
const http = axios.create({
  baseURL: `${API_BASE_URL}/api/tags`,
  headers: { "Content-Type": "application/json" },
});

// Common error formatter
function toServiceError(error) {
  const status = error?.response?.status;
  const payload = error?.response?.data;
  const message =
payload?.error?.message ||
payload?.error ||
payload?.message ||
error?.message ||
"Request failed";
return { message, status, details: payload, raw: error };
}

// -------- Existing methods (unchanged) --------
export async function getTags() {
  try {
    const res = await http.get("/");
    const api = res.data;
    const list = Array.isArray(api?.data) ? api.data : [];
    return { data: list, error:api?.error || null };
  } catch (err) {
    return { data: [], error: toServiceError(err) };
  }
}

export async function createTag(tagData) {
  try {
    const res = await http.post("/", tagData);
    const api = res.data;
    return { data: api?.data ?? null, error: api?.error || null };
  } catch (err) {
    return { data: null, error: toServiceError(err) };
  }
}

// ✅ Already added earlier
export async function createTagWithImage(formData) {
  try {
    const res = await http.post("/", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    const api = res.data;
    return { data: api?.data ?? null, error: api?.error || null };
  } catch (err) {
    return { data: null, error: toServiceError(err) };
  }
}

export async function updateTag(tagId, tagData) {
  try {
    const res = await http.put(`/${tagId}`, tagData);
    const api = res.data;
    return { data: api?.data ?? null, error: api?.error || null };
  } catch (err) {
    return { data: null, error: toServiceError(err) };
  }
}

// ✅ NEW: Update tag with FormData (including image & new fields)
export async function updateTagWithImage(tagId, formData) {
  try {
    const res = await http.put(`/${tagId}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    const api = res.data;
    return { data: api?.data ?? null, error: api?.error || null };
  } catch (err) {
    return { data: null, error: toServiceError(err) };
  }
}

export async function deleteTag(tagId) {
  try {
    const res = await http.delete(`/${tagId}`);
    const api = res.data;
    return { data: api?.data ?? null, error: api?.error || null };
  } catch (err) {
    return { data: null, error: toServiceError(err) };
  }
}