import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

const RefreshToken = sequelize.define(
  "RefreshToken",
  {
    mobile: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    token: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
  },
  {
    tableName: "refresh_tokens",
    timestamps: false, // 👈 VERY IMPORTANT FIX
  }
);

export default RefreshToken;
