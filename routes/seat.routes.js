import express from "express";
import {
  createSeatsForTable,
  getSeatsByTable,
  updateSeatStatus,
} from "../controllers/seat.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Seats
 *   description: Seat management and availability
 */

/**
 * @swagger
 * /api/seats/table/{tableId}:
 *   post:
 *     summary: Auto-create seats for a table (Admin)
 *     tags: [Seats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tableId
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - seatCount
 *             properties:
 *               seatCount:
 *                 type: integer
 *                 example: 4
 *     responses:
 *       201:
 *         description: Seats created successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Table not found
 */
router.post("/table/:tableId", authenticate, createSeatsForTable);

/**
 * @swagger
 * /api/seats/table/{tableId}:
 *   get:
 *     summary: Get all seats for a table (User/Admin)
 *     tags: [Seats]
 *     parameters:
 *       - in: path
 *         name: tableId
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: Seats fetched successfully
 *       404:
 *         description: Table not found
 */
router.get("/table/:tableId", getSeatsByTable);

/**
 * @swagger
 * /api/seats/{seatId}:
 *   put:
 *     summary: Update seat status (Admin / Booking logic)
 *     tags: [Seats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: seatId
 *         required: true
 *         schema:
 *           type: integer
 *           example: 10
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - is_booked
 *             properties:
 *               is_booked:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Seat status updated successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Seat not found
 */
router.put("/:seatId", authenticate, updateSeatStatus);

export default router;
