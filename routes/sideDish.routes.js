import express from "express";
import {
  createSideDish,
  getAllSideDishes,
  getSideDishById,
  updateSideDish,
  deleteSideDish,
} from "../controllers/sideDish.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Side Dishes
 *   description: Side Dish Management APIs
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     SideDish:
 *       type: object
 *       required:
 *         - hotel_id
 *         - category_id
 *         - side_dish_name
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         hotel_id:
 *           type: integer
 *           example: 1
 *         category_id:
 *           type: integer
 *           example: 2
 *         side_dish_name:
 *           type: string
 *           example: Chicken Gravy
 *         description:
 *           type: string
 *           example: Spicy chicken gravy
 *         price:
 *           type: number
 *           format: float
 *           example: 120
 *         display_order:
 *           type: integer
 *           example: 1
 *         is_active:
 *           type: boolean
 *           example: true
 */

/**
 * @swagger
 * /api/side-dishes:
 *   post:
 *     summary: Create a Side Dish
 *     tags: [Side Dishes]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SideDish'
 *     responses:
 *       201:
 *         description: Side dish created successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Hotel or Category not found
 *       409:
 *         description: Side dish already exists
 */
router.post("/", authenticate, createSideDish);

/**
 * @swagger
 * /api/side-dishes:
 *   get:
 *     summary: Get All Side Dishes
 *     tags: [Side Dishes]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         example: 10
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         example: gravy
 *       - in: query
 *         name: hotel_id
 *         schema:
 *           type: integer
 *         example: 1
 *       - in: query
 *         name: category_id
 *         schema:
 *           type: integer
 *         example: 2
 *       - in: query
 *         name: is_active
 *         schema:
 *           type: boolean
 *         example: true
 *     responses:
 *       200:
 *         description: Side dishes fetched successfully
 */
router.get("/",  getAllSideDishes);

/**
 * @swagger
 * /api/side-dishes/{id}:
 *   get:
 *     summary: Get Side Dish By ID
 *     tags: [Side Dishes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Side dish details
 *       404:
 *         description: Side dish not found
 */
router.get("/:id", getSideDishById);

/**
 * @swagger
 * /api/side-dishes/{id}:
 *   put:
 *     summary: Update Side Dish
 *     tags: [Side Dishes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SideDish'
 *     responses:
 *       200:
 *         description: Side dish updated successfully
 *       404:
 *         description: Side dish not found
 */
router.put("/:id", authenticate, updateSideDish);

/**
 * @swagger
 * /api/side-dishes/{id}:
 *   delete:
 *     summary: Delete Side Dish
 *     tags: [Side Dishes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Side dish deleted successfully
 *       404:
 *         description: Side dish not found
 */
router.delete("/:id", authenticate, deleteSideDish);

export default router;