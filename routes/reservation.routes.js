import express from "express";
import {
  createReservation,
  getReservationsByHotel,
  cancelReservation,
} from "../controllers/reservation.controller.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Reservations
 *   description: Hotel table and seat reservations
 */

/**
 * @swagger
 * /api/reservations:
 *   post:
 *     summary: Create a new reservation
 *     tags: [Reservations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - hotel_id
 *               - customer_name
 *               - customer_mobile
 *               - reservation_date
 *               - reservation_time
 *               - guest_count
 *             properties:
 *               hotel_id:
 *                 type: string
 *               table_id:
 *                 type: string
 *               seat_id:
 *                 type: string
 *               customer_name:
 *                 type: string
 *               customer_mobile:
 *                 type: string
 *               reservation_date:
 *                 type: string
 *                 example: 2025-01-05
 *               reservation_time:
 *                 type: string
 *                 example: 19:30
 *               guest_count:
 *                 type: number
 *     responses:
 *       201:
 *         description: Reservation created
 */
router.post("/", createReservation);

/**
 * @swagger
 * /api/reservations/hotel/{hotelId}:
 *   get:
 *     summary: Get reservations by hotel
 *     tags: [Reservations]
 *     parameters:
 *       - in: path
 *         name: hotelId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of reservations
 */
router.get("/hotel/:hotelId", getReservationsByHotel);

/**
 * @swagger
 * /api/reservations/{id}/cancel:
 *   put:
 *     summary: Cancel a reservation
 *     tags: [Reservations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Reservation cancelled
 */
router.put("/:id/cancel", cancelReservation);

export default router;
