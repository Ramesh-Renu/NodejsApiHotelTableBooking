import express from "express";
import dotenv from "dotenv";
import cors from "cors";

import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./config/swagger.js";

import otpRoutes from "./routes/otp.routes.js";
import userRoutes from "./routes/user.routes.js";
import authRoutes from "./routes/auth.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import { connectDB } from "./config/db.js";

connectDB(); // 👈 MUST BE HERE
dotenv.config();

const app = express();

/* ✅ ENABLE CORS */
app.use(cors());
app.use(express.json()); // ✅ FIXED: Parse JSON bodies

/* Optional but recommended */
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/otp", otpRoutes);
app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);

/* Swagger */
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
