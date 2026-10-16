import express from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizePermission } from "../middlewares/role.middleware.js";
import {
  createLocation,
  getAllLocations,
  updateLocation,
  deleteLocation,
  bulkAssignLocations,
} from "../controllers/location.controller.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Locations
 *   description: Location master data for hotels
 */

/**
 * @swagger
 * /api/locations:
 *   post:
 *     summary: Create a new location (Admin)
 *     tags: [Locations]
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
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Location created
 */
router.post("/", authenticate, authorizePermission("locations", "create"), createLocation);

/**
 * @swagger
 * /api/locations:
 *   get:
 *     summary: List locations
 *     tags: [Locations]
 *     responses:
 *       200:
 *         description: List of locations
 */
router.get("/", getAllLocations);

/**
 * @swagger
 * /api/locations/assign:
 *   post:
 *     summary: Bulk-assign location_id to hotels based on hotel.location string (Admin)
 *     tags: [Locations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Assignment results
 */
router.post("/assign", authenticate, authorizePermission("locations", "edit"), bulkAssignLocations);

/**
 * @swagger
 * /api/locations/{id}:
 *   put:
 *     summary: Update a location (Admin)
 *     tags: [Locations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string, example: "Chennai" }
 *               description: { type: string }
 *     responses:
 *       200: { description: Location updated }
 *   delete:
 *     summary: Delete a location no area or hotel uses (Admin)
 *     tags: [Locations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: Location deleted }
 *       409: { description: Areas or hotels still use it }
 */
router.put("/:id", authenticate, authorizePermission("locations", "edit"), updateLocation);
router.delete("/:id", authenticate, authorizePermission("locations", "delete"), deleteLocation);

export default router;
