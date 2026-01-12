import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

const DiningStatusMaster = sequelize.define(
  "DiningStatusMaster",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    status_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },

    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },

    color_code: {
      type: DataTypes.STRING(20), // VARCHAR(20)
      allowNull: false,
      defaultValue: "#000000", // note: 6 digits
    },
  },
  {
    tableName: "dining_status",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

export default DiningStatusMaster;
