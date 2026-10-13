import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";
import { STAFF_PERSONAL_FIELDS } from "./staffPersonalFields.js";

// Floor staff (waiters) assigned to an order when it is served.
const Server = sequelize.define(
  "Server",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    server_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },

    // Section / shift the server covers, e.g. "Floor 1", "Evening".
    section: {
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

    // Optional personal details + working hours (see staffPersonalFields.js).
    ...STAFF_PERSONAL_FIELDS,

    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: "servers",
    timestamps: true,
  },
);

export default Server;
