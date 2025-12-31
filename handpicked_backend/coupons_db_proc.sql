BEGIN;

-- Add nullable first to avoid long locks on very large tables,
-- then populate and set NOT NULL with default to avoid write-time overhead.
ALTER TABLE coupons ADD COLUMN click_count bigint;

-- Set existing rows to 0 (cheap update)
UPDATE coupons SET click_count = 0 WHERE click_count IS NULL;

-- Set default and not null constraint
ALTER TABLE coupons
  ALTER COLUMN click_count SET DEFAULT 0,
  ALTER COLUMN click_count SET NOT NULL;

COMMIT;



-- 2_add_index_coupons_merchant_clickcount.sql
CREATE INDEX IF NOT EXISTS idx_coupons_merchant_clickcount
  ON coupons (merchant_id, click_count DESC);



-- 3_create_rpc_increment_coupon_click_count.sql
CREATE OR REPLACE FUNCTION public.increment_coupon_click_count(p_id bigint)
RETURNS bigint AS $$
DECLARE
  new_count bigint;
BEGIN
  UPDATE coupons
  SET click_count = COALESCE(click_count, 0) + 1
  WHERE id = p_id
  RETURNING click_count INTO new_count;

  RETURN new_count;
END;
$$ LANGUAGE plpgsql STABLE;
