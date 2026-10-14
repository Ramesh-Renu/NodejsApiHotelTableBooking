-- =============================================================================
-- Production release: database changes (PostgreSQL)
-- Date: 2026-10-14
--
-- Run AFTER 2026-10-13_production_release.sql (if that one is not applied
-- yet, run it first).
--
-- Safe to run more than once: every step checks whether it is already done.
-- Runs in one transaction; if any step fails, nothing is applied.
--
-- How to run (Neon, console.neon.tech):
--   1. Backup: Branches -> Create branch from the production branch
--      (e.g. "before-2026-10-14"). It is an instant copy to restore from.
--   2. Stop the API (it also applies these changes on start; running the
--      script first keeps the deploy predictable).
--   3. SQL Editor -> pick the production branch + database -> paste this
--      whole file -> Run. The last result shows the checks (all 0).
--      (Or from a terminal: psql "<Neon connection string>" -v ON_ERROR_STOP=1 -f <this file>)
--   4. Deploy the new API + PWA build, then start the API.
--
-- Contents
--   1. Reservations   guest name / mobile (bookings staff make for a guest)
--   2. Orders         when and by whom an order was cancelled
--   3. Reservations   stage history (booking stage tracker)
--   4. Checks
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Reservations: who the table is for. The API already sent these fields;
--    the columns were missing, so they were dropped. Existing bookings stay
--    NULL (the booking's user is the guest).
-- -----------------------------------------------------------------------------
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "customer_name"   VARCHAR(100);
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "customer_mobile" VARCHAR(15);

-- -----------------------------------------------------------------------------
-- 2. Orders: cancellation time and who cancelled ("Admin" or the customer's
--    name, as shown on the Cancelled card). Orders cancelled before this
--    release stay NULL (the card then shows just "Cancelled").
-- -----------------------------------------------------------------------------
ALTER TABLE "reservation_orders" ADD COLUMN IF NOT EXISTS "cancelled_at"      TIMESTAMPTZ;
ALTER TABLE "reservation_orders" ADD COLUMN IF NOT EXISTS "cancelled_by"      INTEGER;
ALTER TABLE "reservation_orders" ADD COLUMN IF NOT EXISTS "cancelled_by_name" VARCHAR(100);
ALTER TABLE "reservation_orders" ADD COLUMN IF NOT EXISTS "cancel_reason"     VARCHAR(200);

-- -----------------------------------------------------------------------------
-- 3. Reservations: when the booking entered each stage, [{ "status", "at" }].
--    Existing bookings start from what is known: Confirmed at booking time,
--    then the current stage at the last update.
-- -----------------------------------------------------------------------------
ALTER TABLE "reservations"
  ADD COLUMN IF NOT EXISTS "status_history" JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE "reservations"
   SET "status_history" =
         jsonb_build_array(jsonb_build_object('status', 1, 'at', "booking_date"))
         || CASE WHEN "dining_status" <> 1
                 THEN jsonb_build_array(jsonb_build_object('status', "dining_status", 'at', "updated_at"))
                 ELSE '[]'::jsonb END
 WHERE "status_history" = '[]'::jsonb;

-- -----------------------------------------------------------------------------
-- 4. Checks (expect 0 in every row)
-- -----------------------------------------------------------------------------
SELECT 'reservations missing customer_name column' AS "check", COUNT(*) AS "count"
  FROM (SELECT 1) x
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reservations' AND column_name = 'customer_name'
  )
UNION ALL
SELECT 'reservations missing customer_mobile column', COUNT(*)
  FROM (SELECT 1) x
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reservations' AND column_name = 'customer_mobile'
  )
UNION ALL
SELECT 'reservation_orders missing cancellation columns', 4 - COUNT(*)
  FROM information_schema.columns
  WHERE table_name = 'reservation_orders'
    AND column_name IN ('cancelled_at', 'cancelled_by', 'cancelled_by_name', 'cancel_reason')
UNION ALL
SELECT 'reservations without stage history', COUNT(*)
  FROM "reservations" WHERE "status_history" = '[]'::jsonb;

COMMIT;
