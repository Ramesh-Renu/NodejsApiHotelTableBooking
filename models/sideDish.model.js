import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";
import HotelTable from "./hotelTable.model.js";
import MenuCategory from "./menuCategory.model.js";

const SideDish = sequelize.define(
  "SideDish",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    hotel_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: HotelTable,
        key: "id",
      },
    },

    category_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "menu_categories",
        key: "id",
      },
    },

    side_dish_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },

    display_order: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },

    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: "side_dishes",
    timestamps: true,
  },
);

SideDish.belongsTo(HotelTable, {
  foreignKey: "hotel_id",
  as: "hotel",
});

HotelTable.hasMany(SideDish, {
  foreignKey: "hotel_id",
  as: "sideDishes",
});

export default SideDish;
