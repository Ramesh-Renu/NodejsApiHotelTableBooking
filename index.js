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
import hotelTableRoutes from "./routes/hotelTable.routes.js";
import floorRoutes from "./routes/floor.routes.js";
import tableRoutes from "./routes/table.routes.js";
import seatRoutes from "./routes/seat.routes.js";
import reservationRoutes from "./routes/reservation.routes.js";
import seatsStatusRoutes from "./routes/seatStatusMaster.routes.js";
import areaRoutes from "./routes/area.routes.js";
import locationRoutes from "./routes/location.routes.js";
import "./models/index.js";

connectDB(); // 👈 MUST BE HERE
dotenv.config();

const app = express();

/* ✅ ENABLE CORS */
app.use(cors());
app.use(express.json()); // ✅ FIXED: Parse JSON bodies

/* Optional but recommended */
app.use("/api/auth", authRoutes);
app.use("/api/otp", otpRoutes);
app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/hotel", hotelTableRoutes);
app.use("/api/floors", floorRoutes);
app.use("/api/tables", tableRoutes);
app.use("/api/seats", seatRoutes);
app.use("/api/reservations", reservationRoutes);
app.use("/api/areas", areaRoutes);
app.use("/api/locations", locationRoutes);
app.use("/api/seat-status", seatsStatusRoutes);


/* Swagger */
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
