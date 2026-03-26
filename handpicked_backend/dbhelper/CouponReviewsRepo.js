import { supabase } from "./dbclient.js";

const REVIEW_SELECT = `
  id,
  coupon_id,
  user_id,
  rating,
  comment,
  screenshot_url,
  status,
  created_at,
  updated_at,
  coupons ( title )
`;

/**
 * Fetch profiles for a list of user_ids and return a map: user_id -> profile.
 */
async function buildProfileMap(userIds) {
  if (!userIds.length) return {};
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, avatar_url")
    .in("id", userIds);
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((p) => [p.id, p]));
}

function attachProfiles(rows, profileMap) {
  return rows.map((r) => ({
    ...r,
    profiles: profileMap[r.user_id] ?? null,
  }));
}

/**
 * List reviews with joined coupon title and user profile.
 * Supports filtering by status, coupon_id, and pagination.
 */
export async function list({
  status = null,
  coupon_id = null,
  page = 1,
  limit = 20,
} = {}) {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("coupon_reviews")
    .select(REVIEW_SELECT, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (status) query = query.eq("status", status);
  if (coupon_id) query = query.eq("coupon_id", coupon_id);

  const { data, error, count } = await query;
  if (error) throw error;

  const profileMap = await buildProfileMap((data ?? []).map((r) => r.user_id));
  return { data: attachProfiles(data ?? [], profileMap), total: count };
}

export async function getById(id) {
  const { data, error } = await supabase
    .from("coupon_reviews")
    .select(REVIEW_SELECT)
    .eq("id", id)
    .single();
  if (error) throw error;

  const profileMap = await buildProfileMap([data.user_id]);
  return { ...data, profiles: profileMap[data.user_id] ?? null };
}

export async function updateStatus(id, status) {
  const { data, error } = await supabase
    .from("coupon_reviews")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Bulk update status for an array of ids.
 * Returns updated rows.
 */
export async function bulkUpdateStatus(ids, status) {
  const { data, error } = await supabase
    .from("coupon_reviews")
    .update({ status, updated_at: new Date().toISOString() })
    .in("id", ids)
    .select();
  if (error) throw error;
  return data;
}
