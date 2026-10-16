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
    user_type_id: {
      type: DataTypes.INTEGER,
      defaultValue: 2,
    },
    // Admin access granted by a SuperAdmin (utils/permissions.js):
    // { pageKey: ["view", "create", "edit", "delete"] }. null = full access
    // (Admins created before roles existed).
    permissions: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    // Hotels an Admin may manage. null = all hotels.
    hotel_ids: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    // Staff users only: Manager / Lead / Member (utils/permissions.js).
    staff_category: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    // Staff users added from Settings → Cooks / Servers / Cleaners:
    // "Cook" / "Server" / "Cleaner" (utils/staffAccount.js).
    staff_type: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    // Staff / Admin access removed (User Management → Inactive users): when,
    // by whom, and the access they had, so it can be retrieved later.
    removed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    removed_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    previous_access: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    // The Admin (or SuperAdmin) who created this Staff user; Admins manage
    // only their own Staff.
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "registerUsersData",
    freezeTableName: true,
    timestamps: true,
  },
);

export default RegisterUsersData;
