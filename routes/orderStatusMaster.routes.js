import express from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";
import { createStatusMasterUpdate } from "../utils/statusMasterController.js";
import OrderStatusMaster from "../models/orderStatusMaster.model.js";
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
router.post("/", authenticate, authorizeRoles("Admin"), createOrderStatus);

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
router.post("/seed", authenticate, authorizeRoles("Admin"), seedOrderStatuses);

/**
 * @swagger
 * /api/order-status/{id}:
 *   put:
 *     summary: Rename or recolour a Order status (Admin). status_id can't change.
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
  createStatusMasterUpdate({ Model: OrderStatusMaster, label: "Order status" }),
);

export default router;

