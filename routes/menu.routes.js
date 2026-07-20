// routes/menu.routes.js

import express from "express";
import {
  createMenu,
  getMenus,
  getMenuById,
  updateMenu,
  deleteMenu,
  updateMenuAvailability,
} from "../controllers/menu.controller.js";
import upload from "../middlewares/upload.middleware.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Menu
 *   description: Restaurant Menu Management
 */

/**
 * @swagger
 * /api/menu:
 *   post:
 *     summary: Create Menu
 *     tags: [Menu]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - hotel_id
 *               - category_id
 *               - menu_name
 *               - price
 *             properties:
 *               hotel_id:
 *                 type: integer
 *               category_id:
 *                 type: integer
 *               menu_name:
 *                 type: string
 *               menu_code:
 *                 type: string
 *               description:
 *                 type: string
 *               image:
 *                 type: string
 *               price:
 *                 type: number
 *               preparation_time:
 *                 type: integer
 *               is_veg:
 *                 type: boolean
 *               spice_level:
 *                 type: integer
 *                 description: Spice level master ID
 *                 example: 1
 *               calories:
 *                 type: integer
 *               is_available:
 *                 type: boolean
 *               display_order:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Menu created successfully
 */
router.post("/", authenticate, upload.single("image"), createMenu);

/**
 * @swagger
 * /api/menu:
 *   get:
 *     summary: Get All Menus
 *     tags: [Menu]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: hotel_id
 *         schema:
 *           type: integer
 *       - in: query
 *         name: category_id
 *         schema:
 *           type: integer
 *       - in: query
 *         name: is_available
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: is_veg
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Menu list
 */
router.get("/", authenticate, getMenus);

/**
 * @swagger
 * /api/menu/{id}:
 *   get:
 *     summary: Get Menu By Id
 *     tags: [Menu]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Menu Details
 */
router.get("/:id", authenticate, getMenuById);

/**
 * @swagger
 * /api/menu/{id}:
 *   put:
 *     summary: Update Menu
 *     tags: [Menu]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *     responses:
 *       200:
 *         description: Menu updated
 */
router.put("/:id", authenticate, updateMenu);

/**
 * @swagger
 * /api/menu/{id}:
 *   delete:
 *     summary: Delete Menu
 *     tags: [Menu]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Menu deleted
 */
router.delete("/:id", authenticate, deleteMenu);

/**
 * @swagger
 * /api/menu/{id}/availability:
 *   patch:
 *     summary: Toggle Menu Availability
 *     tags: [Menu]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Availability updated
 */
router.patch(
  "/:id/availability",
  authenticate,
  updateMenuAvailability
);

export default router;
