import { DataTypes, Sequelize } from "sequelize";
import dotenv from "dotenv";
import { ORDER_STATUS } from "../utils/orderStatus.js";
import { PAYMENT_STATUS } from "../utils/paymentStatus.js";

dotenv.config();

// Hosted databases (Neon) only accept SSL connections; a local PostgreSQL
// usually has SSL off. DB_SSL=true/false overrides the host check.
const useSsl = process.env.DB_SSL
  ? process.env.DB_SSL === "true"
  : /neon\.tech$/i.test(process.env.DB_HOST || "");

export const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: "postgres",
    timezone: "+05:30",
    logging: false,
    dialectOptions: useSsl
      ? { ssl: { require: true, rejectUnauthorized: false } }
      : {},
  }
);

const prepareStatusMasterTable = async (tableName) => {
  const queryInterface = sequelize.getQueryInterface();
  let tableDefinition;

  try {
    tableDefinition = await queryInterface.describeTable(tableName);
  } catch {
    // The table does not exist yet. sequelize.sync() will create it normally.
    return;
  }

  const quotedTableName = `"${tableName}"`;

  // Existing installations may have rows from before status_id was added.
  // Add it nullable first so PostgreSQL can alter a populated table safely.
  if (!tableDefinition.status_id) {
    await queryInterface.addColumn(tableName, "status_id", {
      type: DataTypes.INTEGER,
      allowNull: true,
    });
  }

  // Use the existing primary key as a deterministic value for legacy rows.
  // This does not depend on optional legacy columns such as `name`.
  await sequelize.query(`
    UPDATE ${quotedTableName}
    SET "status_id" = "id"
    WHERE "status_id" IS NULL
  `);

  // Some older installations used category_name instead of name. Add the
  // current column as nullable, copy the legacy value, and let sync enforce
  // the final NOT NULL constraint afterward.
  if (!tableDefinition.name) {
    await queryInterface.addColumn(tableName, "name", {
      type: DataTypes.STRING,
      allowNull: true,
    });
  }

  const legacyNameExpression = tableDefinition.category_name
    ? `COALESCE("category_name", CONCAT('STATUS_', "id"))`
    : `CONCAT('STATUS_', "id")`;

  await sequelize.query(`
    UPDATE ${quotedTableName}
    SET "name" = COALESCE("name", ${legacyNameExpression})
    WHERE "name" IS NULL
  `);

  if (!tableDefinition.color_code) {
    await queryInterface.addColumn(tableName, "color_code", {
      type: DataTypes.STRING(20),
      allowNull: true,
    });
  }

  await sequelize.query(`
    UPDATE ${quotedTableName}
    SET "color_code" = COALESCE("color_code", '#000000')
    WHERE "color_code" IS NULL
  `);

  for (const timestampColumn of ["created_at", "updated_at"]) {
    if (!tableDefinition[timestampColumn]) {
      await queryInterface.addColumn(tableName, timestampColumn, {
        type: DataTypes.DATE,
        allowNull: true,
      });
    }

    await sequelize.query(`
      UPDATE ${quotedTableName}
      SET "${timestampColumn}" = COALESCE("${timestampColumn}", NOW())
      WHERE "${timestampColumn}" IS NULL
    `);
  }
};

const prepareSpiceLevelTable = async () => {
  const queryInterface = sequelize.getQueryInterface();
  let tableDefinition;

  try {
    tableDefinition = await queryInterface.describeTable("spice_level_master");
  } catch {
    // The table does not exist yet. sequelize.sync() will create it normally.
    return;
  }

  const tableName = '"spice_level_master"';

  if (!tableDefinition.spice_level) {
    await queryInterface.addColumn("spice_level_master", "spice_level", {
      type: DataTypes.STRING(30),
      allowNull: true,
    });
  }

  const defaultLevelExpression = `CASE "id"
    WHEN 1 THEN 'NONE'
    WHEN 2 THEN 'MILD'
    WHEN 3 THEN 'MEDIUM'
    WHEN 4 THEN 'HOT'
    WHEN 5 THEN 'EXTRA_HOT'
    ELSE CONCAT('LEVEL_', "id")
  END`;
  const legacyLevelExpression = tableDefinition.name
    ? `COALESCE("name", ${defaultLevelExpression})`
    : tableDefinition.category_name
      ? `COALESCE("category_name", ${defaultLevelExpression})`
      : defaultLevelExpression;

  await sequelize.query(`
    UPDATE ${tableName}
    SET "spice_level" = COALESCE("spice_level", ${legacyLevelExpression})
    WHERE "spice_level" IS NULL
  `);

  if (!tableDefinition.display_order) {
    await queryInterface.addColumn("spice_level_master", "display_order", {
      type: DataTypes.INTEGER,
      allowNull: true,
    });
  }

  await sequelize.query(`
    UPDATE ${tableName}
    SET "display_order" = COALESCE("display_order", "id")
    WHERE "display_order" IS NULL
  `);

  if (!tableDefinition.is_active) {
    await queryInterface.addColumn("spice_level_master", "is_active", {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    });
  }

  await sequelize.query(`
    UPDATE ${tableName}
    SET "is_active" = COALESCE("is_active", TRUE)
    WHERE "is_active" IS NULL
  `);

  for (const timestampColumn of ["created_at", "updated_at"]) {
    if (!tableDefinition[timestampColumn]) {
      await queryInterface.addColumn("spice_level_master", timestampColumn, {
        type: DataTypes.DATE,
        allowNull: true,
      });
    }

    await sequelize.query(`
      UPDATE ${tableName}
      SET "${timestampColumn}" = COALESCE("${timestampColumn}", NOW())
      WHERE "${timestampColumn}" IS NULL
    `);
  }
};

const prepareMenuSpiceLevel = async () => {
  const queryInterface = sequelize.getQueryInterface();
  let tableDefinition;

  try {
    tableDefinition = await queryInterface.describeTable("menus");
  } catch {
    // The table does not exist yet. sequelize.sync() will create it normally.
    return;
  }

  const tableName = '"menus"';
  const spiceColumn = tableDefinition.spice_level;

  if (!spiceColumn) {
    await queryInterface.addColumn("menus", "spice_level", {
      type: DataTypes.INTEGER,
      allowNull: true,
    });
  } else if (!String(spiceColumn.type).toLowerCase().includes("int")) {
    // Convert the previous enum/string column through a temporary integer
    // column, because PostgreSQL cannot directly cast the enum to integer.
    if (!tableDefinition.spice_level_id) {
      await queryInterface.addColumn("menus", "spice_level_id", {
        type: DataTypes.INTEGER,
        allowNull: true,
      });
    }

    await sequelize.query(`
      UPDATE ${tableName}
      SET "spice_level_id" = CASE UPPER("spice_level"::text)
        WHEN 'NONE' THEN 1
        WHEN 'MILD' THEN 2
        WHEN 'MEDIUM' THEN 3
        WHEN 'HOT' THEN 4
        WHEN 'EXTRA_HOT' THEN 5
        ELSE 1
      END
      WHERE "spice_level_id" IS NULL
    `);

    await sequelize.query(`
      ALTER TABLE ${tableName} DROP COLUMN "spice_level"
    `);
    await sequelize.query(`
      ALTER TABLE ${tableName} RENAME COLUMN "spice_level_id" TO "spice_level"
    `);
  }

  await sequelize.query(`
    UPDATE ${tableName}
    SET "spice_level" = COALESCE("spice_level", 1)
    WHERE "spice_level" IS NULL
  `);
};

// Dining statuses the API relies on (see utils/reservationStatus.js). Only
// missing rows are inserted, so names/colours edited in the DB are kept.
const REQUIRED_DINING_STATUSES = [
  { status_id: 1, name: "CONFIRMED", color_code: "#6366F1" },
  { status_id: 2, name: "SEATED", color_code: "#0EA5E9" },
  { status_id: 3, name: "COMPLETED", color_code: "#22C55E" },
  { status_id: 4, name: "CANCELLED", color_code: "#EF4444" },
  { status_id: 5, name: "PENDING", color_code: "#F59E0B" },
  { status_id: 6, name: "CLEANING", color_code: "#14B8A6" },
  { status_id: 7, name: "SERVING", color_code: "#8B5CF6" },
];

// prepareStatusMasterTable() fills missing names with "STATUS_<id>". Replace
// those placeholders with the real names from utils/; names someone has
// actually edited are left alone.
const fixPlaceholderStatusNames = async (tableName, statuses) => {
  for (const [name, statusId] of Object.entries(statuses)) {
    await sequelize.query(
      `UPDATE "${tableName}"
       SET "name" = :name, "updated_at" = NOW()
       WHERE "status_id" = :statusId AND "name" ~ '^STATUS_[0-9]+$'`,
      { replacements: { name, statusId } },
    );
  }
};

// Order statuses the API relies on (see utils/orderStatus.js). Only missing
// rows are inserted, so names/colours edited in the DB are kept.
const REQUIRED_ORDER_STATUSES = [
  { status_id: 1, name: "ORDERED", color_code: "#6366F1" },
  { status_id: 2, name: "ACCEPTED", color_code: "#0EA5E9" },
  { status_id: 3, name: "PREPARING", color_code: "#F59E0B" },
  { status_id: 4, name: "READY", color_code: "#14B8A6" },
  { status_id: 5, name: "SERVED", color_code: "#8B5CF6" },
  { status_id: 6, name: "COMPLETED", color_code: "#22C55E" },
  { status_id: 7, name: "CANCELLED", color_code: "#EF4444" },
  { status_id: 8, name: "DELIVERED", color_code: "#0EA5E9" },
];

// Inserts master rows that are missing. These tables' "id" column has no
// sequence in older databases (it was added after the rows existed), so the
// next id is chosen here. A failure is logged, not fatal: the app runs
// without the extra status until it is fixed.
const ensureStatusRows = async (tableName, statuses) => {
  for (const status of statuses) {
    try {
      // MAX() sits in a sub-select: an aggregate SELECT always returns one
      // row, so with it in the outer query the NOT EXISTS filter did nothing
      // and every start tried (and failed) to re-insert existing statuses.
      await sequelize.query(
        `INSERT INTO "${tableName}" ("id", "status_id", "name", "color_code", "created_at", "updated_at")
         SELECT (SELECT COALESCE(MAX("id"), 0) + 1 FROM "${tableName}"),
                :status_id, :name, :color_code, NOW(), NOW()
         WHERE NOT EXISTS (
           SELECT 1 FROM "${tableName}" WHERE "status_id" = :status_id
         )`,
        { replacements: status },
      );
    } catch (error) {
      console.warn(
        `Could not add ${status.name} to ${tableName}: ${error.message}`,
      );
    }
  }
};

const ensureOrderStatuses = () =>
  ensureStatusRows("order_status_master", REQUIRED_ORDER_STATUSES);

const ensureDiningStatuses = () =>
  ensureStatusRows("dining_status", REQUIRED_DINING_STATUSES);

// menu_code used to be unique across all hotels; it is now unique per hotel
// (index menus_hotel_id_menu_code_unique). Drop the old global constraints,
// including the copies sync({ alter: true }) piled up (…_key1, …_key144).
const dropGlobalMenuCodeUnique = async () => {
  const [rows] = await sequelize.query(`
    SELECT conname FROM pg_constraint
    WHERE conrelid = to_regclass('public.menus')
      AND contype = 'u'
      AND conname ~ '^menus_menu_code_key[0-9]*$'
  `);
  for (const { conname } of rows) {
    await sequelize.query(`ALTER TABLE "menus" DROP CONSTRAINT "${conname}"`);
  }
  if (rows.length) {
    console.log(`Dropped ${rows.length} global menu_code unique constraint(s)`);
  }
};

// Columns declared with `unique: true` get one more "<table>_<col>_keyN"
// constraint on every sync({ alter: true }). Keep the first of each and drop
// the rest. A copy something else depends on is skipped.
const dropDuplicateUniqueConstraints = async () => {
  const [rows] = await sequelize.query(`
    SELECT conrelid::regclass::text AS table_name, conname,
           row_number() OVER (
             PARTITION BY conrelid, conkey
             ORDER BY length(conname), conname
           ) AS copy_no
    FROM pg_constraint
    WHERE contype = 'u'
      AND connamespace = 'public'::regnamespace
      AND conname ~ '_key[0-9]*$'
  `);
  let dropped = 0;
  for (const { table_name, conname, copy_no } of rows) {
    if (Number(copy_no) === 1) continue;
    try {
      await sequelize.query(
        `ALTER TABLE ${table_name} DROP CONSTRAINT "${conname}"`,
      );
      dropped += 1;
    } catch (error) {
      console.warn(`Kept ${conname}: ${error.message}`);
    }
  }
  if (dropped) console.log(`Dropped ${dropped} duplicate unique constraint(s)`);
};

// Orders can be placed without a table booking, but sync({ alter: true })
// does not drop NOT NULL from the existing reservation_id column. Do it here.
const allowOrdersWithoutReservation = async () => {
  const [rows] = await sequelize.query(`
    SELECT is_nullable FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'reservation_orders'
      AND column_name = 'reservation_id'
  `);
  if (rows[0]?.is_nullable === "NO") {
    await sequelize.query(
      `ALTER TABLE "reservation_orders" ALTER COLUMN "reservation_id" DROP NOT NULL`,
    );
    console.log("reservation_orders.reservation_id is now optional");
  }
};

// menu_side_dish_mapping.side_dish_id used to point at the global
// menu_side_dishes list; it now points at side_dishes (one list per menu
// category). Copy each linked global side dish into its menu's category and
// re-point the link, before sync({ alter: true }) adds the new foreign key.
const moveMenuSideDishesToCategories = async () => {
  const [[tables]] = await sequelize.query(`
    SELECT to_regclass('public.menu_side_dish_mapping') AS mapping,
           to_regclass('public.menu_side_dishes') AS old_dishes
  `);
  if (!tables.mapping) return;

  const [newFk] = await sequelize.query(`
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.menu_side_dish_mapping'::regclass
      AND contype = 'f'
      AND confrelid = to_regclass('public.side_dishes')
  `);
  if (newFk.length) return; // already migrated

  await sequelize.models.SideDish.sync();

  await sequelize.transaction(async (transaction) => {
    const run = (sql) => sequelize.query(sql, { transaction });

    const [oldFks] = await run(`
      SELECT conname FROM pg_constraint
      WHERE conrelid = 'public.menu_side_dish_mapping'::regclass
        AND contype = 'f'
        AND confrelid = to_regclass('public.menu_side_dishes')
    `);
    for (const { conname } of oldFks) {
      await run(`ALTER TABLE "menu_side_dish_mapping" DROP CONSTRAINT "${conname}"`);
    }

    if (tables.old_dishes) {
      await run(`
        INSERT INTO "side_dishes"
          (hotel_id, category_id, side_dish_name, description, price,
           display_order, is_active, "createdAt", "updatedAt")
        SELECT DISTINCT ON (m.category_id, lower(sd.side_dish_name))
               m.hotel_id, m.category_id, sd.side_dish_name, sd.description, 0,
               COALESCE(sd.display_order, 0), COALESCE(sd.is_active, true),
               NOW(), NOW()
        FROM "menu_side_dish_mapping" mp
        JOIN "menus" m ON m.id = mp.menu_id
        JOIN "menu_side_dishes" sd ON sd.id = mp.side_dish_id
        WHERE NOT EXISTS (
          SELECT 1 FROM "side_dishes" s
          WHERE s.category_id = m.category_id
            AND lower(s.side_dish_name) = lower(sd.side_dish_name)
        )
        ORDER BY m.category_id, lower(sd.side_dish_name), sd.id
      `);

      await run(`
        UPDATE "menu_side_dish_mapping" mp
        SET side_dish_id = s.id
        FROM "menus" m, "menu_side_dishes" sd, "side_dishes" s
        WHERE m.id = mp.menu_id
          AND sd.id = mp.side_dish_id
          AND s.category_id = m.category_id
          AND lower(s.side_dish_name) = lower(sd.side_dish_name)
      `);
    }

    // Links that could not be moved, and duplicates created by the move.
    await run(`
      DELETE FROM "menu_side_dish_mapping" mp
      WHERE NOT EXISTS (
        SELECT 1 FROM "side_dishes" s
        JOIN "menus" m ON m.category_id = s.category_id
        WHERE s.id = mp.side_dish_id AND m.id = mp.menu_id
      )
    `);
    await run(`
      DELETE FROM "menu_side_dish_mapping" a
      USING "menu_side_dish_mapping" b
      WHERE a.menu_id = b.menu_id
        AND a.side_dish_id = b.side_dish_id
        AND a.id > b.id
    `);
  });

  console.log("Menu side dishes now come from each menu's category");
};

// Menu categories used to belong to one hotel; they are now shared by all
// hotels (each hotel picks one when adding a menu item). Merge same-named
// categories into the oldest one (menu items and side dishes move with
// them; same-named side dishes become one), then clear hotel_id. Runs once:
// afterwards no category has a hotel.
const shareMenuCategories = async () => {
  const [[state]] = await sequelize.query(`
    SELECT to_regclass('public.menu_categories') AS categories,
           to_regclass('public.side_dishes') AS side_dishes,
           to_regclass('public.menu_side_dish_mapping') AS mapping
  `);
  if (!state.categories) return;
  const [[pending]] = await sequelize.query(
    `SELECT count(*)::int AS n FROM "menu_categories" WHERE "hotel_id" IS NOT NULL`,
  );
  if (!pending.n) return;

  await sequelize.transaction(async (transaction) => {
    const run = (sql) => sequelize.query(sql, { transaction });

    await run(`ALTER TABLE "menu_categories" ALTER COLUMN "hotel_id" DROP NOT NULL`);
    await run(`
      CREATE TEMP TABLE category_keep ON COMMIT DROP AS
      SELECT "id",
             first_value("id") OVER (
               PARTITION BY lower(btrim("category_name")) ORDER BY "id"
             ) AS keep_id,
             bool_or("is_active") OVER (PARTITION BY lower(btrim("category_name"))) AS any_active
      FROM "menu_categories"
    `);
    await run(`
      UPDATE "menus" m SET "category_id" = k.keep_id
      FROM category_keep k WHERE m."category_id" = k."id" AND k."id" <> k.keep_id
    `);

    if (state.side_dishes) {
      await run(`ALTER TABLE "side_dishes" ALTER COLUMN "hotel_id" DROP NOT NULL`);
      await run(`
        UPDATE "side_dishes" d SET "category_id" = k.keep_id
        FROM category_keep k WHERE d."category_id" = k."id" AND k."id" <> k.keep_id
      `);
      await run(`
        CREATE TEMP TABLE side_keep ON COMMIT DROP AS
        SELECT "id",
               first_value("id") OVER (
                 PARTITION BY "category_id", lower(btrim("side_dish_name")) ORDER BY "id"
               ) AS keep_id
        FROM "side_dishes"
      `);
      if (state.mapping) {
        await run(`
          UPDATE "menu_side_dish_mapping" mp SET "side_dish_id" = s.keep_id
          FROM side_keep s WHERE mp."side_dish_id" = s."id" AND s."id" <> s.keep_id
        `);
        await run(`
          DELETE FROM "menu_side_dish_mapping" a
          USING "menu_side_dish_mapping" b
          WHERE a."menu_id" = b."menu_id" AND a."side_dish_id" = b."side_dish_id"
            AND a."id" > b."id"
        `);
      }
      await run(`
        DELETE FROM "side_dishes" d USING side_keep s
        WHERE d."id" = s."id" AND s."id" <> s.keep_id
      `);
      await run(`UPDATE "side_dishes" SET "hotel_id" = NULL WHERE "hotel_id" IS NOT NULL`);
    }

    await run(`
      UPDATE "menu_categories" c SET "is_active" = k.any_active
      FROM category_keep k WHERE c."id" = k."id" AND k."id" = k.keep_id
    `);
    await run(`
      DELETE FROM "menu_categories" c USING category_keep k
      WHERE c."id" = k."id" AND k."id" <> k.keep_id
    `);
    await run(`UPDATE "menu_categories" SET "hotel_id" = NULL WHERE "hotel_id" IS NOT NULL`);
  });

  console.log("Menu categories are now shared by all hotels");
};

export const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log("DB connected successfully");

    await prepareStatusMasterTable("order_status_master");
    await prepareStatusMasterTable("payment_status_master");
    await prepareSpiceLevelTable();
    await prepareMenuSpiceLevel();
    await dropGlobalMenuCodeUnique();
    await moveMenuSideDishesToCategories();
    await shareMenuCategories();

    // Uncomment only if you want Sequelize to create/update tables
    await sequelize.sync({ alter: true });
    await dropDuplicateUniqueConstraints();
    await allowOrdersWithoutReservation();

    await ensureDiningStatuses();
    await ensureOrderStatuses();
    await fixPlaceholderStatusNames("order_status_master", ORDER_STATUS);
    await fixPlaceholderStatusNames("payment_status_master", PAYMENT_STATUS);

    console.log("All models synchronized");
  } catch (error) {
    console.error("DB error:", error);
    process.exit(1);
  }
};

export default sequelize;
