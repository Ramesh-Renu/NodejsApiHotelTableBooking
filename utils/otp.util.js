import { createHash } from "crypto";

export function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000); // 6 digits
}

export function hashOTP(otp) {
  return createHash("sha256").update(otp.toString()).digest("hex");
}
