import express from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { createLocation, getAllLocations, bulkAssignLocations } from "../controllers/location.controller.js";

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
router.post("/", createLocation);

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
router.post("/assign", authenticate, bulkAssignLocations);

export default router;
