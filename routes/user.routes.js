import express from "express";
import { registerUser } from "../controllers/user.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import RegisterUsersData from "../models/user.model.js";

const router = express.Router();

/**
 * @swagger
 * /api/users/register:
 *   post:
 *     summary: Register new user
 *     tags: [User]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - mobilenumber
 *             properties:
 *               name:
 *                 type: string
 *                 example: ""
 *               email:
 *                 type: string
 *                 example: ""
 *               mobilenumber:
 *                 type: string
 *                 example: ""
 *               location:
 *                 type: string
 *                 example: ""
 *     responses:
 *       201:
 *         description: User registered
 *       409:
 *         description: User already exists
 */
router.post("/register", registerUser);

/**
 * @swagger
 * /api/users/profile:
 *   get:
 *     summary: Get logged-in user profile
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile data
 *       404:
 *         description: User not found
 */
router.get("/profile", authenticate, async (req, res) => {
  try {
    // 🔑 From JWT
    const { id, mobilenumber, mobile } = req.user || {};

    // Build a safe `where` clause: prefer `id`, fallback to `mobilenumber`, then `mobile`
    if (!id && !mobilenumber && !mobile) {
      console.error("Profile error: token missing id/mobilenumber/mobile", req.user);
      return res.status(400).json({ message: "Invalid token: missing user identifier" });
    }

    const where = id ? { id } : mobilenumber ? { mobilenumber } : { mobilenumber: mobile };

    // 🔍 Fetch full user from DB
    const user = await RegisterUsersData.findOne({
      where,
      attributes: {
        exclude: ["createdAt", "updatedAt"], // optional
      },
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    res.json({
      message: "Protected profile",
      user,
    });
  } catch (error) {
    console.error("Profile error:", error);
    res.status(500).json({
      message: "Internal server error",
    });
  }
});

/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     summary: Update user by ID (mobile number cannot be updated)
 *     tags: [User]
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
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               location:
 *                 type: string
 */
router.put("/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, location } = req.body;

    const user = await RegisterUsersData.findByPk(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // ✅ UPDATE ONLY ALLOWED FIELDS
    if (name && name.trim() !== "") {
      user.name = name.trim();
    }

    if (email && email.trim() !== "") {
      user.email = email.trim();
    }

    if (location && location.trim() !== "") {
      user.location = location.trim();
    }

    // ❌ mobilenumber is intentionally NOT updated
    // even if sent in request body

    await user.save();

    res.json({
      success: true,
      message: "User updated successfully",
      // data: user,
    });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

export default router;
