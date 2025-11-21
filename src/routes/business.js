import express from "express";
import pool from "../config/database.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

router.post("/", authenticateToken, async (req, res) => {
  try {
    const { business_name, business_type, till_number, paybill_number } =
      req.body;
    const userId = req.user.userId;

    // Validate that at least one M-Pesa number is provided
    if (!paybill_number && !till_number) {
      return res
        .status(400)
        .json({
          error: "At least one M-Pesa number (Paybill or Till) is required",
        });
    }

    // Check if user already has a business
    const existingBusiness = await pool.query(
      "SELECT * FROM businesses WHERE user_id = $1",
      [userId]
    );

    if (existingBusiness.rows.length > 0) {
      return res
        .status(400)
        .json({ error: "Business already exists for this user" });
    }

    if (paybill_number) {
      const duplicatePaybill = await pool.query(
        "SELECT * FROM businesses WHERE paybill_number = $1",
        [paybill_number]
      );
      if (duplicatePaybill.rows.length > 0) {
        return res
          .status(400)
          .json({
            error: `Paybill number ${paybill_number} is already registered to another business`,
          });
      }
    }

    if (till_number) {
      const duplicateTill = await pool.query(
        "SELECT * FROM businesses WHERE till_number = $1",
        [till_number]
      );
      if (duplicateTill.rows.length > 0) {
        return res
          .status(400)
          .json({
            error: `Till number ${till_number} is already registered to another business`,
          });
      }
    }

    // Create business
    const result = await pool.query(
      `INSERT INTO businesses 
      (user_id, business_name, business_type, till_number, paybill_number) 
      VALUES ($1, $2, $3, $4, $5) 
      RETURNING *`,
      [
        userId,
        business_name,
        business_type,
        till_number || null,
        paybill_number,
      ]
    );

    res.status(201).json({ business: result.rows[0] });
  } catch (error) {
    console.error("Business creation error:", error);
    if (error.code === "23505") {
      if (error.constraint === "businesses_paybill_number_key") {
        return res
          .status(400)
          .json({
            error:
              "This Paybill number is already registered to another business",
          });
      }
      if (error.constraint === "businesses_till_number_key") {
        return res
          .status(400)
          .json({
            error: "This Till number is already registered to another business",
          });
      }
    }
    res.status(500).json({ error: "Failed to create business" });
  }
});

router.get("/", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      "SELECT * FROM businesses WHERE user_id = $1",
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Business not found" });
    }

    res.json({ business: result.rows[0] });
  } catch (error) {
    console.error("Business fetch error:", error);
    res.status(500).json({ error: "Failed to fetch business" });
  }
});

router.put("/", authenticateToken, async (req, res) => {
  try {
    const { business_name, business_type, till_number, paybill_number } =
      req.body;
    const userId = req.user.userId;

    const result = await pool.query(
      `UPDATE businesses 
      SET business_name = $1, business_type = $2, till_number = $3, 
          paybill_number = $4, updated_at = NOW()
      WHERE user_id = $5 
      RETURNING *`,
      [
        business_name,
        business_type,
        till_number || null,
        paybill_number,
        userId,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Business not found" });
    }

    res.json({ business: result.rows[0] });
  } catch (error) {
    console.error("Business update error:", error);
    res.status(500).json({ error: "Failed to update business" });
  }
});

export default router;
