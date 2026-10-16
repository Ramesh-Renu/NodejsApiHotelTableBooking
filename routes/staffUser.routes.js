import express from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizePermission } from "../middlewares/role.middleware.js";
import {
  createStaffUser,
  getStaffPermissionCatalog,
  getRemovedUsers,
  getStaffUsers,
  removeStaffUser,
  restoreUser,
  updateStaffUser,
} from "../controllers/staffUser.controller.js";

const router = express.Router();

/**
 * @swagger
 * /api/staff-users/permissions:
 *   get:
 *     summary: Pages, options and hotels the signed-in Admin can give to Staff users
 *     tags: [Staff users]
 *     security:
 *       - bearerAuth: []
 */
router.get("/permissions", authenticate, authorizePermission("users", "view"), getStaffPermissionCatalog);

/**
 * @swagger
 * /api/staff-users:
 *   get:
 *     summary: List the Admin's Staff users (SuperAdmin sees all)
 *     tags: [Staff users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [Manager, Lead, Member]
 *   post:
 *     summary: Create a Staff user (Manager, Lead or Member) with pages, options and hotels
 *     tags: [Staff users]
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
 *               - staff_category
 *             properties:
 *               name:
 *                 type: string
 *               mobilenumber:
 *                 type: string
 *               staff_category:
 *                 type: string
 *                 enum: [Manager, Lead, Member]
 *               email:
 *                 type: string
 *               location:
 *                 type: string
 *               permissions:
 *                 type: object
 *                 example: { "orders": ["view", "edit"] }
 *               all_hotels:
 *                 type: boolean
 *               hotel_ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *               is_active:
 *                 type: boolean
 */
/**
 * @swagger
 * /api/staff-users/removed:
 *   get:
 *     summary: Inactive users — accounts whose Staff / Admin access was removed
 *     tags: [Staff users]
 *     security:
 *       - bearerAuth: []
 */
router.get("/removed", authenticate, authorizePermission("users", "view"), getRemovedUsers);

/**
 * @swagger
 * /api/staff-users/{id}/restore:
 *   post:
 *     summary: Retrieve a removed user as Staff (Admin / SuperAdmin) or Admin (SuperAdmin)
 *     tags: [Staff users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               as:
 *                 type: string
 *                 enum: [staff, admin]
 */
router.post("/:id/restore", authenticate, authorizePermission("users", "create"), restoreUser);

router.get("/", authenticate, authorizePermission("users", "view"), getStaffUsers);
router.post("/", authenticate, authorizePermission("users", "create"), createStaffUser);

/**
 * @swagger
 * /api/staff-users/{id}:
 *   put:
 *     summary: Update a Staff user's details, category and access
 *     tags: [Staff users]
 *     security:
 *       - bearerAuth: []
 *   delete:
 *     summary: Remove staff access (the account becomes a guest)
 *     tags: [Staff users]
 *     security:
 *       - bearerAuth: []
 */
router.put("/:id", authenticate, authorizePermission("users", "edit"), updateStaffUser);
router.delete("/:id", authenticate, authorizePermission("users", "delete"), removeStaffUser);

export default router;
