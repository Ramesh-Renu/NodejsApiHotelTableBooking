
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

    // Optional: customers can order from the menu without a table booking.
    reservation_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: Reservation,
        key: "id",
      },
    },

    // Who placed the order (backfilled from the reservation for old rows).
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
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

    // Cook assigned when the order is accepted (see cook.model.js).
    cook_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    // When the kitchen started cooking (first move to Preparing); drives the
    // Preparing timer on the Orders board.
    preparing_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    // When the order reached the table / was handed over.
    served_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    delivered_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    // Server assigned when the order is served (see server.model.js).
    server_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    payment_status: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment:
        "0=Pending,1=Paid,2=Refunded",
    },

    // How a paid order was settled: cash, card or upi (null while pending).
    payment_method: {
      type: DataTypes.STRING(20),
      allowNull: true,
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