import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";
import HotelTable from "./hotelTable.model.js";
import SideDish from "./sideDish.model.js";
const MenuCategory = sequelize.define(
  "MenuCategory",
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

    category_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: "Category name is required",
        },
      },
    },

    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    display_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },

    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: "menu_categories",
    timestamps: true,
    underscored: false,
  }
);


export default MenuCategory;