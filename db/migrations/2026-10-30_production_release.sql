-- =============================================================================
-- Production release: database changes (PostgreSQL)
-- Date: 2026-10-30
--
-- Run AFTER 2026-10-16_production_release.sql (if that one is not applied
-- yet, run it first).
--
-- New in this release: waiting list. Staff put a guest on the waiting list
-- for chosen seats; those seats show as Booked to customers. An entry is a
-- reservation with dining_status 8 = Waiting.
--
-- No schema changes: no new tables or columns. This script only adds the
-- Waiting row to the dining status master (the Reservations board builds its
-- columns from it).
--
-- The API adds this row itself on start (config/db.js); this script is for
-- running the release by hand. Safe to run more than once. Runs in one
-- transaction; if any step fails, nothing is applied.
--
-- How to run (Neon, console.neon.tech):
--   1. SQL Editor -> pick the production branch + database -> paste this
--      whole file -> Run. The last result shows the check (1).
--      (Or from a terminal: psql "<Neon connection string>" -v ON_ERROR_STOP=1 -f <this file>)
--   2. Deploy the new API + PWA build, then start the API.
--
-- Contents
--   1. Dining status  Waiting
--   2. Checks
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Dining status: Waiting. Only inserted when missing, so a name / colour
--    edited in Settings is kept.
-- -----------------------------------------------------------------------------
INSERT INTO "dining_status" ("id", "status_id", "name", "color_code", "created_at", "updated_at")
SELECT (SELECT COALESCE(MAX("id"), 0) + 1 FROM "dining_status"),
       8, 'WAITING', '#D946EF', NOW(), NOW()
 WHERE NOT EXISTS (SELECT 1 FROM "dining_status" WHERE "status_id" = 8);

-- -----------------------------------------------------------------------------
-- 2. Checks
-- -----------------------------------------------------------------------------
-- Should be 1.
SELECT count(*) AS waiting_status_rows FROM "dining_status" WHERE "status_id" = 8;

COMMIT;
