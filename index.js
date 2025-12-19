// index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./config/db.js";
import userRoutes from "./routes/user.routes.js";
import { sequelize } from './config/db.js';  // Adjust the path to your db configuration

dotenv.config();

const app = express();

// Optionally, you can sync your database to ensure your models match the database schema
sequelize.sync({ alter: true })  // This alters the table without dropping it
  .then(() => {
    console.log('Database synchronized');
  })
  .catch((err) => {
    console.error('Error syncing database:', err);
  });

app.use(cors({
  origin: "http://localhost:3000",
  credentials: true,
}));

app.use(express.json());

app.use("/api", userRoutes);

connectDB();

app.listen(5000, () => {
  console.log("Server running on port 5000");
});
