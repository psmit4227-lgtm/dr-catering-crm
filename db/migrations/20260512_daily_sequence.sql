-- 2026-05-12 — Per-delivery-date order sequence numbering.
--
-- daily_sequence is assigned once at INSERT time (see app/api/orders/route.js)
-- and never changes on edit. The big number prints on the kitchen PDF
-- (bottom-left) and pre-fills the # column on the Driver Delivery Schedule.
--
-- Run this in the Supabase SQL editor BEFORE deploying the new code, so the
-- POST endpoint can write to the column on new orders.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS daily_sequence INTEGER;

CREATE INDEX IF NOT EXISTS idx_orders_date_seq
  ON orders(delivery_date, daily_sequence);

-- One-time backfill for existing rows. Assigns sequence per delivery_date
-- based on the original created_at order, so historical rosters get sensible
-- numbers too.
UPDATE orders o
SET daily_sequence = sub.seq
FROM (
  SELECT id,
    ROW_NUMBER() OVER (PARTITION BY delivery_date ORDER BY created_at ASC) AS seq
  FROM orders
  WHERE daily_sequence IS NULL
) sub
WHERE o.id = sub.id;
