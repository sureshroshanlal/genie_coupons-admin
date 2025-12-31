export function getPagination(qs) {
  const page = Math.max(parseInt(qs.page || "1", 10), 1);
  const limit = Math.min(Math.max(parseInt(qs.limit || "20", 10), 1), 50);
  return { page, limit };
}
