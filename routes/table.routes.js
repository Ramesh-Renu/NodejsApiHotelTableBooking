import express from "express";
import { body, param, validationResult } from "express-validator";
import {
  createTablesForHotel,
  getTablesByHotel,
  deleteTable,
} from "../controllers/table.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";

const router = express.Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

/**
 * @swagger
 * tags:
 *   name: Tables
 *   description: Table management under a hotel
 */

/**
 * @swagger
 * /api/tables/hotel/{hotelTableId}:
 *   post:
 *     summary: Create tables for a hotel (Admin)
 *     tags: [Tables]
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
 *               - tableCount
 *             properties:
 *               tableCount:
 *                 type: integer
 *                 example: 10
 *     responses:
 *       201:
 *         description: Tables created successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Hotel not found
 */
router
  .route("/hotel/:hotelTableId")
  .post(
    authenticate,
    authorizeRoles("Admin"),
    [param("hotelTableId").isInt().withMessage("hotelTableId must be an integer"), body("tableCount").isInt({ gt: 0 }).withMessage("tableCount must be an integer greater than 0")],
    validate,
    createTablesForHotel
  );

/**
 * @swagger
 * /api/tables/hotel/{hotelTableId}:
 *   get:
 *     summary: Get all tables for a hotel (User/Admin)
 *     tags: [Tables]
 *     parameters:
 *       - in: path
 *         name: hotelTableId
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: Tables fetched successfully
 *       404:
 *         description: Hotel not found
 */
router.get(
  "/hotel/:hotelTableId",
  [param("hotelTableId").isInt().withMessage("hotelTableId must be an integer")],
  validate,
  getTablesByHotel
);

/**
 * @swagger
 * /api/tables/{tableId}:
 *   delete:
 *     summary: Delete a table (Admin)
 *     tags: [Tables]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tableId
 *         required: true
 *         schema:
 *           type: integer
 *           example: 5
 *     responses:
 *       200:
 *         description: Table deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Table not found
 */
router.delete(
  "/:tableId",
  authenticate,
  authorizeRoles("Admin"),
  [param("tableId").isInt().withMessage("tableId must be an integer")],
  validate,
  deleteTable
);

export default router;
