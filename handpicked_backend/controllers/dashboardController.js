// controllers/dashboardController.js
import * as merchantRepo from "../dbhelper/MerchantRepo.js";
import * as couponRepo from "../dbhelper/CouponsRepo.js";
import * as blogRepo from "../dbhelper/BlogRepo.js";

export async function getSummary(req, res) {
  try {
    const [stores, coupons, blogs] = await Promise.all([
      merchantRepo.count(),
      couponRepo.countTopCoupons(),
      blogRepo.countPublished(),
    ]);

    return res.json({
      data: {
        totalStores: stores,
        topCoupons: coupons,
        publishedBlogs: blogs,
      },
      error: null,
    });
  } catch (err) {
    console.error("Dashboard summary error:", err);
    return res.status(500).json({
      data: null,
      error: {
        message:
          err.message || err?.details || "Error fetching dashboard summary",
        details: err,
      },
    });
  }
}
