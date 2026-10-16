-- =============================================================================
-- Production release: database changes (PostgreSQL)
-- Date: 2026-10-15
--
-- Run AFTER 2026-10-14_production_release.sql (if that one is not applied
-- yet, run it first).
--
-- No schema changes in this release: no new tables or columns. Everything
-- new uses existing columns:
--   - floor plan "End Time" per seat      reservations.dining_date (+ 60 min)
--   - order card booking time and the     reservations.dining_date
--     "Preparing from 15 min before" rule
--   - admin "Booking for" guest box       reservations.customer_name / _mobile
--   - booking -> Serving serves its       reservation_orders.order_status,
--     Ready orders                        served_at, completed_at, server_id
--
-- This script only brings existing data in line with the new Serving rule
-- (section 1). Safe to run more than once: it only touches rows that still
-- need it. Runs in one transaction; if any step fails, nothing is applied.
--
-- How to run (Neon, console.neon.tech):
--   1. Backup: Branches -> Create branch from the production branch
--      (e.g. "before-2026-10-15"). It is an instant copy to restore from.
--   2. Stop the API.
--   3. SQL Editor -> pick the production branch + database -> paste this
--      whole file -> Run. The last result shows the checks (all 0).
--      (Or from a terminal: psql "<Neon connection string>" -v ON_ERROR_STOP=1 -f <this file>)
--   4. Deploy the new API + PWA build, then start the API.
--
-- Contents
--   1. Orders   Ready orders of bookings already at the table (Serving /
--               Cleaning) are marked Served
--   2. Checks
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. From this release, moving a booking to Serving serves its Ready orders
--    (the food has reached the table). Bookings that were already in Serving
--    or Cleaning before the release can still have Ready orders waiting on
--    the Orders board; serve them the same way the API now does:
--      - order_status  -> Served
--      - served_at / completed_at -> now, unless already set
--      - server_id     -> the table's server, when the order has none
--    reservation_orders.order_status: 4 = Ready, 5 = Served
--    reservations.dining_status:      7 = Serving, 6 = Cleaning
-- -----------------------------------------------------------------------------
UPDATE "reservation_orders" o
   SET "order_status" = 5,
       "served_at"    = COALESCE(o."served_at", NOW()),
       "completed_at" = COALESCE(o."completed_at", NOW()),
       "server_id"    = COALESCE(o."server_id", r."server_id"),
       "updatedAt"    = NOW()
  FROM "reservations" r
 WHERE o."reservation_id" = r."id"
   AND o."order_status" = 4
   AND r."dining_status" IN (7, 6);

-- -----------------------------------------------------------------------------
-- 2. Checks (expect 0 in every row)
-- -----------------------------------------------------------------------------
SELECT 'ready orders of bookings at Serving / Cleaning' AS "check", COUNT(*) AS "count"
  FROM "reservation_orders" o
  JOIN "reservations" r ON r."id" = o."reservation_id"
 WHERE o."order_status" = 4
   AND r."dining_status" IN (7, 6)
UNION ALL
SELECT 'served orders without served_at', COUNT(*)
  FROM "reservation_orders"
 WHERE "order_status" = 5 AND "served_at" IS NULL;

COMMIT;
