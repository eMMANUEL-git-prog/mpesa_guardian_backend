import express from "express";
import pool from "../config/database.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

router.get("/search", authenticateToken, async (req, res) => {
  try {
    const query = req.query.q || "";
    const page = Number.parseInt(req.query.page) || 1;
    const limit = Number.parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Get user's business
    const businessResult = await pool.query(
      "SELECT id FROM businesses WHERE user_id = $1",
      [req.user.userId]
    );

    if (businessResult.rows.length === 0) {
      return res.json({
        transactions: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
      });
    }

    const businessId = businessResult.rows[0].id;

    // Search transactions
    const result = await pool.query(
      `SELECT 
        t.*,
        fs.fraud_score,
        fs.risk_level
       FROM transactions t
       LEFT JOIN fraud_scores fs ON fs.transaction_id = t.id
       WHERE t.business_id = $1 
       AND (
         t.transaction_id ILIKE $2 OR
         t.msisdn ILIKE $2 OR
         t.first_name ILIKE $2 OR
         t.last_name ILIKE $2 OR
         t.bill_ref_number ILIKE $2
       )
       ORDER BY t.trans_time DESC
       LIMIT $3 OFFSET $4`,
      [businessId, `%${query}%`, limit, offset]
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) 
       FROM transactions t
       WHERE t.business_id = $1 
       AND (
         t.transaction_id ILIKE $2 OR
         t.msisdn ILIKE $2 OR
         t.first_name ILIKE $2 OR
         t.last_name ILIKE $2 OR
         t.bill_ref_number ILIKE $2
       )`,
      [businessId, `%${query}%`]
    );

    const total = Number.parseInt(countResult.rows[0].count);

    res.json({
      transactions: result.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error searching transactions:", error);
    res.status(500).json({ error: "Failed to search transactions" });
  }
});

// Get all transactions for a business
router.get("/", async (req, res) => {
  try {
    const { business_id, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT 
        t.*,
        fs.fraud_score,
        fs.risk_level,
        fs.flagged
      FROM transactions t
      LEFT JOIN fraud_scores fs ON t.id = fs.transaction_id
    `;

    const params = [];

    if (business_id) {
      query += " WHERE t.business_id = $1";
      params.push(business_id);
    }

    query +=
      " ORDER BY t.trans_time DESC LIMIT $" +
      (params.length + 1) +
      " OFFSET $" +
      (params.length + 2);
    params.push(limit, offset);

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

// Get single transaction with details
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT 
        t.*,
        fs.fraud_score,
        fs.risk_level,
        fs.risk_factors,
        fs.flagged,
        fs.reviewed,
        fs.notes
      FROM transactions t
      LEFT JOIN fraud_scores fs ON t.id = fs.transaction_id
      WHERE t.id = $1
    `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error fetching transaction:", error);
    res.status(500).json({ error: "Failed to fetch transaction" });
  }
});

export default router;
