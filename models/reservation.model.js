import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

const Reservation = sequelize.define(
  "Reservation",
  {
    id: {
      type: DataTypes.INTEGER,          // ✅ matches DB
      autoIncrement: true,
      primaryKey: true,
    },

    hotel_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    floor_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    booking_date: {
      type: DataTypes.DATEONLY,         // date
      allowNull: false,
    },

    start_time: {
      type: DataTypes.TIME,             // time without time zone
      allowNull: false,
    },

    end_time: {
      type: DataTypes.TIME,
      allowNull: true,
    },

    seat_status: {
      type: DataTypes.JSONB,             // ✅ key change
      allowNull: false,
    },

    reservation_date: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },

    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "reservations",
    timestamps: true,
    createdAt: "reservation_date",
    updatedAt: "updated_at",
  }
);

export default Reservation;
