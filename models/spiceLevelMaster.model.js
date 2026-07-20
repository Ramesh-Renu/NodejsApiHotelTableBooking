import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const SpiceLevelMaster = sequelize.define(
  "SpiceLevelMaster",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    spice_level: {
      type: DataTypes.STRING(30),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: {
          msg: "Spice level is required",
        },
      },
    },

    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    display_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },

    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: "spice_level_master",
    timestamps: true,
    underscored: true,
  },
);

export default SpiceLevelMaster;
