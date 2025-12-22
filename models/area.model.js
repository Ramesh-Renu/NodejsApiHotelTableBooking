import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

const Area = sequelize.define(
  "Area",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    description: {
      type: DataTypes.STRING,
    },
    location_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "areas",
    timestamps: true,
  }
);

export default Area;
