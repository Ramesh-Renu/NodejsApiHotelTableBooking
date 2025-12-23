import express from "express";
import jwt from "jsonwebtoken";
import RefreshToken from "../models/refreshToken.model.js";

const router = express.Router();

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: New access token
 */
router.post("/refresh", async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ message: "Refresh token required" });
  }

  try {
    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET
    );

    const tokenExists = await RefreshToken.findOne({
      where: { token: refreshToken },
    });

    if (!tokenExists) {
      return res.status(403).json({ message: "Invalid refresh token" });
    }

    // Preserve user identity in the new access token (use same claims as refresh token)
    const newAccessToken = jwt.sign(
      {
        id: decoded.id,
        mobilenumber: decoded.mobilenumber,
        role: decoded.role,
      },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: "15m" }
    );

    // Return both access and refresh tokens so frontend can update both values
    res.json({ accessToken: newAccessToken, refreshToken });
  } catch (err) {
    // Distinguish expired tokens from other JWT errors for clearer debugging
    if (err && err.name === "TokenExpiredError") {
      console.error("Refresh token expired:", err);
      return res.status(403).json({ message: "Refresh token expired" });
    }

    console.error("Refresh token error:", err);
    res.status(403).json({ message: "Refresh token expired or invalid" });
  }
});

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Auth]
 */
router.post("/logout", async (req, res) => {
  const { refreshToken } = req.body;

  await RefreshToken.destroy({
    where: { token: refreshToken },
  });

  res.json({ message: "Logged out successfully" });
});

export default router;
