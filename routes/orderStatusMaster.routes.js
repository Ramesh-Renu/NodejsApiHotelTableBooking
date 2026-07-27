import express from "express";
import {
  createOrderStatus,
  getAllOrderStatuses,
  seedOrderStatuses,
} from "../controllers/orderStatusMaster.controller.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Order Status Master
 *   description: Order status master management
 */

/**
 * @swagger
 * /api/order-status:
 *   get:
 *     summary: Get all order statuses
 *     tags: [Order Status Master]
 *     responses:
 *       200:
 *         description: List of order statuses
 */
router.get("/", getAllOrderStatuses);

/**
 * @swagger
 * /api/order-status:
 *   post:
 *     summary: Create order status
 *     tags: [Order Status Master]
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
 *                 example: 1
 *               name:
 *                 type: string
 *                 example: ORDERED
 *               color_code:
 *                 type: string
 *                 example: "#000000"
 *     responses:
 *       201:
 *         description: Order status created
 */
router.post("/", createOrderStatus);

/**
 * @swagger
 * /api/order-status/seed:
 *   post:
 *     summary: Seed default order statuses
 *     tags: [Order Status Master]
 *     responses:
 *       200:
 *         description: Order statuses seeded
 */
router.post("/seed", seedOrderStatuses);

export default router;

