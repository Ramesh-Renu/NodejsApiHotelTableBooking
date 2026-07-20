import { DataTypes, Sequelize } from "sequelize";
import dotenv from "dotenv";

dotenv.config();

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
    // dialectOptions: {
    //   ssl: {
    //     require: true,
    //     rejectUnauthorized: false,
    //   },
    // },
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

export const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log("DB connected successfully");

    await prepareStatusMasterTable("order_status_master");
    await prepareStatusMasterTable("payment_status_master");
    await prepareSpiceLevelTable();
    await prepareMenuSpiceLevel();

    // Uncomment only if you want Sequelize to create/update tables
    await sequelize.sync({ alter: true });

    console.log("All models synchronized");
  } catch (error) {
    console.error("DB error:", error);
    process.exit(1);
  }
};

export default sequelize;
