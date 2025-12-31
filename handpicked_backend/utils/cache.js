import { memoryCacheStore } from "./cacheStore.js";

function buildCacheKey(req, keyExtra = "") {
  const method = req.method || "GET";
  const origin =
    (req.headers["x-forwarded-proto"]
      ? String(req.headers["x-forwarded-proto"])
      : req.protocol) +
    "://" +
    req.get("host");

  // Path without query
  const path = req.originalUrl ? req.originalUrl.split("?") : req.path;

  // Sorted query string for deterministic keys
  const params = new URLSearchParams(req.query || {});
  const sorted = new URLSearchParams();
  Array.from(params.keys())
    .sort()
    .forEach((k) => {
      const v = params.getAll(k);
      if (v.length === 1) sorted.set(k, v ?? "");
      else v.sort().forEach((x) => sorted.append(k, x ?? ""));
    });

  const queryStr = sorted.toString();
  const base =
    `${method}` | `${origin}${path}${queryStr ? "?" + queryStr : ""}`;
  return keyExtra ? `${base}` | `${keyExtra}` : base;
}

/**

withCache(req, compute, options?)
ttlSeconds: number (default 60)
keyExtra: string (optional suffix to distinguish call-site variants)
skip: boolean (if true, bypass cache)
*/
export async function withCache(req, compute, options = {}) {
  const {
    ttlSeconds = Number(process.env.CACHE_TTL_PUBLIC || 60),
    keyExtra = "",
    skip = false,
  } = options;

  if (skip) {
    return await compute();
  }

  const key = buildCacheKey(req, keyExtra);
  // Try cache
  const cached = await memoryCacheStore.get(key);
  if (cached !== null && cached !== undefined) {
    return cached;
  }

  // Miss -> compute and store
  const value = await compute();

  // Only cache non-nullish values
  if (value !== null && value !== undefined) {
    await memoryCacheStore.set(key, value, ttlSeconds);
  }

  return value;
}
