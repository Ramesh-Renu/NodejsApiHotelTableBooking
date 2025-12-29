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
    table_number: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    tableName: "tables",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["floor_id", "table_number"], // ✅ ONLY THIS
      },
    ],
  }
);

export default Table;
