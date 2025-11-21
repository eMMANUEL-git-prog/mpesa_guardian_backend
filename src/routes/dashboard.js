import express from "express";
import pool from "../config/database.js";

const router = express.Router();

// Get dashboard overview
router.get("/overview", async (req, res) => {
  try {
    const { business_id } = req.query;

    // Get total transactions and revenue
    const transactionsResult = await pool.query(
      `
      SELECT 
        COUNT(*) as total_transactions,
        COALESCE(SUM(trans_amount), 0) as total_revenue,
        COALESCE(AVG(trans_amount), 0) as avg_transaction_amount
      FROM transactions
      WHERE business_id = $1
    `,
      [business_id]
    );

    // Get today's stats
    const todayResult = await pool.query(
      `
      SELECT 
        COUNT(*) as today_transactions,
        COALESCE(SUM(trans_amount), 0) as today_revenue
      FROM transactions
      WHERE business_id = $1
        AND DATE(trans_time) = CURRENT_DATE
    `,
      [business_id]
    );

    // Get fraud stats
    const fraudResult = await pool.query(
      `
      SELECT 
        COUNT(*) FILTER (WHERE flagged = true) as flagged_transactions,
        COUNT(*) FILTER (WHERE risk_level = 'high' OR risk_level = 'critical') as high_risk_count
      FROM fraud_scores fs
      JOIN transactions t ON t.id = fs.transaction_id
      WHERE t.business_id = $1
    `,
      [business_id]
    );

    // Get hourly transaction data for chart
    const hourlyResult = await pool.query(
      `
      SELECT 
        DATE_TRUNC('hour', trans_time) as hour,
        COUNT(*) as count,
        SUM(trans_amount) as amount
      FROM transactions
      WHERE business_id = $1
        AND trans_time >= NOW() - INTERVAL '24 hours'
      GROUP BY hour
      ORDER BY hour
    `,
      [business_id]
    );

    res.json({
      ...transactionsResult.rows[0],
      ...todayResult.rows[0],
      ...fraudResult.rows[0],
      hourly_data: hourlyResult.rows,
    });
  } catch (error) {
    console.error("Error fetching dashboard overview:", error);
    res.status(500).json({ error: "Failed to fetch dashboard data" });
  }
});

// Get recent transactions
router.get("/recent", async (req, res) => {
  try {
    const { business_id, limit = 10 } = req.query;

    const result = await pool.query(
      `
      SELECT 
        t.*,
        fs.fraud_score,
        fs.risk_level,
        fs.flagged
      FROM transactions t
      LEFT JOIN fraud_scores fs ON t.id = fs.transaction_id
      WHERE t.business_id = $1
      ORDER BY t.trans_time DESC
      LIMIT $2
    `,
      [business_id, limit]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching recent transactions:", error);
    res.status(500).json({ error: "Failed to fetch recent transactions" });
  }
});

// Get top customers
router.get("/top-customers", async (req, res) => {
  try {
    const { business_id, limit = 5 } = req.query;

    const result = await pool.query(
      `
      SELECT 
        msisdn,
        first_name,
        last_name,
        COUNT(*) as transaction_count,
        SUM(trans_amount) as total_spent,
        MAX(trans_time) as last_transaction
      FROM transactions
      WHERE business_id = $1
      GROUP BY msisdn, first_name, last_name
      ORDER BY total_spent DESC
      LIMIT $2
    `,
      [business_id, limit]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching top customers:", error);
    res.status(500).json({ error: "Failed to fetch top customers" });
  }
});

router.get("/stats", async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get user's business
    const businessResult = await pool.query(
      "SELECT id FROM businesses WHERE user_id = $1",
      [userId]
    );

    if (businessResult.rows.length === 0) {
      return res.status(404).json({ error: "Business not found" });
    }

    const businessId = businessResult.rows[0].id;

    // Get total transactions and revenue
    const transactionsResult = await pool.query(
      `
      SELECT 
        COUNT(*) as total_transactions,
        COALESCE(SUM(trans_amount), 0) as total_revenue,
        COALESCE(AVG(trans_amount), 0) as avg_transaction_amount
      FROM transactions
      WHERE business_id = $1
    `,
      [businessId]
    );

    // Get today's stats
    const todayResult = await pool.query(
      `
      SELECT 
        COUNT(*) as today_transactions,
        COALESCE(SUM(trans_amount), 0) as today_revenue
      FROM transactions
      WHERE business_id = $1
        AND DATE(trans_time) = CURRENT_DATE
    `,
      [businessId]
    );

    // Get fraud stats
    const fraudResult = await pool.query(
      `
      SELECT 
        COUNT(*) FILTER (WHERE flagged = true) as flagged_transactions,
        COUNT(*) FILTER (WHERE risk_level = 'high' OR risk_level = 'critical') as high_risk_count
      FROM fraud_scores fs
      JOIN transactions t ON t.id = fs.transaction_id
      WHERE t.business_id = $1
    `,
      [businessId]
    );

    res.json({
      ...transactionsResult.rows[0],
      ...todayResult.rows[0],
      ...fraudResult.rows[0],
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({ error: "Failed to fetch dashboard data" });
  }
});

router.get("/recent-transactions", async (req, res) => {
  try {
    const userId = req.user.userId;
    const { limit = 10 } = req.query;

    const businessResult = await pool.query(
      "SELECT id FROM businesses WHERE user_id = $1",
      [userId]
    );

    if (businessResult.rows.length === 0) {
      return res.status(404).json({ error: "Business not found" });
    }

    const businessId = businessResult.rows[0].id;

    const result = await pool.query(
      `
      SELECT 
        t.*,
        fs.fraud_score,
        fs.risk_level,
        fs.flagged
      FROM transactions t
      LEFT JOIN fraud_scores fs ON t.id = fs.transaction_id
      WHERE t.business_id = $1
      ORDER BY t.trans_time DESC
      LIMIT $2
    `,
      [businessId, limit]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching recent transactions:", error);
    res.status(500).json({ error: "Failed to fetch recent transactions" });
  }
});

router.get("/fraud-alerts", async (req, res) => {
  try {
    const userId = req.user.userId;
    const { limit = 5 } = req.query;

    const businessResult = await pool.query(
      "SELECT id FROM businesses WHERE user_id = $1",
      [userId]
    );

    if (businessResult.rows.length === 0) {
      return res.status(404).json({ error: "Business not found" });
    }

    const businessId = businessResult.rows[0].id;

    const result = await pool.query(
      `
      SELECT 
        t.*,
        fs.fraud_score,
        fs.risk_level,
        fs.flagged,
        fs.created_at
      FROM fraud_scores fs
      JOIN transactions t ON t.id = fs.transaction_id
      WHERE t.business_id = $1 AND fs.flagged = true
      ORDER BY fs.created_at DESC
      LIMIT $2
    `,
      [businessId, limit]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching fraud alerts:", error);
    res.status(500).json({ error: "Failed to fetch fraud alerts" });
  }
});

export default router;
