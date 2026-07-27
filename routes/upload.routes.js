import express from "express";
import upload from "../middlewares/upload.middleware.js";
import { uploadImage } from "../utils/uploadImage.js";

const router = express.Router();

/**
 * @swagger
 * /api/upload:
 *   post:
 *     summary: Upload Menu Image
 *     tags: [Upload]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Image uploaded successfully
 */
router.post(
  "/",
  upload.single("image"),
  async (req, res) => {
    try {
      const result = await uploadImage(req.file);

      return res.json(result);
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  }
);

export default router;
