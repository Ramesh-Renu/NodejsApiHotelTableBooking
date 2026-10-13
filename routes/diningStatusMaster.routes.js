import express from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";
import { createStatusMasterUpdate } from "../utils/statusMasterController.js";
import DiningStatusMaster from "../models/diningStatusMaster.model.js";
import {
  createDiningStatus,
  getAllDiningStatuses,
} from "../controllers/diningStatusMaster.controller.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Dining Status Master
 *   description: Dining status master management
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     DiningStatusMaster:
 *       type: object
 *       required:
 *         - status_id
 *         - name
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         status_id:
 *           type: integer
 *           example: 1
 *         name:
 *           type: string
 *           example: BOOKED
 *         dining_date:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/dining-status:
 *   post:
 *     summary: Create dining status
 *     tags: [Dining Status Master]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status_id
 *               - name
 *             properties:
 *               status_id:
 *                 type: integer
 *                 example: 1
 *               name:
 *                 type: string
 *                 example: BOOKED
 *     responses:
 *       201:
 *         description: Dining status created
 *       409:
 *         description: Duplicate status
 *       500:
 *         description: Server error
 */
router.post("/", authenticate, authorizeRoles("Admin"), createDiningStatus);

/**
 * @swagger
 * /api/dining-status:
 *   get:
 *     summary: Get all dining statuses
 *     tags: [Dining Status Master]
 *     responses:
 *       200:
 *         description: List of dining statuses
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/DiningStatusMaster'
 */
router.get("/", getAllDiningStatuses);

/**
 * @swagger
 * /api/dining-status/{id}:
 *   put:
 *     summary: Rename or recolour a Dining status (Admin). status_id can't change.
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
 *               name: { type: string, example: "Food prepared" }
 *               color_code: { type: string, example: "#14B8A6" }
 *     responses:
 *       200: { description: Updated }
 */
router.put(
  "/:id",
  authenticate,
  authorizeRoles("Admin"),
  createStatusMasterUpdate({ Model: DiningStatusMaster, label: "Dining status" }),
);

export default router;
