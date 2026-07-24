import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const MenuSideDishMapping = sequelize.define(
  "MenuSideDishMapping",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    menu_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "menus",
        key: "id",
      },
    },

    side_dish_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "menu_side_dishes",
        key: "id",
      },
    },

    is_complimentary: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: "menu_side_dish_mapping",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
  }
);

export default MenuSideDishMapping;