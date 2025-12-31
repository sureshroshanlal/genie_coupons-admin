// src/utils/validation.js
export function normalizeTagPayload(body) {
  const toNull = (v) => (v === "" || v === undefined ? null : v);

  const active =
    body.active === true ||
    body.active === "true" ||
    body.active === 1 ||
    body.active === "1";

  const display_order_num = Number.isFinite(Number(body.display_order))
    ? Number(body.display_order)
    : 0;

  return {
    tag_name: (body.tag_name || "").trim(),
    slug: (body.slug || "").trim(),
    parent_id: toNull(body.parent_id),
    active,
    display_order: display_order_num,
    meta_title: toNull((body.meta_title || "").trim()),
    meta_description: toNull((body.meta_description || "").trim()),
    meta_keywords: toNull((body.meta_keywords || "").trim()),
    existing_image_url: toNull(body.existing_image_url),
  };
}

export function validateTagPayload(
  fields,
  { requireName = true, requireSlug = false } = {}
) {
  const errors = [];

  if (requireName && !fields.tag_name) {
    errors.push("tag_name is required.");
  }
  if (requireSlug && !fields.slug) {
    errors.push("slug is required.");
  }
  if (fields.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(fields.slug)) {
    errors.push("slug must be URL-safe (lowercase letters, numbers, hyphens).");
  }
  if (
    fields.display_order != null &&
    Number.isNaN(Number(fields.display_order))
  ) {
    errors.push("display_order must be a number.");
  }
  if (fields.parent_id !== null && fields.parent_id !== undefined) {
    if (fields.parent_id !== "" && isNaN(Number(fields.parent_id))) {
      errors.push("parent_id must be a number or empty.");
    }
  }

  return { ok: errors.length === 0, errors };
}

export function valPage(v) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}
export function valLimit(v) {
  const n = Number(v);
  const x = Number.isFinite(n) ? Math.floor(n) : 20;
  return Math.min(Math.max(x, 1), 50);
}
export function valEnum(v, allowed, dflt) {
  const s = String(v || "").trim();
  return allowed.includes(s) ? s : dflt;
}
export function valLocale(v) {
  const s = String(v || "").trim();
  // Basic BCP 47 check (lenient)
  return /^[a-z]{2}(-[A-Z]{2})?$/.test(s) ? s : null;
}
export function requireQ(q) {
  const s = String(q || "").trim();
  return s.length ? s : null;
}

// derive locale from Accept-Language when explicit locale is absent/invalid
export function deriveLocale(req, fallback = "en") {
  const raw = String(req.headers?.["accept-language"] || "").trim();
  if (!raw) return fallback;

  // Take the first language tag before comma, strip any q-value
  const first = raw.split(",")?.trim().split(";")?.trim() || "";

  // Accept basic tags like "en" or "en-US"
  if (/^[a-z]{2}(-[A-Z]{2})?$/.test(first)) {
    return first;
  }

  // Fallback to primary subtag if it's valid (e.g., "en-GB-x-private" -> "en")
  const primary = first.split("-");
  if (/^[a-z]{2}$/.test(primary)) {
    return primary;
  }

  return fallback;
}
