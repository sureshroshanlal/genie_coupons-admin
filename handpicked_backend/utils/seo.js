export function buildCanonical({
  origin,
  path,
  page,
  limit,
  q,
  categorySlug,
  storeSlug,
  sort,
}) {
  const url = new URL(`${origin}${path}`);
  if (q) url.searchParams.set("q", q);
  if (categorySlug) url.searchParams.set("category", categorySlug);
  if (storeSlug) url.searchParams.set("store", storeSlug);
  if (sort) url.searchParams.set("sort", sort);
  if (page && page !== 1) url.searchParams.set("page", String(page));
  if (limit && limit !== 20) url.searchParams.set("limit", String(limit));
  return url.toString();
}
