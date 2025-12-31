import express from "express";
import {
  createReservation,
  getReservationsByHotel,
  cancelReservationSeats,
  updateReservation
} from "../controllers/reservation.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Reservations
 *   description: Hotel table & seat reservations
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     SeatStatus:
 *       type: object
 *       properties:
 *         table_id:
 *           type: integer
 *           example: 0
 *         seat_ids:
 *           type: array
 *           items:
 *             type: integer
 *           example: []
 *
 *     ReservationCreate:
 *       type: object
 *       required:
 *         - hotel_id
 *         - floor_id
 *         - seat_status
 *         - customer_name
 *         - customer_mobile
 *         - reservation_date
 *         - reservation_time
 *       properties:
 *         hotel_id:
 *           type: integer
 *           example: 0
 *         floor_id:
 *           type: integer
 *           example: 0
 *         seat_status:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/SeatStatus'
 *         customer_name:
 *           type: string
 *           example: name
 *         customer_mobile:
 *           type: string
 *           example: "1234567891"
 *         reservation_date:
 *           type: string
 *           format: date
 *           example: 2025-12-30
 *         reservation_time:
 *           type: string
 *           format: time
 *           example: "13:01"
 *
 *     ReservationResponse:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         hotel_id:
 *           type: integer
 *         floor_id:
 *           type: integer
 *         booking_date:
 *           type: string
 *           format: date
 *         start_time:
 *           type: string
 *           format: time
 *         seat_status:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/SeatStatus'
 *         reservation_date:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/reservations:
 *   post:
 *     summary: Create a new reservation (multi-table & multi-seat)
 *     tags: [Reservations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ReservationCreate'
 *     responses:
 *       201:
 *         description: Reservation created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/ReservationResponse'
 *       400:
 *         description: Validation or seat conflict error
 *       500:
 *         description: Server error
 */
router.post("/", authenticate, createReservation);

/**
 * @swagger
 * /api/reservations/{reservationId}:
 *   put:
 *     summary: Cancel selected seats from a reservation (partial cancellation)
 *     description: >
 *       Cancels specific seats from an existing reservation without cancelling
 *       the reservation itself. Cancelled seats are marked as AVAILABLE.
 *     tags:
 *       - Reservations
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reservationId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 15
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - cancel_seats
 *             properties:
 *               cancel_seats:
 *                 type: array
 *                 description: List of tables and seats to cancel
 *                 items:
 *                   type: object
 *                   required:
 *                     - table_id
 *                     - seat_ids
 *                   properties:
 *                     table_id:
 *                       type: integer
 *                       example: 2
 *                     seat_ids:
 *                       type: array
 *                       items:
 *                         type: integer
 *                       example: [5, 7]
 *     responses:
 *       200:
 *         description: Seats cancelled successfully
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
 *                   example: Seats cancelled successfully
 *                 cancelled_seat_ids:
 *                   type: array
 *                   items:
 *                     type: integer
 *                   example: [7]
 *                 updated_seat_status:
 *                   type: array
 *                   example:
 *                     - table_id: 2
 *                       seat_ids: [5, 8]
 *       400:
 *         description: Invalid request or no matching seats
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Reservation not found
 *       500:
 *         description: Server error
 */
router.put("/:reservationId", authenticate, updateReservation);

/**
 * @swagger
 * /api/reservations/hotel/{hotelId}:
 *   get:
 *     summary: Get all reservations by hotel
 *     tags: [Reservations]
 *     parameters:
 *       - in: path
 *         name: hotelId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of reservations
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
 *                     $ref: '#/components/schemas/ReservationResponse'
 *       500:
 *         description: Server error
 */
router.get("/hotel/:hotelId", getReservationsByHotel);

/**
 * @swagger
 * /api/reservations/{id}/cancel:
 *   delete:
 *     summary: Cancel (delete) a reservation
 *     tags: [Reservations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Reservation cancelled successfully
 *       404:
 *         description: Reservation not found
 *       500:
 *         description: Server error
 */
router.delete("/:id/cancel", cancelReservationSeats);

export default router;
