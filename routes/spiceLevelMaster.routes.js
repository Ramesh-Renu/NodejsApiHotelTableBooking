import express from "express";
import {
  createSpiceLevel,
  getSpiceLevels,
  getSpiceLevelById,
  updateSpiceLevel,
  deleteSpiceLevel,
  seedSpiceLevels,
} from "../controllers/spiceLevelMaster.controller.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Spice Level Master
 *   description: Spice level master management
 */

/**
 * @swagger
 * /api/spice-levels:
 *   post:
 *     summary: Create a spice level
 *     tags: [Spice Level Master]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [spice_level]
 *             properties:
 *               spice_level:
 *                 type: string
 *                 example: MILD
 *               description:
 *                 type: string
 *               display_order:
 *                 type: integer
 *               is_active:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Spice level created successfully
 */
router.post("/", createSpiceLevel);

/**
 * @swagger
 * /api/spice-levels:
 *   get:
 *     summary: Get spice levels
 *     tags: [Spice Level Master]
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
 *         name: is_active
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: Spice level list
 */
router.get("/", getSpiceLevels);

/**
 * @swagger
 * /api/spice-levels/seed:
 *   post:
 *     summary: Seed default spice levels
 *     tags: [Spice Level Master]
 *     responses:
 *       200:
 *         description: Spice levels seeded successfully
 */
router.post("/seed", seedSpiceLevels);

/**
 * @swagger
 * /api/spice-levels/{id}:
 *   get:
 *     summary: Get a spice level by ID
 *     tags: [Spice Level Master]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Spice level details
 */
router.get("/:id", getSpiceLevelById);

/**
 * @swagger
 * /api/spice-levels/{id}:
 *   put:
 *     summary: Update a spice level
 *     tags: [Spice Level Master]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Spice level updated successfully
 */
router.put("/:id", updateSpiceLevel);

/**
 * @swagger
 * /api/spice-levels/{id}:
 *   delete:
 *     summary: Delete a spice level
 *     tags: [Spice Level Master]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Spice level deleted successfully
 */
router.delete("/:id", deleteSpiceLevel);

export default router;
