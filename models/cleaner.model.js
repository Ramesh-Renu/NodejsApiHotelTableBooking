import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

// Housekeeping staff assigned when a reservation's table goes to Cleaning.
const Cleaner = sequelize.define(
  "Cleaner",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    cleaner_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },

    // Shift / area covered, e.g. "Morning", "Floor 2".
    shift: {
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
    tableName: "cleaners",
    timestamps: true,
  },
);

export default Cleaner;
