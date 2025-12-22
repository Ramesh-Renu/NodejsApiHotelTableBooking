import express from "express";
import {
  createFloor,
  getFloorsByHotel,
  deleteFloor,
} from "../controllers/floor.controller.js";

import { authenticate } from "../middlewares/auth.middleware.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Floors
 *   description: Floor management under a hotel
 */

/**
 * @swagger
 * /api/floors/hotel/{hotelTableId}:
 *   post:
 *     summary: Create a floor for a hotel (Admin)
 *     tags: [Floors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: hotelTableId
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - floor_number
 *             properties:
 *               floor_number:
 *                 type: integer
 *                 example: 2
 *     responses:
 *       201:
 *         description: Floor created successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Hotel not found
 */
router.post("/hotel/:hotelTableId", authenticate, createFloor);

/**
 * @swagger
 * /api/floors/hotel/{hotelTableId}:
 *   get:
 *     summary: Get all floors of a hotel (User/Admin)
 *     tags: [Floors]
 *     parameters:
 *       - in: path
 *         name: hotelTableId
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: Floors fetched successfully
 */
router.get("/hotel/:hotelTableId", getFloorsByHotel);

/**
 * @swagger
 * /api/floors/{floorId}:
 *   delete:
 *     summary: Delete a floor (Admin)
 *     tags: [Floors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: floorId
 *         required: true
 *         schema:
 *           type: integer
 *           example: 3
 *     responses:
 *       200:
 *         description: Floor deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Floor not found
 */
router.delete("/:floorId", authenticate, deleteFloor);

export default router;
