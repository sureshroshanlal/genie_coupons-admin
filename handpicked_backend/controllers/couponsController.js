// src/controllers/couponsController.js
import { uploadImageBuffer } from "../services/storageService.js";
import * as CouponsRepo from "../dbhelper/CouponsRepo.js";

const BUCKET = process.env.UPLOAD_BUCKET || "coupon-images";
const FOLDER = "coupons";

const toBool = (v) => v === true || v === "true" || v === "1";
const toInt = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

// List
export async function listCoupons(req, res) {
  try {
    const params = {
      search: req.query.search || "",
      store_id: req.query.store_id ? Number(req.query.store_id) : undefined,
      type: req.query.type || "",
      status: req.query.status || "",
      category_id: req.query.category_id
        ? Number(req.query.category_id)
        : undefined,
      filter: req.query.filter || "",
      from_date: req.query.from_date || "",
      to_date: req.query.to_date || "",
      page: Math.max(1, toInt(req.query.page || 1, 1)),
      limit: Math.min(100, Math.max(1, toInt(req.query.limit || 20, 20))),
    };
    const { rows, total } = await CouponsRepo.list(params);
    return res.json({ data: { rows, total }, error: null });
  } catch (err) {
    return res
      .status(500)
      .json({
        data: null,
        error: {
          message: "Error listing coupons",
          details: err?.message || err,
        },
      });
  }
}

// Detail
export async function getCoupon(req, res) {
  try {
    const data = await CouponsRepo.getById(req.params.id);
    return res.json({ data, error: null });
  } catch (err) {
    return res
      .status(500)
      .json({
        data: null,
        error: {
          message: "Error fetching coupon",
          details: err?.message || err,
        },
      });
  }
}

// Create
export async function createCoupon(req, res) {
  try {
    const b = req.body || {};
    const f = req.files || {};

    const payload = {
      merchant_id: b.store_id ? Number(b.store_id) : null,
      coupon_type: b.coupon_type || "coupon", // 'coupon' | 'deal'
      title: b.title || "",
      h_block: b.h_block || "",
      coupon_code:
        (b.coupon_type || "coupon") === "coupon" ? b.coupon_code || "" : "",
      aff_url: b.aff_url || "",
      description: b.description || "",
      filter_id: b.filter_id ? Number(b.filter_id) : null,
      category_id: b.category_id ? Number(b.category_id) : null,
      show_proof: toBool(b.show_proof),
      ends_at: b.expiry_date || null,
      starts_at: b.schedule_date || null,
      is_editor: toBool(b.editor_pick),
      editor_order: toInt(b.editor_order || 0, 0),
      coupon_style: b.coupon_style || "custom",
      special_msg_type: b.special_msg_type || "",
      special_msg: b.special_msg || "",
      push_to: b.push_to || "",
      level: b.level || "",
      home: toBool(b.home),
      is_brand_coupon: toBool(b.is_brand_coupon),
      is_publish: b.is_publish,
      click_count: b.click_count ? Number(b.click_count) : 0,
    };

    if (f.image?.[0]) {
      const file = f.image[0];
      const { url, error } = await uploadImageBuffer(
        BUCKET,
        FOLDER,
        file.buffer,
        file.originalname,
        file.mimetype
      );
      if (error)
        return res
          .status(500)
          .json({
            data: null,
            error: { message: "Image upload failed", details: error },
          });
      payload.image_url = url;
    }
    if (f.proof_image?.[0]) {
      const file = f.proof_image[0];
      const { url, error } = await uploadImageBuffer(
        BUCKET,
        FOLDER,
        file.buffer,
        file.originalname,
        file.mimetype
      );
      if (error)
        return res
          .status(500)
          .json({
            data: null,
            error: { message: "Proof image upload failed", details: error },
          });
      payload.proof_image_url = url;
    }

    const created = await CouponsRepo.insert(payload);
    return res.status(201).json({ data: created, error: null });
  } catch (err) {
    return res
      .status(500)
      .json({
        data: null,
        error: {
          message: "Error creating coupon",
          details: err?.message || err,
        },
      });
  }
}

// Update
export async function updateCoupon(req, res) {
  try {
    const { id } = req.params;
    const b = req.body || {};
    const f = req.files || {};

    const patch = {
      merchant_id:
        b.store_id !== undefined
          ? b.store_id
            ? Number(b.store_id)
            : null
          : undefined,
      coupon_type: b.coupon_type ?? undefined,
      title: b.title ?? undefined,
      h_block: b.h_block ?? undefined,
      coupon_code:
        b.coupon_type === "coupon"
          ? b.coupon_code ?? ""
          : b.coupon_type === "deal"
          ? ""
          : undefined,
      aff_url: b.aff_url ?? undefined,
      description: b.description ?? undefined,
      filter_id:
        b.filter_id !== undefined
          ? b.filter_id
            ? Number(b.filter_id)
            : null
          : undefined,
      category_id:
        b.category_id !== undefined
          ? b.category_id
            ? Number(b.category_id)
            : null
          : undefined,
      show_proof: b.show_proof !== undefined ? toBool(b.show_proof) : undefined,
      ends_at: b.expiry_date !== undefined ? b.expiry_date || null : undefined,
      starts_at:
        b.schedule_date !== undefined ? b.schedule_date || null : undefined,
      is_editor:
        b.editor_pick !== undefined ? toBool(b.editor_pick) : undefined,
      editor_order:
        b.editor_order !== undefined
          ? toInt(b.editor_order || 0, 0)
          : undefined,
      coupon_style: b.coupon_style ?? undefined,
      special_msg_type: b.special_msg_type ?? undefined,
      special_msg: b.special_msg ?? undefined,
      push_to: b.push_to ?? undefined,
      level: b.level ?? undefined,
      home: b.home !== undefined ? toBool(b.home) : undefined,
      is_brand_coupon:
        b.is_brand_coupon !== undefined ? toBool(b.is_brand_coupon) : undefined,
    };

    if (f.image?.[0]) {
      const file = f.image[0];
      const { url, error } = await uploadImageBuffer(
        BUCKET,
        FOLDER,
        file.buffer,
        file.originalname,
        file.mimetype
      );
      if (error)
        return res
          .status(500)
          .json({
            data: null,
            error: { message: "Image upload failed", details: error },
          });
      patch.image_url = url;
    }
    if (f.proof_image?.[0]) {
      const file = f.proof_image[0];
      const { url, error } = await uploadImageBuffer(
        BUCKET,
        FOLDER,
        file.buffer,
        file.originalname,
        file.mimetype
      );
      if (error)
        return res
          .status(500)
          .json({
            data: null,
            error: { message: "Proof image upload failed", details: error },
          });
      patch.proof_image_url = url;
    }

    const updated = await CouponsRepo.update(id, patch);
    return res.json({ data: updated, error: null });
  } catch (err) {
    return res
      .status(500)
      .json({
        data: null,
        error: {
          message: "Error updating coupon",
          details: err?.message || err,
        },
      });
  }
}

// Toggle publish
export async function togglePublish(req, res) {
  try {
    const { id } = req.params;
    const data = await CouponsRepo.togglePublish(id);
    return res.json({ data, error: null });
  } catch (err) {
    return res
      .status(500)
      .json({
        data: null,
        error: {
          message: "Error toggling publish",
          details: err?.message || err,
        },
      });
  }
}

// Toggle editor pick
export async function toggleEditorPick(req, res) {
  try {
    const { id } = req.params;
    const data = await CouponsRepo.toggleEditorPick(id);
    return res.json({ data, error: null });
  } catch (err) {
    return res
      .status(500)
      .json({
        data: null,
        error: {
          message: "Error toggling editor pick",
          details: err?.message || err,
        },
      });
  }
}

// Delete
export async function deleteCoupon(req, res) {
  try {
    const { id } = req.params;
    const ok = await CouponsRepo.remove(id);
    if (!ok)
      return res
        .status(500)
        .json({ data: null, error: { message: "Failed to delete coupon" } });
    return res.json({ data: { id }, error: null });
  } catch (err) {
    return res
      .status(500)
      .json({
        data: null,
        error: {
          message: "Error deleting coupon",
          details: err?.message || err,
        },
      });
  }
}
