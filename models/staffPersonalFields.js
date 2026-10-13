import { DataTypes } from "sequelize";

/**
 * Optional personal details and working hours shared by every kind of
 * staff (cooks, servers, cleaners). All nullable: only the name is required.
 */
export const STAFF_PERSONAL_FIELDS = {
  phone: { type: DataTypes.STRING(20), allowNull: true },
  email: { type: DataTypes.STRING(150), allowNull: true },
  gender: { type: DataTypes.STRING(20), allowNull: true },
  date_of_birth: { type: DataTypes.DATEONLY, allowNull: true },
  address: { type: DataTypes.TEXT, allowNull: true },
  // Person to call in an emergency, e.g. "Ravi (brother) 98765 43210".
  emergency_contact: { type: DataTypes.STRING(150), allowNull: true },
  joined_on: { type: DataTypes.DATEONLY, allowNull: true },
  // Working hours, e.g. 09:00 – 17:00 (may run past midnight).
  shift_start: { type: DataTypes.TIME, allowNull: true },
  shift_end: { type: DataTypes.TIME, allowNull: true },
  // Where they work: location / area (taken from the hotel when one is
  // picked) and the floor of that hotel.
  location_id: { type: DataTypes.INTEGER, allowNull: true },
  area_id: { type: DataTypes.INTEGER, allowNull: true },
  floor_id: { type: DataTypes.INTEGER, allowNull: true },
};

export const STAFF_PERSONAL_FIELD_NAMES = Object.keys(STAFF_PERSONAL_FIELDS);
