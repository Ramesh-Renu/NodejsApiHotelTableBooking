import express from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";
import { createStatusMasterUpdate } from "../utils/statusMasterController.js";
import PaymentStatusMaster from "../models/paymentStatusMaster.model.js";
import {
  createPaymentStatus,
  getAllPaymentStatuses,
  seedPaymentStatuses,
} from "../controllers/paymentStatusMaster.controller.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Payment Status Master
 *   description: Payment status master management
 */

/**
 * @swagger
 * /api/payment-status:
 *   get:
 *     summary: Get all payment statuses
 *     tags: [Payment Status Master]
 *     responses:
 *       200:
 *         description: List of payment statuses
 */
router.get("/", getAllPaymentStatuses);

/**
 * @swagger
 * /api/payment-status:
 *   post:
 *     summary: Create payment status
 *     tags: [Payment Status Master]
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
 *                 example: 0
 *               name:
 *                 type: string
 *                 example: PENDING
 *               color_code:
 *                 type: string
 *                 example: "#000000"
 *     responses:
 *       201:
 *         description: Payment status created
 */
router.post("/", authenticate, authorizeRoles("Admin"), createPaymentStatus);

/**
 * @swagger
 * /api/payment-status/seed:
 *   post:
 *     summary: Seed default payment statuses
 *     tags: [Payment Status Master]
 *     responses:
 *       200:
 *         description: Payment statuses seeded
 */
router.post("/seed", authenticate, authorizeRoles("Admin"), seedPaymentStatuses);

/**
 * @swagger
 * /api/payment-status/{id}:
 *   put:
 *     summary: Rename or recolour a Payment status (Admin). status_id can't change.
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
  authorizeRoles("Admin"),
  createStatusMasterUpdate({ Model: PaymentStatusMaster, label: "Payment status" }),
);

export default router;

