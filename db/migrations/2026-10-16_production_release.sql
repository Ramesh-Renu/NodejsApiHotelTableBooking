-- =============================================================================
-- Production release: database changes (PostgreSQL)
-- Date: 2026-10-16
--
-- Run AFTER 2026-10-15_production_release.sql (if that one is not applied
-- yet, run it first).
--
-- New in this release: roles and User Management.
--   - SuperAdmin  every page and option, every hotel; creates Admins
--                 (User Management -> Admin users, /api/admin/users).
--   - Admin       the pages / options / hotels a SuperAdmin granted; creates
--                 Staff users (User Management -> Staff users,
--                 /api/staff-users). Can view Admin users (read-only).
--   - Staff       hotel workers: Manager / Lead / Member, with only pages,
--                 options and hotels their Admin has. role = 'Staff',
--                 user_type_id 3. Cooks / Servers / Cleaners with a 10-digit
--                 mobile in Phone get a Staff user (Member) automatically.
--   - Inactive users: removing Staff / Admin access keeps what they had, so
--                 it can be retrieved later (User Management -> Inactive
--                 users); their Cook / Server / Cleaner record goes Inactive.
--
-- Schema (all columns nullable or defaulted; existing rows keep working):
--   registerUsersData
--     permissions      JSONB        {"orders": ["view","edit"], ...}
--                                   NULL = full access (existing Admins)
--     hotel_ids        JSONB        [1, 4, 7]; NULL = all hotels
--     is_active        BOOLEAN      false = can't sign in / use staff pages
--     staff_category   VARCHAR(20)  Manager / Lead / Member (Staff only)
--     staff_type       VARCHAR(20)  Cook / Server / Cleaner (from Settings)
--     created_by       INTEGER      the Admin who created a Staff user
--     removed_at       TIMESTAMPTZ  access removed (Inactive users)
--     removed_by       INTEGER      who removed it
--     previous_access  JSONB        role / category / pages / hotels before
--                                   removal (used by "Retrieve user as")
--   cooks, servers, cleaners
--     user_id          INTEGER      their Staff user (sign-in)
--
-- No other schema changes: the rest of the release (menu filters, order
-- ticket, floor-plan "Your booking", hotel address on the menu, …) uses
-- existing columns.
--
-- The API adds these columns itself on start (sequelize sync) and runs the
-- data step in section 3; this script is for running the release by hand or
-- with sync off. Safe to run more than once. Runs in one transaction; if any
-- step fails, nothing is applied.
--
-- How to run (Neon, console.neon.tech):
--   1. Backup: Branches -> Create branch from the production branch
--      (e.g. "before-2026-10-16"). It is an instant copy to restore from.
--   2. Stop the API.
--   3. SQL Editor -> pick the production branch + database -> paste this
--      whole file -> set the SuperAdmin mobile number in section 2 -> Run.
--      The last results show the checks.
--      (Or from a terminal: psql "<Neon connection string>" -v ON_ERROR_STOP=1 -f <this file>)
--   4. Deploy the new API + PWA build, then start the API.
--      Instead of section 2 you can set SUPER_ADMIN_MOBILE=<10-digit number>
--      (and optionally SUPER_ADMIN_NAME) in the API's .env: on start the API
--      makes that account a SuperAdmin, creating it if needed.
--   5. On start the API also creates Staff users for Cooks / Servers /
--      Cleaners that have a 10-digit mobile in Phone (log line
--      "Staff users: N … login(s) added").
--
-- Contents
--   1. Columns     registerUsersData + cooks / servers / cleaners
--   2. SuperAdmin  first SuperAdmin account
--   3. Data        records whose login was removed are set Inactive
--   4. Checks
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Columns
-- -----------------------------------------------------------------------------
-- Roles and access
ALTER TABLE "registerUsersData" ADD COLUMN IF NOT EXISTS "permissions" JSONB;
ALTER TABLE "registerUsersData" ADD COLUMN IF NOT EXISTS "hotel_ids" JSONB;
ALTER TABLE "registerUsersData" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT TRUE;
-- Staff users
ALTER TABLE "registerUsersData" ADD COLUMN IF NOT EXISTS "staff_category" VARCHAR(20);
ALTER TABLE "registerUsersData" ADD COLUMN IF NOT EXISTS "staff_type" VARCHAR(20);
ALTER TABLE "registerUsersData" ADD COLUMN IF NOT EXISTS "created_by" INTEGER;
-- Inactive users: removed Staff / Admin access, kept so it can be retrieved
ALTER TABLE "registerUsersData" ADD COLUMN IF NOT EXISTS "removed_at" TIMESTAMPTZ;
ALTER TABLE "registerUsersData" ADD COLUMN IF NOT EXISTS "removed_by" INTEGER;
ALTER TABLE "registerUsersData" ADD COLUMN IF NOT EXISTS "previous_access" JSONB;
-- Cooks / servers / cleaners: their Staff user (see utils/staffAccount.js)
ALTER TABLE "cooks" ADD COLUMN IF NOT EXISTS "user_id" INTEGER;
ALTER TABLE "servers" ADD COLUMN IF NOT EXISTS "user_id" INTEGER;
ALTER TABLE "cleaners" ADD COLUMN IF NOT EXISTS "user_id" INTEGER;

-- -----------------------------------------------------------------------------
-- 2. First SuperAdmin. Replace 9999999999 with the real mobile number (the
--    account must already be registered; else use SUPER_ADMIN_MOBILE, see
--    step 4 above). user_type_id 0 = SuperAdmin. No match = nothing changes.
-- -----------------------------------------------------------------------------
UPDATE "registerUsersData"
   SET "role" = 'SuperAdmin',
       "user_type_id" = 0,
       "permissions" = NULL,
       "hotel_ids" = NULL,
       "is_active" = TRUE,
       "removed_at" = NULL,
       "removed_by" = NULL,
       "previous_access" = NULL,
       "updatedAt" = NOW()
 WHERE "mobilenumber" = '9999999999';

-- -----------------------------------------------------------------------------
-- 3. Data: a Cook / Server / Cleaner whose login was removed (Inactive users)
--    can't be assigned work, so its record is Inactive too. Only rows that
--    still need it are touched.
-- -----------------------------------------------------------------------------
UPDATE "cooks"
   SET "is_active" = FALSE, "updatedAt" = NOW()
 WHERE "is_active" = TRUE
   AND "user_id" IN (SELECT "id" FROM "registerUsersData" WHERE "removed_at" IS NOT NULL);

UPDATE "servers"
   SET "is_active" = FALSE, "updatedAt" = NOW()
 WHERE "is_active" = TRUE
   AND "user_id" IN (SELECT "id" FROM "registerUsersData" WHERE "removed_at" IS NOT NULL);

UPDATE "cleaners"
   SET "is_active" = FALSE, "updatedAt" = NOW()
 WHERE "is_active" = TRUE
   AND "user_id" IN (SELECT "id" FROM "registerUsersData" WHERE "removed_at" IS NOT NULL);

-- -----------------------------------------------------------------------------
-- 4. Checks
-- -----------------------------------------------------------------------------
-- 4a. Accounts per role (expect at least one SuperAdmin).
SELECT "role", count(*) AS users
  FROM "registerUsersData"
 GROUP BY "role"
 ORDER BY "role";

-- 4b. Staff users per category / job.
SELECT "staff_category", "staff_type", count(*) AS staff
  FROM "registerUsersData"
 WHERE "role" ILIKE 'staff'
 GROUP BY "staff_category", "staff_type"
 ORDER BY "staff_category", "staff_type";

-- 4c. Should be 0: removed logins whose record is still active.
SELECT
  (SELECT count(*) FROM "cooks" c JOIN "registerUsersData" u ON u."id" = c."user_id"
    WHERE u."removed_at" IS NOT NULL AND c."is_active") +
  (SELECT count(*) FROM "servers" s JOIN "registerUsersData" u ON u."id" = s."user_id"
    WHERE u."removed_at" IS NOT NULL AND s."is_active") +
  (SELECT count(*) FROM "cleaners" l JOIN "registerUsersData" u ON u."id" = l."user_id"
    WHERE u."removed_at" IS NOT NULL AND l."is_active") AS active_records_with_removed_login;

COMMIT;
