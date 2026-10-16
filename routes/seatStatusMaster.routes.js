import express from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizePermission } from "../middlewares/role.middleware.js";
import { createStatusMasterUpdate } from "../utils/statusMasterController.js";
import SeatStatusMaster from "../models/seatStatusMaster.model.js";
import {
  createSeatStatus,
  getAllSeatStatuses,
} from "../controllers/seatStatusMaster.controller.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Seat Status Master
 *   description: Seat status master management
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     SeatStatusMaster:
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
 * /api/seat-status:
 *   post:
 *     summary: Create seat status
 *     tags: [Seat Status Master]
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
 *         description: Seat status created
 *       409:
 *         description: Duplicate status
 *       500:
 *         description: Server error
 */
router.post("/", authenticate, authorizePermission("seatStatus", "create"), createSeatStatus);

/**
 * @swagger
 * /api/seat-status:
 *   get:
 *     summary: Get all seat statuses
 *     tags: [Seat Status Master]
 *     responses:
 *       200:
 *         description: List of seat statuses
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/SeatStatusMaster'
 */
router.get("/", getAllSeatStatuses);

/**
 * @swagger
 * /api/seat-status/{id}:
 *   put:
 *     summary: Rename or recolour a Seat status (Admin). status_id can't change.
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
  authorizePermission("seatStatus", "edit"),
  createStatusMasterUpdate({ Model: SeatStatusMaster, label: "Seat status" }),
);

export default router;
