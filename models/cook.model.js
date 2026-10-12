import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

// Kitchen staff that can be assigned to an order when it is accepted.
const Cook = sequelize.define(
  "Cook",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    cook_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },

    // e.g. "South Indian", "Tandoor", "Desserts"
    speciality: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    // Optional photo (ImageKit, via POST /api/upload).
    photo_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },

    photo_file_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    // Null = works for every hotel.
    hotel_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: "cooks",
    timestamps: true,
  },
);

export default Cook;
