import { Router } from "express";
import {
  listReviews,
  getReview,
  updateReviewStatus,
  bulkUpdateReviewStatus,
} from "../controllers/couponReviewsController.js";

const router = Router();

// GET  /api/coupon-reviews?status=pending&page=1&limit=20&coupon_id=
router.get("/", listReviews);

// GET  /api/coupon-reviews/:id
router.get("/:id", getReview);

// PATCH /api/coupon-reviews/:id/status   body: { status }
router.patch("/:id/status", updateReviewStatus);

// POST /api/coupon-reviews/bulk-status   body: { ids: [], status }
router.post("/bulk-status", bulkUpdateReviewStatus);

export default router;
