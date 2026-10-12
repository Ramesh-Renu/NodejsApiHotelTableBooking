import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

import HotelTable from "./hotelTable.model.js";
import MenuCategory from "./menuCategory.model.js";

const Menu = sequelize.define(
  "Menu",
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
        model: MenuCategory,
        key: "id",
      },
    },

    menu_name: {
      type: DataTypes.STRING(150),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: "Menu name is required",
        },
      },
    },

    // Optional; unique per hotel (see indexes below). A column-level
    // `unique: true` made sync({ alter: true }) add a new constraint on every
    // boot (menus_menu_code_key, _key1, ... _key144).
    menu_code: {
      type: DataTypes.STRING(30),
      allowNull: true,
    },

    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    image: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },

    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: {
          args: [0],
          msg: "Price must be greater than 0",
        },
      },
    },

    preparation_time: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 15,
      comment: "Preparation time in minutes",
    },

    is_veg: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },

    spice_level: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },

    calories: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    is_available: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },

    display_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    image_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },

    image_file_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    tableName: "menus",
    timestamps: true,
    indexes: [
      {
        name: "menus_hotel_id_menu_code_unique",
        unique: true,
        fields: ["hotel_id", "menu_code"],
      },
    ],
  },
);

export default Menu;
