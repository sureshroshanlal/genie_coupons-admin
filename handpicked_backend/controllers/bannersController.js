import { uploadImageBuffer } from "../services/storageService.js";
import * as BannersRepo from "../dbhelper/BannersRepo.js";
import sharp from "sharp";

const BUCKET = process.env.UPLOAD_BUCKET || "merchant-images";
const FOLDER = "banners";
const WEBP_QUALITY = 82;
const MAX_WIDTH = 1600;

const toInt = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const toBool = (v) => v === true || v === "true" || v === "1";

// ── List ──────────────────────────────────────────────────────────────────────

export async function listBanners(req, res) {
  try {
    const page = Math.max(1, toInt(req.query.page, 1));
    const limit = Math.min(100, Math.max(1, toInt(req.query.limit, 20)));
    const store_id = req.query.store_id
      ? Number(req.query.store_id)
      : undefined;
    const is_active =
      req.query.is_active !== undefined
        ? toBool(req.query.is_active)
        : undefined;

    const { rows, total } = await BannersRepo.list({
      page,
      limit,
      store_id,
      is_active,
    });
    return res.json({ data: { rows, total }, error: null });
  } catch (err) {
    console.error("listBanners error:", err);
    return res
      .status(500)
      .json({
        data: null,
        error: { message: "Error listing banners", details: err?.message },
      });
  }
}

// ── Get one ───────────────────────────────────────────────────────────────────

export async function getBanner(req, res) {
  try {
    const row = await BannersRepo.getById(req.params.id);
    if (!row)
      return res
        .status(404)
        .json({ data: null, error: { message: "Banner not found" } });
    return res.json({ data: row, error: null });
  } catch (err) {
    console.error("getBanner error:", err);
    return res
      .status(500)
      .json({
        data: null,
        error: { message: "Error fetching banner", details: err?.message },
      });
  }
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createBanner(req, res) {
  try {
    const b = req.body || {};
    const file = req.files?.image?.[0];

    if (!b.store_id)
      return res
        .status(400)
        .json({ data: null, error: { message: "store_id is required" } });
    if (!file)
      return res
        .status(400)
        .json({ data: null, error: { message: "Banner image is required" } });

    const imageUrl = await processAndUpload(file);
    if (!imageUrl)
      return res
        .status(500)
        .json({ data: null, error: { message: "Image upload failed" } });

    // aff_url takes priority over web_url — resolved at upload time
    const clickUrl = (b.aff_url || b.web_url || "").trim();
    if (!clickUrl)
      return res
        .status(400)
        .json({
          data: null,
          error: { message: "click_url (aff_url or web_url) is required" },
        });

    const payload = {
      store_id: Number(b.store_id),
      image_url: imageUrl,
      click_url: clickUrl,
      alt_text: (b.alt_text || "").trim(),
      label: (b.label || "").trim(),
      is_active: b.is_active !== undefined ? toBool(b.is_active) : true,
      display_order: toInt(b.display_order, 0),
    };

    const created = await BannersRepo.insert(payload);
    return res.status(201).json({ data: created, error: null });
  } catch (err) {
    console.error("createBanner error:", err);
    return res
      .status(500)
      .json({
        data: null,
        error: { message: "Error creating banner", details: err?.message },
      });
  }
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateBanner(req, res) {
  try {
    const { id } = req.params;
    const b = req.body || {};
    const file = req.files?.image?.[0];

    const patch = {};

    if (b.store_id !== undefined) patch.store_id = Number(b.store_id);
    if (b.alt_text !== undefined) patch.alt_text = b.alt_text.trim();
    if (b.label !== undefined) patch.label = b.label.trim();
    if (b.is_active !== undefined) patch.is_active = toBool(b.is_active);
    if (b.display_order !== undefined)
      patch.display_order = toInt(b.display_order, 0);

    // Recompute click_url if either url field sent
    if (b.aff_url !== undefined || b.web_url !== undefined) {
      patch.click_url = (b.aff_url || b.web_url || "").trim();
    }

    if (file) {
      const imageUrl = await processAndUpload(file);
      if (!imageUrl)
        return res
          .status(500)
          .json({ data: null, error: { message: "Image upload failed" } });
      patch.image_url = imageUrl;
    }

    const updated = await BannersRepo.update(id, patch);
    return res.json({ data: updated, error: null });
  } catch (err) {
    console.error("updateBanner error:", err);
    return res
      .status(500)
      .json({
        data: null,
        error: { message: "Error updating banner", details: err?.message },
      });
  }
}

// ── Toggle active ─────────────────────────────────────────────────────────────

export async function toggleActive(req, res) {
  try {
    const data = await BannersRepo.toggleActive(req.params.id);
    return res.json({ data, error: null });
  } catch (err) {
    console.error("toggleActive error:", err);
    return res
      .status(500)
      .json({
        data: null,
        error: { message: "Error toggling banner", details: err?.message },
      });
  }
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteBanner(req, res) {
  try {
    await BannersRepo.remove(req.params.id);
    return res.json({ data: { id: req.params.id }, error: null });
  } catch (err) {
    console.error("deleteBanner error:", err);
    return res
      .status(500)
      .json({
        data: null,
        error: { message: "Error deleting banner", details: err?.message },
      });
  }
}

// ── Internal ──────────────────────────────────────────────────────────────────

async function processAndUpload(file) {
  let buf = file.buffer;
  try {
    let img = sharp(buf);
    if (MAX_WIDTH)
      img = img.resize({ width: MAX_WIDTH, withoutEnlargement: true });
    buf = await img.webp({ quality: WEBP_QUALITY }).toBuffer();
  } catch (e) {
    console.error("Banner image conversion failed:", e);
    // fall through with original buffer
  }

  const base = (file.originalname || "banner").replace(/\.[^/.]+$/, "");
  const safeName = base.replace(/[^a-zA-Z0-9_-]/g, "_") + ".webp";

  const { url, error } = await uploadImageBuffer(
    BUCKET,
    FOLDER,
    buf,
    safeName,
    "image/webp",
  );
  if (error) {
    console.error("Banner upload error:", error);
    return null;
  }
  return url;
}
