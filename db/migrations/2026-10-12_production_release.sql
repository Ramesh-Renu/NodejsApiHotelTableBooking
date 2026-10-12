-- =============================================================================
-- Production release: database changes (PostgreSQL)
-- Date: 2026-10-12
--
-- Safe to run more than once: every step checks whether it is already done.
-- Runs in one transaction; if any step fails, nothing is applied.
--
-- How to run (Neon, console.neon.tech):
--   1. Backup: Branches -> Create branch from the production branch
--      (e.g. "before-2026-10-12"). It is an instant copy to restore from.
--   2. Stop the API (it also applies these changes on start; running the
--      script first keeps the deploy predictable).
--   3. SQL Editor -> pick the production branch + database -> paste this
--      whole file -> Run. The last result shows the checks (all 0).
--      (Or from a terminal: psql "<Neon connection string>" -v ON_ERROR_STOP=1 -f <this file>)
--   4. Deploy the new API + PWA build, then start the API.
--
-- Contents
--   1. Table codes            hotel_tables.table_code_prefix, tables.table_code
--   2. Menu codes per hotel   drop global unique, add (hotel_id, menu_code) index
--   3. Duplicate unique constraints left by sync({ alter: true })
--   4. Staff master tables    cooks, servers, cleaners
--   5. Reservations           server_id, cleaner_id, guest_count
--   6. Orders                 optional reservation, owner, cook/server, end times
--   7. Order items            cook per dish
--   8. Status rows            order DELIVERED (8), dining SERVING (7)
--   9. Data backfills         table codes, order owners, Completed -> Served/Delivered
--  10. Checks
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Table codes (e.g. SACT0001 = hotel prefix + number running per hotel)
-- -----------------------------------------------------------------------------
ALTER TABLE "hotel_tables" ADD COLUMN IF NOT EXISTS "table_code_prefix" VARCHAR(8);
ALTER TABLE "tables"       ADD COLUMN IF NOT EXISTS "table_code"        VARCHAR(20);

-- -----------------------------------------------------------------------------
-- 2. Menu codes: unique per hotel (was unique across all hotels)
-- -----------------------------------------------------------------------------
DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = to_regclass('public.menus')
      AND contype = 'u'
      AND conname ~ '^menus_menu_code_key[0-9]*$'
  LOOP
    EXECUTE format('ALTER TABLE "menus" DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "menus_hotel_id_menu_code_unique"
  ON "menus" ("hotel_id", "menu_code");

-- -----------------------------------------------------------------------------
-- 3. Remove duplicate unique constraints
--    Columns declared `unique: true` gained one more "<table>_<col>_keyN"
--    constraint on every API start. Keep one per column set, drop the rest.
-- -----------------------------------------------------------------------------
DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT table_name, conname FROM (
      SELECT conrelid::regclass::text AS table_name,
             conname,
             row_number() OVER (
               PARTITION BY conrelid, conkey
               ORDER BY length(conname), conname
             ) AS copy_no
      FROM pg_constraint
      WHERE contype = 'u'
        AND connamespace = 'public'::regnamespace
        AND conname ~ '_key[0-9]*$'
    ) d
    WHERE copy_no > 1
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', c.table_name, c.conname);
    EXCEPTION WHEN dependent_objects_still_exist THEN
      RAISE NOTICE 'Kept % (something depends on it)', c.conname;
    END;
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 4. Staff master data (Settings -> Cooks / Servers / Cleaners)
--    hotel_id NULL = works at every hotel. Photos are optional.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "cooks" (
  "id"            SERIAL PRIMARY KEY,
  "cook_name"     VARCHAR(100) NOT NULL,
  "speciality"    VARCHAR(100),
  "photo_url"     VARCHAR(500),
  "photo_file_id" VARCHAR(255),
  "hotel_id"      INTEGER,
  "is_active"     BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt"     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "servers" (
  "id"            SERIAL PRIMARY KEY,
  "server_name"   VARCHAR(100) NOT NULL,
  "section"       VARCHAR(100),
  "photo_url"     VARCHAR(500),
  "photo_file_id" VARCHAR(255),
  "hotel_id"      INTEGER,
  "is_active"     BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt"     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "cleaners" (
  "id"            SERIAL PRIMARY KEY,
  "cleaner_name"  VARCHAR(100) NOT NULL,
  "shift"         VARCHAR(100),
  "photo_url"     VARCHAR(500),
  "photo_file_id" VARCHAR(255),
  "hotel_id"      INTEGER,
  "is_active"     BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt"     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 5. Reservations: server (on confirm), cleaner (on cleaning), party size
-- -----------------------------------------------------------------------------
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "server_id"   INTEGER;
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "cleaner_id"  INTEGER;
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "guest_count" INTEGER;

-- -----------------------------------------------------------------------------
-- 6. Orders
--    - reservation_id optional: customers can order without a table booking
--    - user_id: who placed the order (backfilled in step 9)
--    - cook_id / server_id: staff on the order
--    - served_at / delivered_at: when the order finished
-- -----------------------------------------------------------------------------
ALTER TABLE "reservation_orders" ALTER COLUMN "reservation_id" DROP NOT NULL;
ALTER TABLE "reservation_orders" ADD COLUMN IF NOT EXISTS "user_id"      INTEGER;
ALTER TABLE "reservation_orders" ADD COLUMN IF NOT EXISTS "cook_id"      INTEGER;
ALTER TABLE "reservation_orders" ADD COLUMN IF NOT EXISTS "server_id"    INTEGER;
ALTER TABLE "reservation_orders" ADD COLUMN IF NOT EXISTS "served_at"    TIMESTAMP WITH TIME ZONE;
ALTER TABLE "reservation_orders" ADD COLUMN IF NOT EXISTS "delivered_at" TIMESTAMP WITH TIME ZONE;

-- -----------------------------------------------------------------------------
-- 7. Order items: a cook per dish
-- -----------------------------------------------------------------------------
ALTER TABLE "reservation_order_items" ADD COLUMN IF NOT EXISTS "cook_id" INTEGER;

-- -----------------------------------------------------------------------------
-- 8. Order status DELIVERED (8): final stage for orders without a booking.
--    The table's "id" has no sequence in older databases, so pick the next id.
-- -----------------------------------------------------------------------------
INSERT INTO "order_status_master" ("id", "status_id", "name", "color_code", "created_at", "updated_at")
SELECT COALESCE(MAX("id"), 0) + 1, 8, 'DELIVERED', '#0EA5E9', NOW(), NOW()
FROM "order_status_master"
WHERE NOT EXISTS (SELECT 1 FROM "order_status_master" WHERE "status_id" = 8);

-- Dining status SERVING (7): reservation stage between Seated and Cleaning.
INSERT INTO "dining_status" ("id", "status_id", "name", "color_code", "created_at", "updated_at")
SELECT COALESCE(MAX("id"), 0) + 1, 7, 'SERVING', '#8B5CF6', NOW(), NOW()
FROM "dining_status"
WHERE NOT EXISTS (SELECT 1 FROM "dining_status" WHERE "status_id" = 7);

-- -----------------------------------------------------------------------------
-- 9. Data backfills
-- -----------------------------------------------------------------------------

-- 9a. Hotel table-code prefix: 2 letters of the hotel + first letter of the
--     location + first letter of the area (Sangeetha / Chennai / T Nagar ->
--     SACT). A prefix already used by another hotel gets a number added.
WITH base AS (
  SELECT h."id",
         CASE WHEN length(p.raw) >= 2 THEN p.raw ELSE 'TB' END AS prefix
  FROM "hotel_tables" h
  LEFT JOIN "locations" l ON l."id" = h."location_id"
  LEFT JOIN "areas"     a ON a."id" = h."area_id"
  CROSS JOIN LATERAL (
    SELECT upper(
             left(regexp_replace(coalesce(h."hotel_name", ''), '[^A-Za-z0-9]', '', 'g'), 2) ||
             left(regexp_replace(coalesce(l."name", ''),       '[^A-Za-z0-9]', '', 'g'), 1) ||
             left(regexp_replace(coalesce(a."name", ''),       '[^A-Za-z0-9]', '', 'g'), 1)
           ) AS raw
  ) p
  WHERE h."table_code_prefix" IS NULL
),
ranked AS (
  SELECT b."id", b.prefix,
         row_number() OVER (PARTITION BY b.prefix ORDER BY b."id") AS rn,
         EXISTS (
           SELECT 1 FROM "hotel_tables" x WHERE x."table_code_prefix" = b.prefix
         ) AS taken
  FROM base b
)
UPDATE "hotel_tables" h
SET "table_code_prefix" =
      CASE WHEN r.rn = 1 AND NOT r.taken
           THEN r.prefix
           ELSE left(r.prefix, 7) || (r.rn + CASE WHEN r.taken THEN 1 ELSE 0 END)
      END
FROM ranked r
WHERE h."id" = r."id";

-- 9b. Table codes for tables without one: prefix + 4-digit number, continuing
--     after the hotel's highest existing code, in floor -> table order.
WITH current_max AS (
  SELECT h."id" AS hotel_id,
         h."table_code_prefix" AS prefix,
         COALESCE(MAX(
           CASE WHEN t."table_code" LIKE h."table_code_prefix" || '%'
                 AND substring(t."table_code" FROM length(h."table_code_prefix") + 1) ~ '^[0-9]+$'
                THEN substring(t."table_code" FROM length(h."table_code_prefix") + 1)::INTEGER
           END
         ), 0) AS max_seq
  FROM "hotel_tables" h
  LEFT JOIN "tables" t ON t."hotel_table_id" = h."id"
  WHERE h."table_code_prefix" IS NOT NULL
  GROUP BY h."id", h."table_code_prefix"
),
missing AS (
  SELECT t."id",
         t."hotel_table_id",
         row_number() OVER (
           PARTITION BY t."hotel_table_id"
           ORDER BY f."floor_number" NULLS LAST, t."table_number", t."id"
         ) AS rn
  FROM "tables" t
  LEFT JOIN "floors" f ON f."id" = t."floor_id"
  WHERE t."table_code" IS NULL
)
UPDATE "tables" t
SET "table_code" = m.prefix || lpad((m.max_seq + x.rn)::TEXT, 4, '0')
FROM missing x
JOIN current_max m ON m.hotel_id = x."hotel_table_id"
WHERE t."id" = x."id";

-- 9c. Order owner from the order's reservation (older orders).
UPDATE "reservation_orders" o
SET "user_id" = r."user_id"
FROM "reservations" r
WHERE o."reservation_id" = r."id"
  AND o."user_id" IS NULL;

-- 9d. "Completed" (6) is no longer an order stage: Served (5) finishes table
--     orders, Delivered (8) finishes orders without a booking. Keep the time.
UPDATE "reservation_orders"
SET "order_status" = CASE WHEN "reservation_id" IS NULL THEN 8 ELSE 5 END,
    "served_at" = CASE
      WHEN "reservation_id" IS NOT NULL
        THEN COALESCE("served_at", "completed_at", "updatedAt")
      ELSE "served_at" END,
    "delivered_at" = CASE
      WHEN "reservation_id" IS NULL
        THEN COALESCE("delivered_at", "completed_at", "updatedAt")
      ELSE "delivered_at" END
WHERE "order_status" = 6;

-- -----------------------------------------------------------------------------
-- 10. Checks (shown in the psql output; all counts should be 0)
-- -----------------------------------------------------------------------------
SELECT 'hotels without table_code_prefix' AS check, COUNT(*) FROM "hotel_tables" WHERE "table_code_prefix" IS NULL
UNION ALL
SELECT 'tables without table_code', COUNT(*) FROM "tables" WHERE "table_code" IS NULL
UNION ALL
SELECT 'duplicate table_code_prefix', COUNT(*) FROM (
  SELECT "table_code_prefix" FROM "hotel_tables"
  WHERE "table_code_prefix" IS NOT NULL
  GROUP BY 1 HAVING COUNT(*) > 1
) d
UNION ALL
SELECT 'orders still Completed (6)', COUNT(*) FROM "reservation_orders" WHERE "order_status" = 6
UNION ALL
SELECT 'orders with booking but no owner', COUNT(*) FROM "reservation_orders"
  WHERE "user_id" IS NULL AND "reservation_id" IS NOT NULL;

COMMIT;
