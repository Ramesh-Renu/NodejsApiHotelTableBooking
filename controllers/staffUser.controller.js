import { Op } from "sequelize";
import RegisterUsersData from "../models/user.model.js";
import HotelTable from "../models/hotelTable.model.js";
import {
  PERMISSION_CATALOG,
  ROLES,
  STAFF_CATEGORIES,
  USER_TYPE,
  accessOf,
  intersectHotelIds,
  intersectPermissions,
  loadAccess,
  roleOf,
  sanitizeHotelIds,
  sanitizePermissions,
} from "../utils/permissions.js";
import {
  NOT_REMOVED,
  removeAccess,
  setRecordsActive,
  syncRecordFromAccount,
  withProfileDetails,
} from "../utils/staffAccount.js";

/**
 * Staff users: hotel workers (Manager / Lead / Member) created by an Admin.
 * An Admin can give a Staff user only the pages, options and hotels the
 * Admin has; a SuperAdmin can give anything (except admin-only pages).
 */

const STAFF_ATTRIBUTES = [
  "id",
  "name",
  "email",
  "mobilenumber",
  "location",
  "role",
  "staff_category",
  "staff_type",
  "permissions",
  "hotel_ids",
  "is_active",
  "created_by",
  "createdAt",
  "updatedAt",
];

const trimOrNull = (value) => {
  const text = String(value ?? "").trim();
  return text || null;
};

const fail = (res, status, message) => res.status(status).json({ success: false, message });

/** What the signed-in Admin may hand out: pages/options and hotels. */
const grantableOf = (access) => ({
  permissions: sanitizePermissions(access.permissions, { forStaff: true }),
  hotelIds: access.hotelIds, // null = all hotels
});

/** Validates the access part of a create/update body against what the caller can grant. */
const readAccess = async (body, grantable) => {
  const wanted = sanitizePermissions(body.permissions, { forStaff: true });
  const permissions = intersectPermissions(wanted, grantable.permissions);
  const dropped = Object.keys(wanted).filter(
    (page) => (permissions[page] || []).length !== wanted[page].length,
  );
  if (dropped.length) {
    return { error: `You can't give options you don't have (${dropped.join(", ")})` };
  }

  let hotelIds;
  if (body.all_hotels) {
    if (grantable.hotelIds !== null) {
      return { error: "You can only give the hotels assigned to you, not all hotels" };
    }
    hotelIds = null;
  } else {
    hotelIds = sanitizeHotelIds(body.hotel_ids ?? []);
    if (!hotelIds.length) return { error: "Pick at least one hotel" };
    if (intersectHotelIds(hotelIds, grantable.hotelIds).length !== hotelIds.length) {
      return { error: "You can only give the hotels assigned to you" };
    }
    const found = await HotelTable.count({ where: { id: hotelIds } });
    if (found !== hotelIds.length) return { error: "Some selected hotels were not found" };
  }
  return { permissions, hotelIds };
};

const readCategory = (value) =>
  STAFF_CATEGORIES.find((c) => c.toLowerCase() === String(value || "").trim().toLowerCase());

/** GET /api/staff-users/permissions — pages/options and hotels the caller can grant. */
export const getStaffPermissionCatalog = async (req, res) => {
  const grantable = grantableOf(await loadAccess(req));
  const catalog = PERMISSION_CATALOG.filter((page) => !page.adminOnly)
    .map((page) => ({
      ...page,
      actions: page.actions.filter((a) => grantable.permissions[page.key]?.includes(a)),
    }))
    .filter((page) => page.actions.length);
  res.json({
    success: true,
    data: catalog,
    categories: STAFF_CATEGORIES,
    all_hotels_allowed: grantable.hotelIds === null,
  });
};

/**
 * Staff users an Admin manages: the ones they created, plus ones with no
 * creator (added at start-up from Cooks / Servers / Cleaners) whose hotels
 * are all within the Admin's hotels. A SuperAdmin manages everyone.
 */
const manages = (access, user, userId) => {
  if (access.isSuperAdmin) return true;
  if (user.created_by != null) return Number(user.created_by) === Number(userId);
  if (access.hotelIds === null) return true;
  const ids = sanitizeHotelIds(user.hotel_ids);
  return ids !== null && ids.every((id) => access.hotelIds.includes(id));
};

/** GET /api/staff-users — the Staff users the caller manages (SuperAdmin: all). */
export const getStaffUsers = async (req, res) => {
  try {
    const access = await loadAccess(req);
    const where = { role: { [Op.iLike]: ROLES.STAFF } };
    if (!access.isSuperAdmin) {
      where.created_by = { [Op.or]: [req.user.id, null] };
    }
    if (req.query.category) where.staff_category = readCategory(req.query.category) || "";
    const term = String(req.query.search || "").trim();
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
    res.json({
      success: true,
      data: await withProfileDetails(users.filter((user) => manages(access, user, req.user.id))),
    });
  } catch (error) {
    console.error("Get staff users error:", error);
    fail(res, 500, "Internal server error");
  }
};

/**
 * POST /api/staff-users — create a Staff user. A mobile number already
 * registered as a guest is upgraded (they keep their bookings).
 */
export const createStaffUser = async (req, res) => {
  try {
    const access = await loadAccess(req);
    const mobilenumber = trimOrNull(req.body.mobilenumber);
    const name = trimOrNull(req.body.name);
    const category = readCategory(req.body.staff_category);
    if (!mobilenumber || !/^\d{10}$/.test(mobilenumber)) {
      return fail(res, 400, "Enter a valid 10-digit mobile number");
    }
    if (!name) return fail(res, 400, "Name is required");
    if (!category) return fail(res, 400, `Category must be ${STAFF_CATEGORIES.join(", ")}`);

    const granted = await readAccess(req.body, grantableOf(access));
    if (granted.error) return fail(res, 400, granted.error);

    const values = {
      name,
      email: trimOrNull(req.body.email),
      location: trimOrNull(req.body.location),
      role: ROLES.STAFF,
      user_type_id: USER_TYPE.STAFF,
      staff_category: category,
      permissions: granted.permissions,
      hotel_ids: granted.hotelIds,
      is_active: req.body.is_active !== false,
      created_by: req.user.id,
      ...NOT_REMOVED,
    };

    const existing = await RegisterUsersData.findOne({ where: { mobilenumber } });
    if (existing) {
      if (String(existing.role).toLowerCase() !== ROLES.USER) {
        return fail(res, 409, "This mobile number already belongs to a staff or admin account");
      }
      await existing.update(values);
      return res.json({
        success: true,
        message: `Existing guest account added as ${category}`,
        data: await RegisterUsersData.findByPk(existing.id, { attributes: STAFF_ATTRIBUTES }),
      });
    }

    const user = await RegisterUsersData.create({ ...values, mobilenumber });
    res.status(201).json({
      success: true,
      message: `${category} created`,
      data: await RegisterUsersData.findByPk(user.id, { attributes: STAFF_ATTRIBUTES }),
    });
  } catch (error) {
    if (error.name === "SequelizeValidationError") return fail(res, 400, error.errors[0]?.message);
    console.error("Create staff user error:", error);
    fail(res, 500, "Internal server error");
  }
};

/** A Staff user the caller manages (see manages()), or null after replying. */
const findManagedStaff = async (req, res) => {
  const access = await loadAccess(req);
  const user = await RegisterUsersData.findByPk(req.params.id);
  if (
    !user ||
    String(user.role).toLowerCase() !== "staff" ||
    !manages(access, user, req.user.id)
  ) {
    fail(res, 404, "Staff user not found");
    return null;
  }
  return { user, access };
};

/** PUT /api/staff-users/:id — details, category, pages/options, hotels, active flag. */
export const updateStaffUser = async (req, res) => {
  try {
    const found = await findManagedStaff(req, res);
    if (!found) return;
    const { user, access } = found;

    const updates = {};
    if (req.body.name !== undefined) {
      const name = trimOrNull(req.body.name);
      if (!name) return fail(res, 400, "Name is required");
      updates.name = name;
    }
    if (req.body.staff_category !== undefined) {
      const category = readCategory(req.body.staff_category);
      if (!category) return fail(res, 400, `Category must be ${STAFF_CATEGORIES.join(", ")}`);
      updates.staff_category = category;
    }
    if (req.body.email !== undefined) updates.email = trimOrNull(req.body.email);
    if (req.body.location !== undefined) updates.location = trimOrNull(req.body.location);
    if (req.body.is_active !== undefined) updates.is_active = Boolean(req.body.is_active);

    if (
      req.body.permissions !== undefined ||
      req.body.hotel_ids !== undefined ||
      req.body.all_hotels !== undefined
    ) {
      const granted = await readAccess(
        {
          permissions: req.body.permissions ?? user.permissions,
          all_hotels: req.body.all_hotels ?? user.hotel_ids === null,
          hotel_ids: req.body.hotel_ids ?? user.hotel_ids,
        },
        grantableOf(access),
      );
      if (granted.error) return fail(res, 400, granted.error);
      updates.permissions = granted.permissions;
      updates.hotel_ids = granted.hotelIds;
    }

    await user.update(updates);
    // Added from Cooks / Servers / Cleaners: keep that record in step.
    await syncRecordFromAccount(user);
    res.json({
      success: true,
      message: "Staff user updated",
      data: await RegisterUsersData.findByPk(user.id, { attributes: STAFF_ATTRIBUTES }),
    });
  } catch (error) {
    if (error.name === "SequelizeValidationError") return fail(res, 400, error.errors[0]?.message);
    console.error("Update staff user error:", error);
    fail(res, 500, "Internal server error");
  }
};

/** DELETE /api/staff-users/:id — removes staff access; the account stays as a guest. */
export const removeStaffUser = async (req, res) => {
  try {
    const found = await findManagedStaff(req, res);
    if (!found) return;
    await removeAccess(found.user, req.user.id);
    res.json({ success: true, message: "Staff access removed (see Inactive users)" });
  } catch (error) {
    console.error("Remove staff user error:", error);
    fail(res, 500, "Internal server error");
  }
};

/**
 * After an Admin's access shrinks, their Staff users keep only what the
 * Admin still has (a Staff user never has more than their Admin).
 */
export const trimStaffOf = async (admin) => {
  const grantable = grantableOf(accessOf(admin));
  const staff = await RegisterUsersData.findAll({
    where: { created_by: admin.id, role: { [Op.iLike]: ROLES.STAFF } },
  });
  for (const member of staff) {
    const own = accessOf(member);
    await member.update({
      permissions: intersectPermissions(own.permissions, grantable.permissions),
      hotel_ids: intersectHotelIds(own.hotelIds, grantable.hotelIds),
    });
  }
};

/** Removed users the caller may see / retrieve: SuperAdmin all; Admins their former Staff. */
const managesRemoved = (access, user, userId) => {
  if (access.isSuperAdmin) return true;
  const prev = user.previous_access || {};
  if (roleOf(prev.role) !== "staff") return false;
  return (
    Number(user.removed_by) === Number(userId) ||
    manages(access, { created_by: prev.created_by ?? null, hotel_ids: prev.hotel_ids ?? null }, userId)
  );
};

/**
 * GET /api/staff-users/removed — User Management → Inactive users: accounts
 * whose Staff / Admin access was removed, with what they had before.
 */
export const getRemovedUsers = async (req, res) => {
  try {
    const access = await loadAccess(req);
    const users = await RegisterUsersData.findAll({
      where: { removed_at: { [Op.ne]: null }, role: { [Op.iLike]: ROLES.USER } },
      attributes: [...STAFF_ATTRIBUTES, "removed_at", "removed_by", "previous_access"],
      order: [["removed_at", "DESC"]],
    });
    const visible = users
      .filter((user) => managesRemoved(access, user, req.user.id))
      // Show the hotels they had (for the Hotels / Location / Area columns).
      .map((user) => ({ ...user.toJSON(), hotel_ids: user.previous_access?.hotel_ids ?? null }));
    res.json({
      success: true,
      data: await withProfileDetails(visible),
      restore_as: access.isSuperAdmin ? ["staff", "admin"] : ["staff"],
    });
  } catch (error) {
    console.error("Get removed users error:", error);
    fail(res, 500, "Internal server error");
  }
};

/**
 * POST /api/staff-users/:id/restore { as: "staff" | "admin" } — gives a
 * removed account its access back. As Staff: their old category, job, pages
 * and hotels, limited to what the caller can grant. As Admin (SuperAdmin
 * only): an Admin with the pages and hotels they had.
 */
export const restoreUser = async (req, res) => {
  try {
    const access = await loadAccess(req);
    const as = req.body.as === "admin" ? "admin" : "staff";
    if (as === "admin" && !access.isSuperAdmin) {
      return fail(res, 403, "Only the Super Admin can retrieve a user as Admin");
    }
    const user = await RegisterUsersData.findByPk(req.params.id);
    if (
      !user ||
      !user.removed_at ||
      roleOf(user.role) !== ROLES.USER ||
      !managesRemoved(access, user, req.user.id)
    ) {
      return fail(res, 404, "Removed user not found");
    }

    const prev = user.previous_access || {};
    const wasStaff = roleOf(prev.role) === "staff";
    let values;
    if (as === "staff") {
      const grantable = grantableOf(access);
      values = {
        role: ROLES.STAFF,
        user_type_id: USER_TYPE.STAFF,
        staff_category: (wasStaff && readCategory(prev.staff_category)) || "Member",
        staff_type: wasStaff ? prev.staff_type ?? null : null,
        permissions: intersectPermissions(
          sanitizePermissions(prev.permissions, { forStaff: true }),
          grantable.permissions,
        ),
        hotel_ids: intersectHotelIds(sanitizeHotelIds(prev.hotel_ids), grantable.hotelIds),
        // An Admin who retrieves someone manages them from now on.
        created_by: access.isSuperAdmin ? prev.created_by ?? null : req.user.id,
      };
    } else {
      values = {
        role: ROLES.ADMIN,
        user_type_id: USER_TYPE.ADMIN,
        staff_category: null,
        staff_type: null,
        // A former Admin gets their old access back (null = full access).
        permissions: wasStaff ? sanitizePermissions(prev.permissions) : prev.permissions ?? null,
        hotel_ids: sanitizeHotelIds(prev.hotel_ids),
        created_by: null,
      };
    }

    await user.update({ ...values, is_active: true, ...NOT_REMOVED });
    // Back as Staff: their Cook / Server / Cleaner record is active again.
    if (as === "staff") await setRecordsActive(user, true);
    res.json({
      success: true,
      message: `${user.name || user.mobilenumber} is back as ${as === "admin" ? "Admin" : "Staff"}`,
    });
  } catch (error) {
    console.error("Restore user error:", error);
    fail(res, 500, "Internal server error");
  }
};
