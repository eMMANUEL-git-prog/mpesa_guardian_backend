import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import transactionRoutes from "./routes/transactions.js";
import fraudRoutes from "./routes/fraud.js";
import dashboardRoutes from "./routes/dashboard.js";
import mpesaRoutes from "./routes/mpesa.js";
import authRoutes from "./routes/auth.js";
import businessRoutes from "./routes/business.js";
import userRoutes from "./routes/user.js";
import { authenticateToken } from "./middleware/auth.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

import pool from "./config/database.js";

async function testDBConnection() {
  try {
    await pool.query("SELECT NOW()");
    console.log("✓ PostgreSQL Database connected successfully");
  } catch (err) {
    console.error("✗ Failed to connect to PostgreSQL:", err.message);
  }
}

testDBConnection();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/transactions", authenticateToken, transactionRoutes);
app.use("/api/fraud", authenticateToken, fraudRoutes);
app.use("/api/dashboard", authenticateToken, dashboardRoutes);
app.use("/api/business", authenticateToken, businessRoutes);
app.use("/api/user", authenticateToken, userRoutes);
app.use("/api/mpesa", mpesaRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: "Something went wrong!",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

app.listen(PORT, () => {
  console.log(`M-Pesa Guardian Backend running on port ${PORT}`);
});
