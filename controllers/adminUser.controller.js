import { Op } from "sequelize";
import RegisterUsersData from "../models/user.model.js";
import HotelTable from "../models/hotelTable.model.js";
import {
  PERMISSION_CATALOG,
  ROLES,
  USER_TYPE,
  isSuperAdmin,
  sanitizeHotelIds,
  sanitizePermissions,
} from "../utils/permissions.js";
import { trimStaffOf } from "./staffUser.controller.js";
import { NOT_REMOVED, removeAccess, withProfileDetails } from "../utils/staffAccount.js";

const STAFF_ATTRIBUTES = [
  "id",
  "name",
  "email",
  "mobilenumber",
  "location",
  "role",
  "permissions",
  "hotel_ids",
  "is_active",
  "createdAt",
  "updatedAt",
];

const trimOrNull = (value) => {
  const text = String(value ?? "").trim();
  return text || null;
};

/** Hotel ids that don't exist (or were deleted). */
const unknownHotelIds = async (ids) => {
  if (!ids?.length) return [];
  const found = await HotelTable.findAll({ where: { id: ids }, attributes: ["id"] });
  const foundIds = new Set(found.map((h) => h.id));
  return ids.filter((id) => !foundIds.has(id));
};

/** Validates the access part of a create/update body. Returns { error } or the clean values. */
const readAccess = async (body) => {
  const permissions = sanitizePermissions(body.permissions);
  // all_hotels: true stores null (every hotel, including future ones).
  const hotelIds = body.all_hotels ? null : sanitizeHotelIds(body.hotel_ids ?? []);
  const missing = await unknownHotelIds(hotelIds);
  if (missing.length) {
    return { error: `Hotel(s) not found: ${missing.join(", ")}` };
  }
  return { permissions, hotelIds };
};

/** GET /api/admin/permissions — pages and options a SuperAdmin can grant. */
export const getPermissionCatalog = (req, res) => {
  res.json({ success: true, data: PERMISSION_CATALOG });
};

/** GET /api/admin/users — Admin and SuperAdmin accounts. */
export const getAdminUsers = async (req, res) => {
  try {
    const { search } = req.query;
    const where = {
      role: { [Op.iLike]: { [Op.any]: [ROLES.ADMIN, ROLES.SUPER_ADMIN] } },
    };
    const term = String(search || "").trim();
    if (term) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${term}%` } },
        { mobilenumber: { [Op.iLike]: `%${term}%` } },
        { email: { [Op.iLike]: `%${term}%` } },
      ];
    }
    const users = await RegisterUsersData.findAll({
      where,
      attributes: STAFF_ATTRIBUTES,
      order: [["id", "DESC"]],
    });
    res.json({ success: true, data: await withProfileDetails(users) });
  } catch (error) {
    console.error("Get admin users error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * POST /api/admin/users — create an Admin. A mobile number already
 * registered as a guest is upgraded to Admin (they keep their bookings).
 */
export const createAdminUser = async (req, res) => {
  try {
    const mobilenumber = trimOrNull(req.body.mobilenumber);
    const name = trimOrNull(req.body.name);
    if (!mobilenumber || !/^\d{10}$/.test(mobilenumber)) {
      return res.status(400).json({ success: false, message: "Enter a valid 10-digit mobile number" });
    }
    if (!name) {
      return res.status(400).json({ success: false, message: "Name is required" });
    }

    const access = await readAccess(req.body);
    if (access.error) {
      return res.status(400).json({ success: false, message: access.error });
    }

    const values = {
      name,
      email: trimOrNull(req.body.email),
      location: trimOrNull(req.body.location),
      role: ROLES.ADMIN,
      user_type_id: USER_TYPE.ADMIN,
      permissions: access.permissions,
      hotel_ids: access.hotelIds,
      is_active: req.body.is_active !== false,
      ...NOT_REMOVED,
    };

    const existing = await RegisterUsersData.findOne({ where: { mobilenumber } });
    if (existing) {
      if (String(existing.role).toLowerCase() !== ROLES.USER) {
        return res.status(409).json({
          success: false,
          message: "This mobile number already belongs to an admin",
        });
      }
      await existing.update(values);
      return res.json({
        success: true,
        message: "Existing guest account upgraded to Admin",
        data: await RegisterUsersData.findByPk(existing.id, { attributes: STAFF_ATTRIBUTES }),
      });
    }

    const user = await RegisterUsersData.create({ ...values, mobilenumber });
    res.status(201).json({
      success: true,
      message: "Admin created",
      data: await RegisterUsersData.findByPk(user.id, { attributes: STAFF_ATTRIBUTES }),
    });
  } catch (error) {
    if (error.name === "SequelizeValidationError") {
      return res.status(400).json({ success: false, message: error.errors[0]?.message });
    }
    console.error("Create admin error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const findManagedAdmin = async (req, res) => {
  const user = await RegisterUsersData.findByPk(req.params.id);
  if (!user || String(user.role).toLowerCase() === ROLES.USER) {
    res.status(404).json({ success: false, message: "Admin not found" });
    return null;
  }
  if (isSuperAdmin(user.role)) {
    res.status(400).json({
      success: false,
      message: "A SuperAdmin always has full access and can't be changed here",
    });
    return null;
  }
  return user;
};

/** PUT /api/admin/users/:id — details, pages/options, hotels, active flag. */
export const updateAdminUser = async (req, res) => {
  try {
    const user = await findManagedAdmin(req, res);
    if (!user) return;

    const updates = {};
    if (req.body.name !== undefined) {
      const name = trimOrNull(req.body.name);
      if (!name) {
        return res.status(400).json({ success: false, message: "Name is required" });
      }
      updates.name = name;
    }
    if (req.body.email !== undefined) updates.email = trimOrNull(req.body.email);
    if (req.body.location !== undefined) updates.location = trimOrNull(req.body.location);
    if (req.body.is_active !== undefined) updates.is_active = Boolean(req.body.is_active);

    if (
      req.body.permissions !== undefined ||
      req.body.hotel_ids !== undefined ||
      req.body.all_hotels !== undefined
    ) {
      const access = await readAccess({
        permissions: req.body.permissions ?? user.permissions,
        all_hotels: req.body.all_hotels ?? user.hotel_ids === null,
        hotel_ids: req.body.hotel_ids ?? user.hotel_ids,
      });
      if (access.error) {
        return res.status(400).json({ success: false, message: access.error });
      }
      updates.permissions = access.permissions;
      updates.hotel_ids = access.hotelIds;
    }

    await user.update(updates);
    // Their Staff users never keep more than the Admin now has.
    if (updates.permissions !== undefined) await trimStaffOf(user);
    res.json({
      success: true,
      message: "Admin updated",
      data: await RegisterUsersData.findByPk(user.id, { attributes: STAFF_ATTRIBUTES }),
    });
  } catch (error) {
    if (error.name === "SequelizeValidationError") {
      return res.status(400).json({ success: false, message: error.errors[0]?.message });
    }
    console.error("Update admin error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * DELETE /api/admin/users/:id — removes admin access. The account stays as a
 * guest, so its bookings and orders keep their owner.
 */
export const removeAdminUser = async (req, res) => {
  try {
    const user = await findManagedAdmin(req, res);
    if (!user) return;
    await removeAccess(user, req.user.id);
    res.json({ success: true, message: "Admin access removed (see Inactive users)" });
  } catch (error) {
    console.error("Remove admin error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * On startup: makes the account with SUPER_ADMIN_MOBILE a SuperAdmin
 * (creating it if needed), so there is always one to manage admins.
 */
export const ensureSuperAdmin = async () => {
  const mobilenumber = trimOrNull(process.env.SUPER_ADMIN_MOBILE);
  if (!mobilenumber) return;
  const values = {
    role: ROLES.SUPER_ADMIN,
    user_type_id: USER_TYPE.SUPER_ADMIN,
    permissions: null,
    hotel_ids: null,
    is_active: true,
  };
  const [user, created] = await RegisterUsersData.findOrCreate({
    where: { mobilenumber },
    defaults: { ...values, name: process.env.SUPER_ADMIN_NAME || "Super Admin" },
  });
  if (created || !isSuperAdmin(user.role)) {
    if (!created) await user.update(values);
    console.log(`SuperAdmin set for ${mobilenumber}`);
  }
};
