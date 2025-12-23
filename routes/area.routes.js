import express from "express";
import { createArea, getAllAreas } from "../controllers/area.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Areas
 *   description: Manage geographic or logical areas for hotels
 */

/**
 * @swagger
 * /api/areas:
 *   post:
 *     summary: Create a new area (Admin)
 *     tags: [Areas]
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
 *               location_id:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Area created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       409:
 *         description: Area already exists
 */
// Create area (admin)
router.post("/", authenticate, createArea);

/**
 * @swagger
 * /api/areas:
 *   get:
 *     summary: Get list of areas
 *     tags: [Areas]
 *     responses:
 *       200:
 *         description: List of areas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 */
// List areas
router.get("/", getAllAreas);

export default router;
