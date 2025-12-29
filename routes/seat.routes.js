import express from "express";
import {
  createSeatsForTable,
  getSeatsByTable,
  updateSeatStatus,
  addSeatsToTable,
  removeSeatsFromTable,
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
 * /api/seats/multiple/table/{tableId}:
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
 */
router.post("/multiple/table/:tableId", authenticate, createSeatsForTable);

/**
 * @swagger
 * /api/seats/table/{tableId}/add:
 *   post:
 *     summary: Add seats to a table
 *     description: Adds new seats to a table. Seat numbers start from 1 for each table.
 *     tags:
 *       - Seats
 *     parameters:
 *       - in: path
 *         name: tableId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Table ID
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
 *                 example: 2
 *     responses:
 *       201:
 *         description: Seats added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Seats added successfully
 *                 seats:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       seat_id:
 *                         type: integer
 *                         example: 925
 *                       seat_number:
 *                         type: integer
 *                         example: 1
 *                       is_booked:
 *                         type: boolean
 *                         example: false
 *       400:
 *         description: Invalid seat count
 *       404:
 *         description: Table not found
 *       500:
 *         description: Server error
 */

router.post("/table/:tableId/add", authenticate, addSeatsToTable);

/**
 * @swagger
 * /api/seats/table/{tableId}/remove:
 *   delete:
 *     summary: Remove specific seats from a table
 *     description: Remove seats from a table using an array of seat IDs. Booked seats cannot be removed.
 *     tags:
 *       - Seats
 *     parameters:
 *       - in: path
 *         name: tableId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Table ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - seatIds
 *             properties:
 *               seatIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 example: [925, 265]
 *     responses:
 *       200:
 *         description: Seats removed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Seats removed successfully
 *                 removedSeatIds:
 *                   type: array
 *                   items:
 *                     type: integer
 *                   example: [925, 265]
 *       400:
 *         description: Invalid request or booked seats
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Cannot remove booked seats
 *                 bookedSeatIds:
 *                   type: array
 *                   items:
 *                     type: integer
 *                   example: [925]
 *       404:
 *         description: Table not found
 *       500:
 *         description: Server error
 */

router.delete("/table/:tableId/remove", authenticate, removeSeatsFromTable);

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
 */
router.put("/:seatId", authenticate, updateSeatStatus);

export default router;
