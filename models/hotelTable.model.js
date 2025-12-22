import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

const HotelTable = sequelize.define(
  "HotelTable",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    hotel_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    location: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    building: {
      type: DataTypes.STRING,
    },
    area_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    floor: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    location_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    tables_per_floor: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    chairs_per_table: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    tableName: "hotel_tables",
    timestamps: true,
  }
);

export default HotelTable;
