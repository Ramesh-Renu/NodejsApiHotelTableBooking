import express from "express";
import {
  createDiningStatus,
  getAllDiningStatuses,
} from "../controllers/diningStatusMaster.controller.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Dining Status Master
 *   description: Dining status master management
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     DiningStatusMaster:
 *       type: object
 *       required:
 *         - status_id
 *         - name
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         status_id:
 *           type: integer
 *           example: 1
 *         name:
 *           type: string
 *           example: BOOKED
 *         dining_date:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/dining-status:
 *   post:
 *     summary: Create dining status
 *     tags: [Dining Status Master]
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
 *                 example: BOOKED
 *     responses:
 *       201:
 *         description: Dining status created
 *       409:
 *         description: Duplicate status
 *       500:
 *         description: Server error
 */
router.post("/", createDiningStatus);

/**
 * @swagger
 * /api/dining-status:
 *   get:
 *     summary: Get all dining statuses
 *     tags: [Dining Status Master]
 *     responses:
 *       200:
 *         description: List of dining statuses
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/DiningStatusMaster'
 */
router.get("/", getAllDiningStatuses);

export default router;
