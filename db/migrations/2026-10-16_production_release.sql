-- =============================================================================
-- Production release: database changes (PostgreSQL)
-- Date: 2026-10-16
--
-- Run AFTER 2026-10-15_production_release.sql.
--
-- New: SuperAdmin role and per-Admin access.
--   - SuperAdmin: full access to every page and option, and manages Admins
--     (Settings -> Admin users in the PWA, /api/admin/users in the API).
--   - Admin: pages/options and hotels granted by a SuperAdmin; creates
--     Staff users (Settings -> Staff users, /api/staff-users).
--   - Staff: hotel workers (Manager / Lead / Member) with a subset of
--     their Admin's pages/options and hotels. role = 'Staff', user_type_id 3.
--
-- registerUsersData gets five columns:
--   permissions  JSONB    {"hotels": ["view","create","edit","delete"], ...}
--                         NULL = full access (existing Admins keep working)
--   hotel_ids    JSONB    [1, 4, 7]; NULL = all hotels
--   is_active    BOOLEAN  false = cannot sign in / use admin APIs
--   staff_category VARCHAR Manager / Lead / Member (Staff only)
--   created_by   INTEGER  the Admin who created a Staff user
--
-- The API also adds these on start (sequelize sync), so this script is only
-- needed when sync is off. Safe to run more than once.
--
-- How to run (Neon, console.neon.tech):
--   1. Backup: Branches -> Create branch from the production branch
--      (e.g. "before-2026-10-16").
--   2. Stop the API.
--   3. SQL Editor -> paste this file -> set the SuperAdmin mobile number in
--      section 2 -> Run.
--   4. Deploy the new API + PWA build, then start the API.
--
-- Alternatively set SUPER_ADMIN_MOBILE=<10-digit number> (and optionally
-- SUPER_ADMIN_NAME) in the API's .env: on start the API makes that account
-- a SuperAdmin, creating it if needed.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. New columns
-- -----------------------------------------------------------------------------
ALTER TABLE "registerUsersData" ADD COLUMN IF NOT EXISTS "permissions" JSONB;
ALTER TABLE "registerUsersData" ADD COLUMN IF NOT EXISTS "hotel_ids" JSONB;
ALTER TABLE "registerUsersData" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE "registerUsersData" ADD COLUMN IF NOT EXISTS "staff_category" VARCHAR(20);
ALTER TABLE "registerUsersData" ADD COLUMN IF NOT EXISTS "created_by" INTEGER;
ALTER TABLE "registerUsersData" ADD COLUMN IF NOT EXISTS "staff_type" VARCHAR(20);
-- Inactive users: removed Staff / Admin access, kept so it can be retrieved.
ALTER TABLE "registerUsersData" ADD COLUMN IF NOT EXISTS "removed_at" TIMESTAMPTZ;
ALTER TABLE "registerUsersData" ADD COLUMN IF NOT EXISTS "removed_by" INTEGER;
ALTER TABLE "registerUsersData" ADD COLUMN IF NOT EXISTS "previous_access" JSONB;
-- Cooks / servers / cleaners: their Staff user (sign-in), see utils/staffAccount.js.
ALTER TABLE "cooks" ADD COLUMN IF NOT EXISTS "user_id" INTEGER;
ALTER TABLE "servers" ADD COLUMN IF NOT EXISTS "user_id" INTEGER;
ALTER TABLE "cleaners" ADD COLUMN IF NOT EXISTS "user_id" INTEGER;

-- -----------------------------------------------------------------------------
-- 2. First SuperAdmin. Replace 9999999999 with the real mobile number (the
--    account must already be registered). user_type_id 0 = SuperAdmin.
-- -----------------------------------------------------------------------------
UPDATE "registerUsersData"
   SET "role" = 'SuperAdmin',
       "user_type_id" = 0,
       "permissions" = NULL,
       "hotel_ids" = NULL,
       "is_active" = TRUE,
       "updatedAt" = NOW()
 WHERE "mobilenumber" = '9999999999';

-- -----------------------------------------------------------------------------
-- 3. Checks
-- -----------------------------------------------------------------------------
SELECT "role", count(*) AS users
  FROM "registerUsersData"
 GROUP BY "role"
 ORDER BY "role";

COMMIT;
