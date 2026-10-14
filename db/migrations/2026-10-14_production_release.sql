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
--   2. Checks
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
-- 2. Checks (expect 0 in every row)
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
  );

COMMIT;
