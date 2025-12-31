// src/services/dashboardService.js
import axios from "axios";
import { API_BASE_URL } from "../config/api";

const http = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  withCredentials: true,
});

export async function fetchDashboardSummary() {
  try {
    const res = await http.get("/dashboard/summary");
    return (
      res.data?.data ?? { totalStores: 0, topCoupons: 0, publishedBlogs: 0 }
    );
  } catch (err) {
    console.error("fetchDashboardSummary error:", err.message);
    return { totalStores: 0, topCoupons: 0, publishedBlogs: 0 };
  }
}
