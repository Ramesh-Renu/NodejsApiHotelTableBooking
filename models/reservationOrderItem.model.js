import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

import ReservationOrder from "./reservationOrder.model.js";
import Menu from "./menu.model.js";

const ReservationOrderItem = sequelize.define(
  "ReservationOrderItem",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    reservation_order_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: ReservationOrder,
        key: "id",
      },
    },

    menu_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Menu,
        key: "id",
      },
    },

    menu_name: {
      type: DataTypes.STRING(150),
      allowNull: false,
      comment: "Menu name at the time of ordering",
    },

    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      validate: {
        min: 1,
      },
    },

    unit_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "Menu price at the time of ordering",
    },

    discount_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },

    tax_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },

    total_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },

    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Less spicy, No onion, etc.",
    },

    item_status: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      comment:
        "1=Ordered,2=Preparing,3=Ready,4=Served,5=Cancelled",
    },
  },
  {
    tableName: "reservation_order_items",
    timestamps: true,
  }
);

export default ReservationOrderItem;