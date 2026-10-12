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

// Order statuses added after the master table was seeded. Only missing rows
// are inserted, so names/colours edited in the DB are kept.
const REQUIRED_ORDER_STATUSES = [
  { status_id: 8, name: "DELIVERED", color_code: "#0EA5E9" },
];

// Inserts master rows that are missing. These tables' "id" column has no
// sequence in older databases (it was added after the rows existed), so the
// next id is chosen here. A failure is logged, not fatal: the app runs
// without the extra status until it is fixed.
const ensureStatusRows = async (tableName, statuses) => {
  for (const status of statuses) {
    try {
      await sequelize.query(
        `INSERT INTO "${tableName}" ("id", "status_id", "name", "color_code", "created_at", "updated_at")
         SELECT COALESCE(MAX("id"), 0) + 1, :status_id, :name, :color_code, NOW(), NOW()
         FROM "${tableName}"
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

export const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log("DB connected successfully");

    await prepareStatusMasterTable("order_status_master");
    await prepareStatusMasterTable("payment_status_master");
    await prepareSpiceLevelTable();
    await prepareMenuSpiceLevel();
    await dropGlobalMenuCodeUnique();

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
