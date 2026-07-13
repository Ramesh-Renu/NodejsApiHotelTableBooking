import express from "express";
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
router.post("/", createPaymentStatus);

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
router.post("/seed", seedPaymentStatuses);

export default router;

