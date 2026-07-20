import express from "express";
import {
  createMenuCategory,
  getMenuCategories,
  getMenuCategoryById,
  updateMenuCategory,
  deleteMenuCategory,
} from "../controllers/menuCategory.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Menu Categories
 *   description: Menu category management
 */

/**
 * @swagger
 * /api/menu-categories:
 *   post:
 *     summary: Create a menu category
 *     tags: [Menu Categories]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [hotel_id, category_name]
 *             properties:
 *               hotel_id:
 *                 type: integer
 *               category_name:
 *                 type: string
 *               description:
 *                 type: string
 *               display_order:
 *                 type: integer
 *               is_active:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Menu category created successfully
 */
router.post("/", authenticate, createMenuCategory);

/**
 * @swagger
 * /api/menu-categories:
 *   get:
 *     summary: Get menu categories
 *     tags: [Menu Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: hotel_id
 *         schema: { type: integer }
 *       - in: query
 *         name: is_active
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: Menu category list
 */
router.get("/", authenticate, getMenuCategories);

/**
 * @swagger
 * /api/menu-categories/{id}:
 *   get:
 *     summary: Get a menu category by ID
 *     tags: [Menu Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Menu category details
 */
router.get("/:id", authenticate, getMenuCategoryById);

/**
 * @swagger
 * /api/menu-categories/{id}:
 *   put:
 *     summary: Update a menu category
 *     tags: [Menu Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Menu category updated successfully
 */
router.put("/:id", authenticate, updateMenuCategory);

/**
 * @swagger
 * /api/menu-categories/{id}:
 *   delete:
 *     summary: Delete a menu category
 *     tags: [Menu Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Menu category deleted successfully
 */
router.delete("/:id", authenticate, deleteMenuCategory);

export default router;
