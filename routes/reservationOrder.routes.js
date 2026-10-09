import express from "express";
import { authenticate } from "../middlewares/auth.middleware.js";

import {
  createOrder,
  getOrders,
  getOrderById,
  getReservationOrders,
  updateOrder,
  updateOrderStatus,
  updatePaymentStatus,
  cancelOrder,
} from "../controllers/reservationOrder.controller.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Reservation Orders
 *   description: Order management for reservations
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     ReservationOrderItemInput:
 *       type: object
 *       required:
 *         - menu_id
 *         - quantity
 *       properties:
 *         menu_id:
 *           type: integer
 *           example: 1
 *         quantity:
 *           type: integer
 *           example: 2
 *         notes:
 *           type: string
 *           example: "Less spicy"
 *
 *     ReservationOrderCreate:
 *       type: object
 *       required:
 *         - items
 *       properties:
 *         hotel_id:
 *           type: integer
 *           example: 1
 *         notes:
 *           type: string
 *           example: "Serve hot"
 *         items:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ReservationOrderItemInput'
 */

/**
 * @swagger
 * /api/orders/reservation/{reservationId}:
 *   post:
 *     summary: Create an order for a reservation
 *     tags: [Reservation Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reservationId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Reservation ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ReservationOrderCreate'
 *     responses:
 *       201:
 *         description: Order created successfully
 *       400:
 *         description: Invalid request or missing order items
 *       404:
 *         description: Reservation not found
 *       500:
 *         description: Server error
 */
router.post("/reservation/:reservationId", authenticate, createOrder);
router.get("/reservation/:reservationId", authenticate, getReservationOrders);
router.get("/", authenticate, getOrders);
router.get("/:id", authenticate, getOrderById);
router.put("/:id", authenticate, updateOrder);
router.patch("/:id/status", authenticate, updateOrderStatus);
router.patch("/:id/payment", authenticate, updatePaymentStatus);
router.patch("/:id/cancel", authenticate, cancelOrder);

export default router;
