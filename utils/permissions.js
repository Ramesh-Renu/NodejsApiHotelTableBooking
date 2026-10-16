import RegisterUsersData from "../models/user.model.js";

/**
 * Who is who:
 *   SuperAdmin  everything; creates Admins (pages, options, hotels)
 *   Admin       what a SuperAdmin granted; creates Staff users
 *   Staff       hotel workers (Manager / Lead / Member) with what their
 *               Admin granted, never more than that Admin has
 *   user        guests (customers)
 */
export const ROLES = {
  SUPER_ADMIN: "SuperAdmin",
  ADMIN: "Admin",
  STAFF: "Staff",
  USER: "user",
};

// user_type_id per role (the reservation/dashboard code treats
// STAFF_USER_TYPES as staff).
export const USER_TYPE = {
  SUPER_ADMIN: 0,
  ADMIN: 1,
  USER: 2,
  STAFF: 3,
};
export const STAFF_USER_TYPES = [USER_TYPE.SUPER_ADMIN, USER_TYPE.ADMIN, USER_TYPE.STAFF];

export const STAFF_CATEGORIES = ["Manager", "Lead", "Member"];

export const ACTIONS = ["view", "create", "edit", "delete"];

/**
 * Pages and the options (actions) that can be granted. The PWA reads this
 * list to build the access forms, so a new page only needs adding here and
 * in the PWA's route/sidebar. `adminOnly` pages are never given to Staff.
 */
export const PERMISSION_CATALOG = [
  { key: "dashboard", label: "Dashboard", group: "Main", actions: ["view"] },
  { key: "hotels", label: "Hotels", group: "Main", actions: ACTIONS },
  { key: "reservations", label: "Reservations", group: "Main", actions: ACTIONS },
  { key: "orders", label: "Orders", group: "Main", actions: ACTIONS },
  { key: "menu", label: "Hotel menu items", group: "Main", actions: ACTIONS },
  { key: "users", label: "Staff users", group: "Team", actions: ACTIONS, adminOnly: true },
  { key: "menuCategories", label: "Menu categories", group: "Settings", actions: ACTIONS },
  { key: "cooks", label: "Cooks", group: "Settings", actions: ACTIONS },
  { key: "servers", label: "Servers", group: "Settings", actions: ACTIONS },
  { key: "cleaners", label: "Cleaners", group: "Settings", actions: ACTIONS },
  { key: "locations", label: "Locations", group: "Settings", actions: ACTIONS },
  { key: "areas", label: "Areas", group: "Settings", actions: ACTIONS },
  { key: "spiceLevels", label: "Spice levels", group: "Settings", actions: ACTIONS },
  { key: "diningStatus", label: "Dining status", group: "Settings", actions: ACTIONS },
  { key: "orderStatus", label: "Order status", group: "Settings", actions: ACTIONS },
  { key: "paymentStatus", label: "Payment status", group: "Settings", actions: ACTIONS },
  { key: "seatStatus", label: "Seat status", group: "Settings", actions: ACTIONS },
];

const CATALOG_BY_KEY = Object.fromEntries(PERMISSION_CATALOG.map((p) => [p.key, p]));

export const roleOf = (role) => String(role || "").toLowerCase();
export const isSuperAdmin = (role) => roleOf(role) === "superadmin";
export const isStaffMember = (role) => roleOf(role) === "staff";
/** SuperAdmin, Admin or Staff: a restaurant (not guest) session. */
export const isStaffRole = (role) => ["admin", "superadmin", "staff"].includes(roleOf(role));

/**
 * Keeps only known pages/actions. Any granted option implies "view" (no
 * editing a page you can't open). `forStaff` drops admin-only pages.
 */
export const sanitizePermissions = (input, { forStaff = false } = {}) => {
  if (!input || typeof input !== "object") return {};
  const result = {};
  for (const [page, actions] of Object.entries(input)) {
    const entry = CATALOG_BY_KEY[page];
    if (!entry || (forStaff && entry.adminOnly) || !Array.isArray(actions)) continue;
    const allowed = actions.filter((a) => entry.actions.includes(a));
    if (!allowed.length) continue;
    if (!allowed.includes("view")) allowed.unshift("view");
    result[page] = [...new Set(allowed)];
  }
  return result;
};

export const sanitizeHotelIds = (input) => {
  if (input === null || input === undefined) return null; // all hotels
  if (!Array.isArray(input)) return [];
  return [...new Set(input.map(Number).filter((id) => Number.isInteger(id) && id > 0))];
};

export const fullPermissions = () =>
  Object.fromEntries(PERMISSION_CATALOG.map((p) => [p.key, [...p.actions]]));

/** Only the pages/options present in both. */
export const intersectPermissions = (wanted, allowed) => {
  const result = {};
  for (const [page, actions] of Object.entries(wanted || {})) {
    const kept = actions.filter((a) => allowed?.[page]?.includes(a));
    if (kept.length) result[page] = kept;
  }
  return result;
};

/** Hotels in `wanted` that `allowed` (null = all) covers; null stays null only if allowed is null. */
export const intersectHotelIds = (wanted, allowed) => {
  if (allowed === null) return wanted;
  if (wanted === null) return [...allowed];
  return wanted.filter((id) => allowed.includes(id));
};

/**
 * The effective access of a user row: SuperAdmin and legacy Admins
 * (permissions null) get everything; Staff get only what was granted.
 * hotel_ids null means all hotels.
 */
export const accessOf = (user) => {
  if (!user) return null;
  const superAdmin = isSuperAdmin(user.role);
  const staff = isStaffMember(user.role);
  let permissions;
  if (superAdmin || (!staff && user.permissions == null)) permissions = fullPermissions();
  else permissions = sanitizePermissions(user.permissions, { forStaff: staff });
  return {
    id: user.id,
    role: user.role,
    isSuperAdmin: superAdmin,
    isActive: user.is_active !== false,
    permissions,
    hotelIds: superAdmin ? null : sanitizeHotelIds(user.hotel_ids),
  };
};

export const can = (access, page, action = "view") =>
  Boolean(access?.isSuperAdmin || access?.permissions?.[page]?.includes(action));

/**
 * Loads (once per request) the signed-in staff user's access from the DB, so
 * changes made to it apply on the next request, not at next login.
 * Returns null for guests.
 */
export const loadAccess = async (req) => {
  if (req.access !== undefined) return req.access;
  req.access = null;
  if (req.user?.id && isStaffRole(req.user.role)) {
    const user = await RegisterUsersData.findByPk(req.user.id, {
      attributes: ["id", "role", "permissions", "hotel_ids", "is_active"],
    });
    // The session role decides (an Admin signed in as Guest is a guest).
    req.access = user ? accessOf({ ...user.toJSON(), role: req.user.role }) : null;
  }
  return req.access;
};

/** Hotel ids the staff session may see, or null for all hotels. */
export const allowedHotelIds = async (req) => {
  const access = await loadAccess(req);
  return access ? access.hotelIds : null;
};

export const canAccessHotel = async (req, hotelId) => {
  const ids = await allowedHotelIds(req);
  return ids === null || ids.includes(Number(hotelId));
};
