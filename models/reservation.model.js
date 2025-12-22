import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

const Reservation = sequelize.define(
  "Reservation",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    hotel_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    table_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },

    seat_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },

    customer_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    customer_mobile: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    reservation_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },

    reservation_time: {
      type: DataTypes.TIME,
      allowNull: false,
    },

    guest_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    status: {
      type: DataTypes.ENUM("BOOKED", "CANCELLED", "COMPLETED"),
      defaultValue: "BOOKED",
    },
  },
  {
    tableName: "reservations",
    timestamps: true,
  }
);

export default Reservation;
