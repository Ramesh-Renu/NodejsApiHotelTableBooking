import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

const RegisterUsersData = sequelize.define(
  "RegisterUsersData",
  {
    name: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        notEmpty: {
          msg: "Name cannot be empty",
        },
      },
    },

    email: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isEmail: {
          msg: "Invalid email format",
        },
        notEmpty: {
          msg: "Email cannot be empty",
        },
      },
    },

    mobilenumber: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: {
          msg: "Mobile number is required",
        },
      },
    },

    location: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        notEmpty: {
          msg: "Location cannot be empty",
        },
      },
    },

    role: {
      type: DataTypes.STRING,
      defaultValue: "user",
    },
  },
  {
    tableName: "registerUsersData",
    freezeTableName: true,
    timestamps: true,
  }
);

export default RegisterUsersData;
