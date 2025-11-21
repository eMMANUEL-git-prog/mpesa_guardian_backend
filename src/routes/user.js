import express from "express";
import pool from "../config/database.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// Get current user profile
router.get("/profile", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.full_name, u.phone_number, u.created_at,
              b.business_name, b.business_type
       FROM users u
       LEFT JOIN businesses b ON b.user_id = u.id
       WHERE u.id = $1`,
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({ error: "Failed to fetch user profile" });
  }
});

// Get user notifications (fraud alerts)
router.get("/notifications", authenticateToken, async (req, res) => {
  try {
    const limit = Number.parseInt(req.query.limit) || 10;

    // Get recent fraud alerts as notifications
    const result = await pool.query(
      `SELECT 
        fs.id,
        fs.fraud_score,
        fs.risk_level,
        fs.risk_factors,
        fs.created_at,
        t.transaction_id,
        t.trans_amount,
        t.msisdn,
        t.first_name,
        t.last_name
       FROM fraud_scores fs
       JOIN transactions t ON t.id = fs.transaction_id
       JOIN businesses b ON b.id = t.business_id
       WHERE b.user_id = $1 
       AND fs.risk_level IN ('high', 'critical')
       AND fs.reviewed = false
       ORDER BY fs.created_at DESC
       LIMIT $2`,
      [req.user.userId, limit]
    );

    res.json({
      notifications: result.rows,
      unread_count: result.rows.length,
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

// Mark notification as read
router.post("/notifications/:id/read", authenticateToken, async (req, res) => {
  try {
    await pool.query(
      `UPDATE fraud_scores 
       SET reviewed = true, reviewed_at = NOW(), reviewed_by = $1
       WHERE id = $2`,
      [req.user.userId, req.params.id]
    );

    res.json({ message: "Notification marked as read" });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({ error: "Failed to mark notification as read" });
  }
});

export default router;
