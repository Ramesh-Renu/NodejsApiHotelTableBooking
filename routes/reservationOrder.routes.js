import express from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizePermission, authorizeStaffPermission } from "../middlewares/role.middleware.js";

import {
  createOrder,
  getOrders,
  getOrderById,
  getReservationOrders,
  updateOrder,
  updateOrderStatus,
  updateOrderItems,
  updatePaymentStatus,
  updateOrderItemStatus,
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
router.post("/reservation/:reservationId", authenticate, authorizeStaffPermission("orders", "create"), createOrder);
// Order from the menu without a table booking (body: hotel_id, items).
router.post("/", authenticate, authorizeStaffPermission("orders", "create"), createOrder);
router.get("/reservation/:reservationId", authenticate, getReservationOrders);
router.get("/", authenticate, getOrders);
router.get("/:id", authenticate, getOrderById);
router.put("/:id", authenticate, authorizeStaffPermission("orders", "edit"), updateOrder);
router.patch("/:id/status", authenticate, authorizeStaffPermission("orders", "edit"), updateOrderStatus);
router.put("/:id/items", authenticate, authorizePermission("orders", "edit"), updateOrderItems);
router.patch(
  "/:id/items/:itemId/status",
  authenticate,
  authorizePermission("orders", "edit"),
  updateOrderItemStatus,
);
router.patch("/:id/payment", authenticate, authorizeStaffPermission("orders", "edit"), updatePaymentStatus);
router.patch("/:id/cancel", authenticate, authorizeStaffPermission("orders", "delete"), cancelOrder);

export default router;
