import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

const Table = sequelize.define(
  "Table",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    hotel_table_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    floor_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    table_number: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
      },
    },
    // Display code, e.g. SACT0001 (hotel prefix + number continuous per hotel).
    table_code: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
  },
  {
    tableName: "tables",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["hotel_table_id", "floor_id", "table_number"],
      },
    ],
  }
);

export default Table;
