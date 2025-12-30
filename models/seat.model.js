import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";
const Seat = sequelize.define(
  "Seat",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    table_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    seat_number: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    reservation_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    status: {
      type: DataTypes.INTEGER, // ✅ BOOLEAN → INTEGER
      allowNull: false,
      defaultValue: 4, // 0 = AVAILABLE
      comment: "4=AVAILABLE,1=BOOKED,2=CANCEL,3=CLEANING",
    },
  },
  {
    tableName: "seats",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["table_id", "seat_number"],
      },
    ],
  }
);

export default Seat;
