import express from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizePermission } from "../middlewares/role.middleware.js";
import {
  reportInstall,
  getInstallSummary,
} from "../controllers/pwaInstall.controller.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: App installs
 *   description: Devices that installed the PWA
 */

/**
 * @swagger
 * /api/pwa/installs:
 *   post:
 *     summary: Report that this device runs the installed app
 *     tags: [App installs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [device_id]
 *             properties:
 *               device_id: { type: string, example: "3f2b6c1e-9a1d-4c55-8f0e-2f6f0f2c1a77" }
 *               platform:
 *                 type: string
 *                 enum: [android, ios, windows, mac, linux, other]
 *     responses:
 *       201: { description: First report from this device }
 *       200: { description: Device already counted (last seen updated) }
 */
router.post("/installs", authenticate, reportInstall);

/**
 * @swagger
 * /api/pwa/installs/summary:
 *   get:
 *     summary: How many users / devices installed the app (Admin)
 *     tags: [App installs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: "{ users, devices, last_7_days, by_platform }"
 */
router.get("/installs/summary", authenticate, authorizePermission("dashboard", "view"), getInstallSummary);

export default router;
