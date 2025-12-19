import { Sequelize } from "sequelize";
import dotenv from "dotenv";

dotenv.config();

export const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: "postgres",
    logging: false,
  }
);

export const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log("DB connected successfully");

    // ✅ Auto create / update tables
    await sequelize.sync({ alter: true }); // 👈 ADD THIS
    console.log("All models synchronized");
  } catch (error) {
    console.error("DB error:", error);
    process.exit(1);
  }
};
