-- =============================================================================
-- Production release: database changes (PostgreSQL)
-- Date: 2026-10-13
--
-- Run AFTER 2026-10-12_production_release.sql (if that one is not applied
-- yet, run it first).
--
-- Safe to run more than once: every step checks whether it is already done.
-- Runs in one transaction; if any step fails, nothing is applied.
--
-- How to run (Neon, console.neon.tech):
--   1. Backup: Branches -> Create branch from the production branch
--      (e.g. "before-2026-10-13"). It is an instant copy to restore from.
--   2. Stop the API (it also applies these changes on start; running the
--      script first keeps the deploy predictable).
--   3. SQL Editor -> pick the production branch + database -> paste this
--      whole file -> Run. The last result shows the checks (all 0).
--      (Or from a terminal: psql "<Neon connection string>" -v ON_ERROR_STOP=1 -f <this file>)
--   4. Deploy the new API + PWA build, then start the API.
--
-- Contents
--   1. Side dishes per menu category   side_dishes table
--   2. Menu <-> side dish links        point at side_dishes (keeps existing links)
--   3. Orders                          payment method, Preparing start time
--   4. Order items                     time each dish was ticked prepared
--   5. Staff personal details          cooks, servers, cleaners (all optional)
--   6. Hotels                          soft delete (deletedAt)
--   7. Checks
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Side dishes per menu category (Settings -> Menu categories -> side dishes)
--    A side dish belongs to one category; its hotel is the category's hotel.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "side_dishes" (
  "id"             SERIAL PRIMARY KEY,
  "hotel_id"       INTEGER NOT NULL
                   REFERENCES "hotel_tables" ("id") ON UPDATE CASCADE,
  "category_id"    INTEGER NOT NULL
                   REFERENCES "menu_categories" ("id") ON UPDATE CASCADE ON DELETE CASCADE,
  "side_dish_name" VARCHAR(255) NOT NULL,
  "description"    TEXT,
  "price"          NUMERIC(10, 2) NOT NULL DEFAULT 0,
  "display_order"  INTEGER DEFAULT 0,
  "is_active"      BOOLEAN DEFAULT TRUE,
  "createdAt"      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt"      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 2. Menu <-> side dish links
--    menu_side_dish_mapping.side_dish_id used to point at the global
--    menu_side_dishes list; it now points at side_dishes (the menu's own
--    category). Each linked global side dish is copied into the menu's
--    category (same name, once per category) and the link re-pointed, so
--    existing menus keep their side dishes. Skipped when already done.
-- -----------------------------------------------------------------------------
DO $$
DECLARE c RECORD;
BEGIN
  IF to_regclass('public.menu_side_dish_mapping') IS NULL THEN
    RAISE NOTICE 'menu_side_dish_mapping does not exist yet: the API creates it.';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.menu_side_dish_mapping'::regclass
      AND contype = 'f'
      AND confrelid = 'public.side_dishes'::regclass
  ) THEN
    RAISE NOTICE 'Menu side dishes already point at side_dishes: skipped.';
    RETURN;
  END IF;

  -- Old foreign key(s) to the global list.
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.menu_side_dish_mapping'::regclass
      AND contype = 'f'
      AND confrelid = to_regclass('public.menu_side_dishes')
  LOOP
    EXECUTE format('ALTER TABLE "menu_side_dish_mapping" DROP CONSTRAINT %I', c.conname);
  END LOOP;

  IF to_regclass('public.menu_side_dishes') IS NOT NULL THEN
    -- Copy each linked global side dish into its menu's category.
    EXECUTE $sql$
      INSERT INTO "side_dishes"
        ("hotel_id", "category_id", "side_dish_name", "description", "price",
         "display_order", "is_active", "createdAt", "updatedAt")
      SELECT DISTINCT ON (m."category_id", lower(sd."side_dish_name"))
             m."hotel_id", m."category_id", sd."side_dish_name", sd."description", 0,
             COALESCE(sd."display_order", 0), COALESCE(sd."is_active", TRUE),
             NOW(), NOW()
      FROM "menu_side_dish_mapping" mp
      JOIN "menus" m             ON m."id"  = mp."menu_id"
      JOIN "menu_side_dishes" sd ON sd."id" = mp."side_dish_id"
      WHERE NOT EXISTS (
        SELECT 1 FROM "side_dishes" s
        WHERE s."category_id" = m."category_id"
          AND lower(s."side_dish_name") = lower(sd."side_dish_name")
      )
      ORDER BY m."category_id", lower(sd."side_dish_name"), sd."id"
    $sql$;

    -- Re-point every link at the category's copy.
    EXECUTE $sql$
      UPDATE "menu_side_dish_mapping" mp
      SET "side_dish_id" = s."id"
      FROM "menus" m, "menu_side_dishes" sd, "side_dishes" s
      WHERE m."id"  = mp."menu_id"
        AND sd."id" = mp."side_dish_id"
        AND s."category_id" = m."category_id"
        AND lower(s."side_dish_name") = lower(sd."side_dish_name")
    $sql$;
  END IF;

  -- Links that could not be moved (menu or dish gone, other category).
  DELETE FROM "menu_side_dish_mapping" mp
  WHERE NOT EXISTS (
    SELECT 1 FROM "side_dishes" s
    JOIN "menus" m ON m."category_id" = s."category_id"
    WHERE s."id" = mp."side_dish_id" AND m."id" = mp."menu_id"
  );

  -- Duplicate links created by the move.
  DELETE FROM "menu_side_dish_mapping" a
  USING "menu_side_dish_mapping" b
  WHERE a."menu_id" = b."menu_id"
    AND a."side_dish_id" = b."side_dish_id"
    AND a."id" > b."id";

  ALTER TABLE "menu_side_dish_mapping"
    ADD CONSTRAINT "menu_side_dish_mapping_side_dish_id_fkey"
    FOREIGN KEY ("side_dish_id") REFERENCES "side_dishes" ("id")
    ON UPDATE CASCADE ON DELETE CASCADE;
END $$;

-- -----------------------------------------------------------------------------
-- 3. Orders
--    - payment_method: cash / card / upi once paid (NULL while pending)
--    - preparing_at:   when the kitchen started cooking (Preparing timer,
--                      "Prepared in" total)
-- -----------------------------------------------------------------------------
ALTER TABLE "reservation_orders" ADD COLUMN IF NOT EXISTS "payment_method" VARCHAR(20);
ALTER TABLE "reservation_orders" ADD COLUMN IF NOT EXISTS "preparing_at"   TIMESTAMP WITH TIME ZONE;

-- -----------------------------------------------------------------------------
-- 4. Order items: when each dish was ticked as prepared (its own cook time)
-- -----------------------------------------------------------------------------
ALTER TABLE "reservation_order_items" ADD COLUMN IF NOT EXISTS "ready_at" TIMESTAMP WITH TIME ZONE;

-- -----------------------------------------------------------------------------
-- 5. Staff personal details + working hours (all optional)
--    Same columns on cooks, servers and cleaners.
-- -----------------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['cooks', 'servers', 'cleaners'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE NOTICE 'Table % does not exist: run 2026-10-12_production_release.sql first.', t;
      CONTINUE;
    END IF;
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS "phone"             VARCHAR(20)', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS "email"             VARCHAR(150)', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS "gender"            VARCHAR(20)', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS "date_of_birth"     DATE', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS "address"           TEXT', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS "emergency_contact" VARCHAR(150)', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS "joined_on"         DATE', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS "shift_start"       TIME', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS "shift_end"         TIME', t);
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 6. Hotels: soft delete
--    Deleting a hotel now only sets "deletedAt"; its floors, tables, menus,
--    bookings and orders are kept. The API hides deleted hotels.
-- -----------------------------------------------------------------------------
ALTER TABLE "hotel_tables" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP WITH TIME ZONE;

-- -----------------------------------------------------------------------------
-- 7. Checks (all counts should be 0)
-- -----------------------------------------------------------------------------
SELECT 'missing new columns' AS check, COUNT(*) FROM (VALUES
    ('reservation_orders',      'payment_method'),
    ('reservation_orders',      'preparing_at'),
    ('reservation_order_items', 'ready_at'),
    ('hotel_tables',            'deletedAt'),
    ('cooks',    'phone'), ('cooks',    'shift_start'), ('cooks',    'shift_end'),
    ('servers',  'phone'), ('servers',  'shift_start'), ('servers',  'shift_end'),
    ('cleaners', 'phone'), ('cleaners', 'shift_start'), ('cleaners', 'shift_end')
  ) AS v(table_name, column_name)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = v.table_name
      AND c.column_name = v.column_name
  )
UNION ALL
SELECT 'side_dishes table missing', CASE WHEN to_regclass('public.side_dishes') IS NULL THEN 1 ELSE 0 END
UNION ALL
SELECT 'menu side dish links not on side_dishes',
  CASE
    WHEN to_regclass('public.menu_side_dish_mapping') IS NULL THEN 0
    WHEN EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = to_regclass('public.menu_side_dish_mapping')
        AND contype = 'f'
        AND confrelid = to_regclass('public.side_dishes')
    ) THEN 0
    ELSE 1
  END;

COMMIT;
