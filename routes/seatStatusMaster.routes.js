import express from "express";
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
 *         reservation_date:
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
router.post("/", createSeatStatus);

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

export default router;
