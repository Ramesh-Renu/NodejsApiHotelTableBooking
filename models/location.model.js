import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

const Location = sequelize.define(
  "Location",
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
  },
  {
    tableName: "locations",
    timestamps: true,
  }
);

export default Location;
