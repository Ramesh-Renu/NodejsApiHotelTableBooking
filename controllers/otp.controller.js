import jwt from "jsonwebtoken";
import RegisterUsersData from "../models/user.model.js";
import RefreshToken from "../models/refreshToken.model.js";
import { sendOtpSms } from "../services/sms.service.js";

export const verifyOtp = async (req, res) => {
  const { mobilenumber } = req.body;

  // 🔍 Check user
  let user = await RegisterUsersData.findOne({
    where: { mobilenumber },
  });

  // 👤 Create user if not exists
  if (!user) {
    user = await RegisterUsersData.create({
      mobilenumber,
      role: "user",
    });
  }

  // 🔐 Create JWT with role
  const accessToken = jwt.sign(
    {
      id: user.id,
      mobilenumber: user.mobilenumber,
      role: user.role,
    },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: "15m" }
  );

  const refreshToken = jwt.sign(
    {
      id: user.id,
      mobilenumber: user.mobilenumber,
      role: user.role,
    },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: "7d" }
  );

  await RefreshToken.create({
    mobile: mobilenumber,
    token: refreshToken,
  });

  res.json({
    message: "Login successful",
    role: user.role,
    accessToken,
    refreshToken,
  });
};

export const sendOtp = async (req, res) => {
  const { mobilenumber } = req.body;

  if (!mobilenumber) {
    return res.status(400).json({
      success: false,
      message: "Mobile number is required",
    });
  }

  // ✅ DEV MODE STATIC OTP
  const otp =
    process.env.NODE_ENV === "development"
      ? process.env.DEV_STATIC_OTP
      : Math.floor(100000 + Math.random() * 900000);

  console.log("OTP for", mobilenumber, ":", otp);

  // ❌ No SMS in dev mode
  res.json({
    success: true,
    message: "OTP generated (DEV MODE)",
    otp, // ⚠️ remove in production
  });
};
