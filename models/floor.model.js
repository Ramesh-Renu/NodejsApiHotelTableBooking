import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

const Floor = sequelize.define(
  "Floor",
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
    floor_number: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    tableName: "floors",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["hotel_table_id", "floor_number"],
      },
    ],
  }
);

export default Floor;
