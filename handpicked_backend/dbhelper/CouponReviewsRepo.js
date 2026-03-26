import { supabase } from "./dbclient.js";

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
    .select(
      `
      id,
      coupon_id,
      user_id,
      rating,
      comment,
      screenshot_url,
      status,
      created_at,
      updated_at,
      coupons ( title ),
      profiles ( full_name, email, avatar_url )
      `,
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (status) query = query.eq("status", status);
  if (coupon_id) query = query.eq("coupon_id", coupon_id);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data, total: count };
}

export async function getById(id) {
  const { data, error } = await supabase
    .from("coupon_reviews")
    .select(
      `
      id,
      coupon_id,
      user_id,
      rating,
      comment,
      screenshot_url,
      status,
      created_at,
      updated_at,
      coupons ( title ),
      profiles ( full_name, email, avatar_url )
      `,
    )
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
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
