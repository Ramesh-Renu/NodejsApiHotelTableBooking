import express from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import {
  createSideDish,
  getAllSideDishes,
  getSideDishById,
  updateSideDish,
  deleteSideDish,
} from "../controllers/menuSideDish.controller.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Menu Side Dishes
 *   description: Menu Side Dish Management APIs
 */

/**
 * @swagger
 * /api/menu-side-dishes:
 *   post:
 *     summary: Create a new side dish
 *     tags: [Menu Side Dishes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - side_dish_name
 *             properties:
 *               side_dish_name:
 *                 type: string
 *                 example: Sambar
 *               description:
 *                 type: string
 *                 example: South Indian Lentil Curry
 *               display_order:
 *                 type: integer
 *                 example: 1
 *               is_active:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       201:
 *         description: Side dish created successfully
 *       400:
 *         description: Validation error
 *       409:
 *         description: Side dish already exists
 *       500:
 *         description: Internal Server Error
 */
router.post("/", authenticate, createSideDish);

/**
 * @swagger
 * /api/menu-side-dishes:
 *   get:
 *     summary: Get all side dishes
 *     tags: [Menu Side Dishes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Side dishes fetched successfully
 *       500:
 *         description: Internal Server Error
 */
router.get("/", getAllSideDishes);

/**
 * @swagger
 * /api/menu-side-dishes/{id}:
 *   get:
 *     summary: Get side dish by ID
 *     tags: [Menu Side Dishes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: Side dish fetched successfully
 *       404:
 *         description: Side dish not found
 *       500:
 *         description: Internal Server Error
 */
router.get("/:id", getSideDishById);

/**
 * @swagger
 * /api/menu-side-dishes/{id}:
 *   put:
 *     summary: Update side dish
 *     tags: [Menu Side Dishes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               side_dish_name:
 *                 type: string
 *                 example: Rasam
 *               description:
 *                 type: string
 *                 example: Pepper Tomato Soup
 *               display_order:
 *                 type: integer
 *                 example: 2
 *               is_active:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Side dish updated successfully
 *       404:
 *         description: Side dish not found
 *       500:
 *         description: Internal Server Error
 */
router.put("/:id", authenticate, updateSideDish);

/**
 * @swagger
 * /api/menu-side-dishes/{id}:
 *   delete:
 *     summary: Delete side dish
 *     tags: [Menu Side Dishes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: Side dish deleted successfully
 *       404:
 *         description: Side dish not found
 *       500:
 *         description: Internal Server Error
 */
router.delete("/:id", authenticate, deleteSideDish);
export default router;