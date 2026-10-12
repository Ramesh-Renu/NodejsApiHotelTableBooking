import express from "express";
import {
  createServer,
  deleteServer,
  getServerById,
  getServers,
  updateServer,
} from "../controllers/server.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Servers
 *     description: Floor staff assigned to orders when they are served
 */

/**
 * @swagger
 * /api/servers:
 *   get:
 *     summary: List servers
 *     tags: [Servers]
 *     parameters:
 *       - in: query
 *         name: hotel_id
 *         schema: { type: integer }
 *         description: That hotel's servers plus servers for all hotels
 *       - in: query
 *         name: is_active
 *         schema: { type: boolean }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *   post:
 *     summary: Add a server (Admin)
 *     tags: [Servers]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [server_name]
 *             properties:
 *               server_name: { type: string }
 *               section: { type: string }
 *               photo_url: { type: string }
 *               photo_file_id: { type: string }
 *               hotel_id: { type: integer, nullable: true }
 *               is_active: { type: boolean }
 */
router.get("/", authenticate, getServers);
router.post("/", authenticate, authorizeRoles("Admin"), createServer);

/**
 * @swagger
 * /api/servers/{id}:
 *   get:
 *     summary: Get a server
 *     tags: [Servers]
 *   put:
 *     summary: Update a server (Admin)
 *     tags: [Servers]
 *   delete:
 *     summary: Delete a server with no orders (Admin)
 *     tags: [Servers]
 */
router.get("/:id", authenticate, getServerById);
router.put("/:id", authenticate, authorizeRoles("Admin"), updateServer);
router.delete("/:id", authenticate, authorizeRoles("Admin"), deleteServer);

export default router;
