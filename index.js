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
import diningStatusRoutes from "./routes/diningStatusMaster.routes.js";
import menuRoutes from "./routes/menu.routes.js";
import menuCategoryRoutes from "./routes/menuCategory.routes.js";
import orderStatusRoutes from "./routes/orderStatusMaster.routes.js";
import paymentStatusRoutes from "./routes/paymentStatusMaster.routes.js";
import spiceLevelRoutes from "./routes/spiceLevelMaster.routes.js";
import reservationOrderRoutes from "./routes/reservationOrder.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import menuSideDishRoutes from "./routes/menuSideDish.routes.js";

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
app.use("/api/dining-status", diningStatusRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/menu-categories", menuCategoryRoutes);
app.use("/api/order-status", orderStatusRoutes);
app.use("/api/payment-status", paymentStatusRoutes);
app.use("/api/spice-levels", spiceLevelRoutes);
app.use("/api/menu-side-dishes", menuSideDishRoutes);

/* Swagger */
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/* Order */
app.use("/api/orders", reservationOrderRoutes);

app.use("/api/upload", uploadRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
