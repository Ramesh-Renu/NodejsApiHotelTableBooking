import { Router } from "express";
import { verifyOtp } from "../controllers/otp.controller.js";
import { sendOtp } from "../controllers/otp.controller.js";
const router = Router();

/**
 * @swagger
 * /api/otp/send-otp:
 *   post:
 *     summary: Send OTP to mobile number
 *     tags: [OTP]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - mobilenumber
 *             properties:
 *               mobilenumber:
 *                 type: string
 *                 example: "9876543210"
 *     responses:
 *       200:
 *         description: OTP sent successfully
 */
// router.post("/send-otp", (req, res) => {
//   const { mobilenumber } = req.body;
//   if (!mobilenumber) {
//     return res.status(400).json({
//       success: false,
//       message: "Mobile number is required",
//     });
//   } else {
//     // Here, you would integrate with an SMS service to send the OTP
//     res.status(200).json({
//       success: true,
//       message: "OTP sent",
//     });
//   }
// });
router.post("/send-otp", sendOtp);
/**
 * @swagger
 * /api/otp/verify-otp:
 *   post:
 *     summary: Verify OTP
 *     tags: [OTP]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - mobilenumber
 *               - otp
 *             properties:
 *               mobilenumber:
 *                 type: string
 *                 example: "9876543210"
 *               otp:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: OTP verified successfully
 *       400:
 *         description: Invalid or expired OTP
 */
router.post("/verify-otp", verifyOtp);

export default router;
