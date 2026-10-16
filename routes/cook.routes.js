import express from "express";
import {
  createCook,
  deleteCook,
  getCookById,
  getCooks,
  updateCook,
} from "../controllers/cook.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizePermission } from "../middlewares/role.middleware.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Cooks
 *     description: Kitchen staff assigned to orders when they are accepted
 */

/**
 * @swagger
 * /api/cooks:
 *   get:
 *     summary: List cooks
 *     tags: [Cooks]
 *     parameters:
 *       - in: query
 *         name: hotel_id
 *         schema: { type: integer }
 *         description: That hotel's cooks plus cooks for all hotels
 *       - in: query
 *         name: is_active
 *         schema: { type: boolean }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *   post:
 *     summary: Add a cook (Admin)
 *     tags: [Cooks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [cook_name]
 *             properties:
 *               cook_name: { type: string }
 *               speciality: { type: string }
 *               photo_url: { type: string }
 *               photo_file_id: { type: string }
 *               hotel_id: { type: integer, nullable: true }
 *               is_active: { type: boolean }
 */
router.get("/", authenticate, getCooks);
router.post("/", authenticate, authorizePermission("cooks", "create"), createCook);

/**
 * @swagger
 * /api/cooks/{id}:
 *   get:
 *     summary: Get a cook
 *     tags: [Cooks]
 *   put:
 *     summary: Update a cook (Admin)
 *     tags: [Cooks]
 *   delete:
 *     summary: Delete a cook with no orders (Admin)
 *     tags: [Cooks]
 */
router.get("/:id", authenticate, getCookById);
router.put("/:id", authenticate, authorizePermission("cooks", "edit"), updateCook);
router.delete("/:id", authenticate, authorizePermission("cooks", "delete"), deleteCook);

export default router;
