import express from "express";
import {
  createCleaner,
  deleteCleaner,
  getCleanerById,
  getCleaners,
  updateCleaner,
} from "../controllers/cleaner.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Cleaners
 *     description: Housekeeping staff assigned when a table goes to Cleaning
 */

/**
 * @swagger
 * /api/cleaners:
 *   get:
 *     summary: List cleaners
 *     tags: [Cleaners]
 *     parameters:
 *       - in: query
 *         name: hotel_id
 *         schema: { type: integer }
 *       - in: query
 *         name: is_active
 *         schema: { type: boolean }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *   post:
 *     summary: Add a cleaner (Admin)
 *     tags: [Cleaners]
 */
router.get("/", authenticate, getCleaners);
router.post("/", authenticate, authorizeRoles("Admin"), createCleaner);

/**
 * @swagger
 * /api/cleaners/{id}:
 *   get:
 *     summary: Get a cleaner
 *     tags: [Cleaners]
 *   put:
 *     summary: Update a cleaner (Admin)
 *     tags: [Cleaners]
 *   delete:
 *     summary: Delete a cleaner with no reservations (Admin)
 *     tags: [Cleaners]
 */
router.get("/:id", authenticate, getCleanerById);
router.put("/:id", authenticate, authorizeRoles("Admin"), updateCleaner);
router.delete("/:id", authenticate, authorizeRoles("Admin"), deleteCleaner);

export default router;
