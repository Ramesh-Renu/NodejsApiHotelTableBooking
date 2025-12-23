import { authenticate } from "../middlewares/auth.middleware.js";
import express from "express";
import { body, validationResult } from "express-validator";
import {
  createHotelTable,
  getAllHotelTables,
  getHotelTableById,
  updateHotelTable,
  deleteHotelTable,
} from "../controllers/hotelTable.controller.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: HotelTables
 *   description: Hotel Table management
 */
/**
 * @swagger
 * /api/hotel:
 *   post:
 *     summary: Create hotel table details
 *     tags: [HotelTables]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - hotel_name
 *               - location
 *               - floor
 *               - tables_per_floor
 *               - chairs_per_table
 *               - area_id
 *             properties:
 *               hotel_name:
 *                 type: string
 *                 example: "string"
 *               location_id:
 *                 type: integer
 *                 example: 1
 *               address:
 *                 type: string
 *                 example: "string"
 *               floor:
 *                 type: integer
 *                 example: 1
 *               tables_per_floor:
 *                 type: integer
 *                 example: 1
 *               chairs_per_table:
 *                 type: integer
 *                 example: 2
 *               area_id:
 *                 type: integer
 *                 example: 1
 *     responses:
 *       201:
 *         description: Hotel table created successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 */

router.post(
  "/",
  authenticate,
  [
    body("hotel_name").notEmpty(),
    body("location_id").isInt({ min: 1 }).withMessage("location_id is required and must be a positive integer"),
    body("area_id").isInt({ min: 1 }).withMessage("area_id is required and must be a positive integer"),
    body("floor").isInt({ min: 1 }),
    body("tables_per_floor").isInt({ min: 1 }),
    body("chairs_per_table").isInt({ min: 1 }),
  ],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
    next();
  },
  createHotelTable
);
/**
 * @swagger
 * /api/hotel:
 *   get:
 *     summary: Get all hotel tables
 *     tags: [HotelTables]
 *     responses:
 *       200:
 *         description: Hotel table list fetched successfully
 */

router.get("/", authenticate, getAllHotelTables); // READ ALL
/**
 * @swagger
 * /api/hotel/{id}:
 *   get:
 *     summary: Get hotel table by ID
 *     tags: [HotelTables]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: Hotel table fetched successfully
 *       404:
 *         description: Hotel table not found
 */

router.get("/:id", authenticate, getHotelTableById); // READ ONE
/**
 * @swagger
 * /api/hotel/{id}:
 *   put:
 *     summary: Update hotel table details
 *     tags: [HotelTables]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *             properties:
 *               hotel_name:
 *                 type: string
 *                 example: "Grand Palace Updated"
 *               location_id:
 *                 type: integer
 *                 example: 1
 *               area_id:
 *               address:
 *                 type: string
 *                 example: "Block B"
 *               floor:
 *                 type: integer
 *                 example: 3
 *               tables_per_floor:
 *                 type: integer
 *                 example: 12
 *               chairs_per_table:
 *                 type: integer
 *                 example: 6
 *     responses:
 *       200:
 *         description: Hotel table updated successfully
 *       404:
 *         description: Hotel table not found
 *       401:
 *         description: Unauthorized
 */

router.put("/:id", authenticate, updateHotelTable); // UPDATE
/**
 * @swagger
 * /api/hotel/{id}:
 *   delete:
 *     summary: Delete hotel table
 *     tags: [HotelTables]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: Hotel table deleted successfully
 *       404:
 *         description: Hotel table not found
 *       401:
 *         description: Unauthorized
 */

router.delete("/:id", authenticate, deleteHotelTable); // DELETE

export default router;
