import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

// One row per device that runs the installed app (PWA). Reported by the app
// when it is installed and when it is opened as an installed app.
const PwaInstall = sequelize.define(
  "PwaInstall",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    // Random id the app keeps on the device (localStorage).
    device_id: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },

    // Last signed-in user on that device.
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    // e.g. "android", "ios", "windows", "mac", "other".
    platform: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },

    user_agent: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },

    installed_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },

    last_seen_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "pwa_installs",
    timestamps: true,
    indexes: [
      { name: "pwa_installs_device_id_unique", unique: true, fields: ["device_id"] },
    ],
  },
);

export default PwaInstall;
