import { can, isStaffRole, isSuperAdmin, loadAccess, roleOf } from "../utils/permissions.js";

/** Allows the listed roles. A SuperAdmin always passes. */
export const authorizeRoles = (...roles) => {
  const allowed = roles.map(roleOf);
  return (req, res, next) => {
    if (isSuperAdmin(req.user?.role) || allowed.includes(roleOf(req.user?.role))) {
      return next();
    }
    return res.status(403).json({
      message: "Access denied",
    });
  };
};

export const authorizeSuperAdmin = authorizeRoles("SuperAdmin");

/**
 * Staff-only route: the session must be a SuperAdmin, or an active Admin / Staff user
 * granted `action` on `page` (see utils/permissions.js).
 */
export const authorizePermission = (page, action = "view") => async (req, res, next) => {
  try {
    if (!isStaffRole(req.user?.role)) {
      return res.status(403).json({ message: "Access denied" });
    }
    const access = await loadAccess(req);
    if (!access || !access.isActive) {
      return res.status(403).json({ message: "Your account is disabled" });
    }
    if (!can(access, page, action)) {
      return res.status(403).json({
        message: `You don't have permission to ${action} ${page}`,
      });
    }
    next();
  } catch (error) {
    console.error("Permission check error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Route shared by guests and staff (bookings, orders): guests pass through
 * (the controller limits them to their own data); staff need the permission.
 */
export const authorizeStaffPermission = (page, action = "view") => {
  const staffCheck = authorizePermission(page, action);
  return (req, res, next) =>
    isStaffRole(req.user?.role) ? staffCheck(req, res, next) : next();
};
