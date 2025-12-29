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

    location_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    area_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    address: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    tables_per_floor: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
      },
    },

    chairs_per_table: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
      },
    },
  },
  {
    tableName: "hotel_tables",
    timestamps: true,
  }
);

export default HotelTable;
