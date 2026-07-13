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

router.post("/reservation/:reservationId", authenticate, createOrder);
router.get("/", authenticate, getOrders);
router.get("/:id", authenticate, getOrderById);
router.get("/reservation/:reservationId", authenticate, getReservationOrders);
router.put("/:id", authenticate, updateOrder);
router.patch("/:id/status", authenticate, updateOrderStatus);
router.patch("/:id/payment", authenticate, updatePaymentStatus);
router.patch("/:id/cancel", authenticate, cancelOrder);

export default router;
