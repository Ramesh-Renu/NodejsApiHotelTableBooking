import express from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizeRoles, authorizeSuperAdmin } from "../middlewares/role.middleware.js";
import {
  createAdminUser,
  getAdminUsers,
  getPermissionCatalog,
  removeAdminUser,
  updateAdminUser,
} from "../controllers/adminUser.controller.js";

const router = express.Router();

/**
 * @swagger
 * /api/admin/dashboard:
 *   get:
 *     summary: Admin dashboard
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/dashboard",
  authenticate,
  authorizeRoles("admin"),
  (req, res) => {
    res.json({
      message: "Welcome Admin",
      user: req.user,
    });
  }
);

/**
 * @swagger
 * /api/admin/permissions:
 *   get:
 *     summary: Pages and options a SuperAdmin can grant to an Admin
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
// Admins may read (Admin users is read-only for them); changes are SuperAdmin only.
router.get("/permissions", authenticate, authorizeRoles("Admin"), getPermissionCatalog);

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: List Admin and SuperAdmin users (Admins read-only; SuperAdmin manages)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *   post:
 *     summary: Create an Admin with page/option and hotel access (SuperAdmin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - mobilenumber
 *             properties:
 *               name:
 *                 type: string
 *               mobilenumber:
 *                 type: string
 *               email:
 *                 type: string
 *               location:
 *                 type: string
 *               permissions:
 *                 type: object
 *                 example: { "hotels": ["view", "edit"], "orders": ["view"] }
 *               all_hotels:
 *                 type: boolean
 *               hotel_ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *               is_active:
 *                 type: boolean
 */
router.get("/users", authenticate, authorizeRoles("Admin"), getAdminUsers);
router.post("/users", authenticate, authorizeSuperAdmin, createAdminUser);

/**
 * @swagger
 * /api/admin/users/{id}:
 *   put:
 *     summary: Update an Admin's details and access (SuperAdmin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *   delete:
 *     summary: Remove admin access (the account becomes a guest)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.put("/users/:id", authenticate, authorizeSuperAdmin, updateAdminUser);
router.delete("/users/:id", authenticate, authorizeSuperAdmin, removeAdminUser);

export default router;
