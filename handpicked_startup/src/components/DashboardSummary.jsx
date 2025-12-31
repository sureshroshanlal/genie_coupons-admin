import React, { useEffect, useState } from "react";
import { fetchDashboardSummary } from "../services/dashboardService.js";

export default function DashboardSummary() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    (async () => {
      const data = await fetchDashboardSummary();
      setStats([
        { label: "Total Stores", value: data.totalStores },
        { label: "Top Coupons", value: data.topCoupons },
        { label: "Published Blogs", value: data.publishedBlogs },
      ]);
    })();
  }, []);

  if (!stats) {
    return (
      <section className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Welcome to HandPicked CMS</h1>
        <div className="flex flex-wrap gap-6">
          <div className="text-gray-500">Loading summary...</div>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Welcome to HandPicked CMS</h1>
      <div className="flex flex-wrap gap-6">
        {stats.map(({ label, value }) => (
          <div
            key={label}
            className="bg-white rounded-lg p-6 shadow-md w-64 flex flex-col"
          >
            <span className="text-gray-600">{label}</span>
            <span className="text-3xl font-extrabold mt-2">{value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
