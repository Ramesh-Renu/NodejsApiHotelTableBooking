import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

const HotelTable = sequelize.define(
  "HotelTable",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    hotel_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    location_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    area_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    address: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    tables_per_floor: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
      },
    },

    chairs_per_table: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
      },
    },

    // Prefix for this hotel's table codes, e.g. SACT -> SACT0001. Unique per
    // hotel; enforced in utils/tableCode.js (unique:true + sync alter adds a
    // duplicate constraint on every boot in Postgres).
    table_code_prefix: {
      type: DataTypes.STRING(8),
      allowNull: true,
    },
  },
  {
    tableName: "hotel_tables",
    timestamps: true,
  }
);

export default HotelTable;
