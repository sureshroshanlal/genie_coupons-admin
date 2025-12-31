// src/services/tagStoreService.js

import axios from "axios";
import { API_BASE_URL } from "src/config/api";

// Centralized axios instance
const http = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: { "Content-Type": "application/json" },
});

// UPDATED: Common error parser
function toServiceError(error) {
  const status = error?.response?.status;
  const message =
    error?.response?.data?.message ||
    error?.message ||
    "Unknown API error";
  const details = error?.response?.data || null;
  return { message, status, details, raw: error };
}

/**
 * Fetch all stores linked to a tag
 * @param {string|number} tagId
 * @returns {Promise<{data: Array|null, error: object|null}>}
 */
export async function getStoresByTag(tagId) {
  try {
    const res = await http.get(`/tags/${tagId}/stores`);
    return {
      data: res.data?.data ?? [],
      error: res.data?.error ?? null
    };  } catch (err) {
    return { data: null, error: toServiceError(err) };
  }
}

/**
 * Search stores by keyword
 * @param {string} query
 * @returns {Promise<{data: Array|null, error: object|null}>}
 */
export async function searchStores(query) {
  try {
    const res = await http.get(`/tags/stores/search`, { params: { query } });
    return {
      data: res.data?.data ?? [],
      error: res.data?.error ?? null
    };
  } catch (err) {
    return { data: null, error: toServiceError(err) };
  }
}

/**
 * Add store to a tag
 * @param {string|number} tagId
 * @param {string|number} storeId
 * @returns {Promise<{data: any, error: object|null}>}
 */
export async function addStoreToTag(tagId, storeId) {
  try {
    const res = await http.post(`/tags/${tagId}/stores`, { storeId });
    return { data: res.data, error: null };
  } catch (err) {
    return { data: null, error: toServiceError(err) };
  }
}

/**
 * Remove store from a tag
 * @param {string|number} tagId
 * @param {string|number} storeId
 * @returns {Promise<{data: any, error: object|null}>}
 */
export async function removeStoreFromTag(tagId, storeId) {
  try {
    const res = await http.delete(`/tags/${tagId}/stores/${storeId}`);
    return { data: res.data, error: null };
  } catch (err) {
    return { data: null, error: toServiceError(err) };
  }
}