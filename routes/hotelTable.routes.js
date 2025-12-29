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
 *     summary: Get all hotels with optional search and location filter
 *     tags: [HotelTables]
 *     description: |
 *       Returns a list of hotels with calculated counts.
 *     parameters:
 *       - in: query
 *         name: search
 *         required: false
 *         schema:
 *           type: string
 *         description: |
 *           Generic search term. Matches hotel name or location name.
 *         example: ""
 *     responses:
 *       200:
 *         description: Hotels fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       401:
 *         description: Unauthorized (authentication required)
 *
 *       500:
 *         description: Failed to fetch hotel tables
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
 *     summary: Update hotel details
 *     description: Update hotel basic information along with floor, table, and seat configuration.
 *     tags:
 *       - HotelTables
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *         description: Hotel ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - hotel_name
 *               - location_id
 *               - area_id
 *               - address
 *               - floor_per_hotel
 *               - tables_per_floor
 *               - chairs_per_table
 *             properties:
 *               hotel_name:
 *                 type: string
 *                 example: "Grand Palace"
 *               location_id:
 *                 type: integer
 *                 example: 1
 *               area_id:
 *                 type: integer
 *                 example: 5
 *               address:
 *                 type: string
 *                 example: "Grand Southern Trunk Rd, near MIT GATE"
 *               floor_per_hotel:
 *                 type: integer
 *                 example: 1
 *               tables_per_floor:
 *                 type: integer
 *                 example: 10
 *               chairs_per_table:
 *                 type: integer
 *                 example: 4
 *     responses:
 *       200:
 *         description: Hotel updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Hotel updated successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Hotel not found
 *       500:
 *         description: Server error
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
