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
    is_booked: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    tableName: "seats",
    timestamps: true,
    indexes: [{ unique: true, fields: ["table_id", "seat_number"] }],
  }
);

export default Seat;
