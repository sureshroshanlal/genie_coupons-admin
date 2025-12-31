export function badRequest(res, message) {
  return res.status(400).json({ data: null, meta: { error: { message } } });
}
