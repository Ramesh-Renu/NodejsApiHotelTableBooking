import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

const CancelReservation = sequelize.define(
  "cancelled_reservations",
  {
    reservation_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    seat_status: {
      type: DataTypes.JSONB,
    },
    cancelled_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "cancelled_reservations",
    timestamps: false,   // ⭐ ADD THIS
  }
);

export default CancelReservation;
