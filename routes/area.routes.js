import express from "express";
import {
  createArea,
  getAllAreas,
  updateArea,
  deleteArea,
} from "../controllers/area.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";

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
router.post("/", authenticate, authorizeRoles("Admin"), createArea);

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

/**
 * @swagger
 * /api/areas/{id}:
 *   put:
 *     summary: Update an area (Admin)
 *     tags: [Areas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string, example: "T Nagar" }
 *               description: { type: string }
 *               location_id: { type: integer, example: 1 }
 *     responses:
 *       200: { description: Area updated }
 *       409: { description: Another area has this name }
 *   delete:
 *     summary: Delete an area that no hotel uses (Admin)
 *     tags: [Areas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Area deleted }
 *       409: { description: Hotels still use this area }
 */
router.put("/:id", authenticate, authorizeRoles("Admin"), updateArea);
router.delete("/:id", authenticate, authorizeRoles("Admin"), deleteArea);

export default router;
