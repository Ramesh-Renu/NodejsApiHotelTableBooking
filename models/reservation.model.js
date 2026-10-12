import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

const Reservation = sequelize.define(
  "Reservation",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },

    hotel_id: { type: DataTypes.INTEGER, allowNull: false },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    floor_id: { type: DataTypes.INTEGER, allowNull: false },

    start_time: { type: DataTypes.TIME, allowNull: false },
    end_time: { type: DataTypes.TIME },

    seat_status: { type: DataTypes.JSONB, allowNull: false },

    dining_date: { type: DataTypes.DATE, allowNull: false },

    dining_status: { type: DataTypes.INTEGER, defaultValue: 1 },
    // Server looking after the table, chosen when the booking is confirmed.
    server_id: { type: DataTypes.INTEGER, allowNull: true },
    // Cleaner assigned when the table goes to Cleaning.
    cleaner_id: { type: DataTypes.INTEGER, allowNull: true },
    // Party size chosen in the slot picker.
    guest_count: { type: DataTypes.INTEGER, allowNull: true },
  },
  {
    tableName: "reservations",
    timestamps: true,
    createdAt: "booking_date", // 👈 this fills booking_date
    updatedAt: "updated_at",
  }
);

export default Reservation;
