import * as reviewRepo from "../dbhelper/CouponReviewsRepo.js";

const VALID_STATUSES = ["pending", "approved", "rejected"];

const toError = (err, msg = "Server error") => ({
  data: null,
  error: { message: msg, details: err?.message || err },
});

export async function listReviews(req, res) {
  try {
    const { status, coupon_id, page = 1, limit = 20 } = req.query;

    if (status && !VALID_STATUSES.includes(status)) {
      return res
        .status(400)
        .json({ data: null, error: { message: "Invalid status value" } });
    }

    const { data, total } = await reviewRepo.list({
      status: status || null,
      coupon_id: coupon_id ? Number(coupon_id) : null,
      page: Math.max(1, Number(page)),
      limit: Math.min(100, Math.max(1, Number(limit))),
    });

    return res.json({ data, total, error: null });
  } catch (err) {
    return res.status(500).json(toError(err, "Error fetching reviews"));
  }
}

export async function getReview(req, res) {
  try {
    const row = await reviewRepo.getById(req.params.id);
    if (!row) return res.status(404).json(toError({}, "Review not found"));
    return res.json({ data: row, error: null });
  } catch (err) {
    return res.status(500).json(toError(err, "Error fetching review"));
  }
}

export async function updateReviewStatus(req, res) {
  try {
    const { status } = req.body;
    if (!status || !VALID_STATUSES.includes(status)) {
      return res
        .status(400)
        .json({
          data: null,
          error: {
            message: `status must be one of: ${VALID_STATUSES.join(", ")}`,
          },
        });
    }
    const updated = await reviewRepo.updateStatus(req.params.id, status);
    return res.json({ data: updated, error: null });
  } catch (err) {
    return res.status(500).json(toError(err, "Error updating review status"));
  }
}

export async function bulkUpdateReviewStatus(req, res) {
  try {
    const { ids, status } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res
        .status(400)
        .json({
          data: null,
          error: { message: "ids must be a non-empty array" },
        });
    }
    if (!status || !VALID_STATUSES.includes(status)) {
      return res
        .status(400)
        .json({
          data: null,
          error: {
            message: `status must be one of: ${VALID_STATUSES.join(", ")}`,
          },
        });
    }
    if (ids.length > 100) {
      return res
        .status(400)
        .json({
          data: null,
          error: {
            message: "Cannot bulk update more than 100 records at once",
          },
        });
    }

    const updated = await reviewRepo.bulkUpdateStatus(ids, status);
    return res.json({ data: updated, error: null });
  } catch (err) {
    return res
      .status(500)
      .json(toError(err, "Error bulk updating review status"));
  }
}
