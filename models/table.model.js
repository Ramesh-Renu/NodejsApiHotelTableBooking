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
      validate: {
        min: 1,
      },
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
