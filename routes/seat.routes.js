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
 * components:
 *   schemas:
 *     Seat:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 10
 *         table_id:
 *           type: integer
 *           example: 5
 *         seat_number:
 *           type: integer
 *           example: 1
 *         status:
 *           type: integer
 *           enum: [1, 2, 3, 4]
 *           description: |
 *             1 = BOOKED  
 *             2 = CANCEL  
 *             3 = CLEANING  
 *             4 = AVAILABLE
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
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
 *     description: Adds new seats to a table. Newly added seats are set to AVAILABLE.
 *     tags: [Seats]
 *     security:
 *       - bearerAuth: []
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
 */
router.post("/table/:tableId/add", authenticate, addSeatsToTable);

/**
 * @swagger
 * /api/seats/table/{tableId}/remove:
 *   delete:
 *     summary: Remove specific seats from a table
 *     description: Only AVAILABLE seats (status = 4) can be removed
 *     tags: [Seats]
 *     security:
 *       - bearerAuth: []
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
 *                 example: [925, 926]
 *     responses:
 *       200:
 *         description: Seats removed successfully
 *       400:
 *         description: Cannot remove non-available seats
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
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Seat'
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
 *               - status
 *             properties:
 *               status:
 *                 type: integer
 *                 enum: [1, 2, 3, 4]
 *                 example: 1
 *                 description: |
 *                   1 = BOOKED  
 *                   2 = CANCEL  
 *                   3 = CLEANING  
 *                   4 = AVAILABLE
 *     responses:
 *       200:
 *         description: Seat status updated successfully
 *       400:
 *         description: Invalid seat status
 *       404:
 *         description: Seat not found
 */
router.put("/:seatId", authenticate, updateSeatStatus);

export default router;
