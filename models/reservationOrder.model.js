
import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

import Reservation from "./reservation.model.js";
import HotelTable from "./hotelTable.model.js";

const ReservationOrder = sequelize.define(
  "ReservationOrder",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    reservation_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Reservation,
        key: "id",
      },
    },

    hotel_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: HotelTable,
        key: "id",
      },
    },

    order_number: {
      type: DataTypes.STRING(30),
      allowNull: false,
      unique: true,
    },

    order_status: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      comment:
        "1=Ordered,2=Accepted,3=Preparing,4=Ready,5=Served,6=Completed,7=Cancelled",
    },

    payment_status: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment:
        "0=Pending,1=Paid,2=Refunded",
    },

    subtotal: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },

    tax: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },

    discount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },

    service_charge: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },

    total_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },

    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    ordered_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },

    completed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "reservation_orders",
    timestamps: true,
  }
);

export default ReservationOrder;