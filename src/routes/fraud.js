import express from "express"
import pool from "../config/database.js"

const router = express.Router()

// Get flagged transactions
router.get("/flagged", async (req, res) => {
  try {
    const { business_id, reviewed = false } = req.query

    const result = await pool.query(
      `
      SELECT 
        t.*,
        fs.fraud_score,
        fs.risk_level,
        fs.risk_factors,
        fs.flagged,
        fs.reviewed
      FROM fraud_scores fs
      JOIN transactions t ON t.id = fs.transaction_id
      WHERE 
        fs.flagged = true
        AND fs.reviewed = $1
        AND (t.business_id = $2 OR $2 IS NULL)
      ORDER BY fs.fraud_score DESC, t.trans_time DESC
    `,
      [reviewed === "true", business_id || null],
    )

    res.json(result.rows)
  } catch (error) {
    console.error("Error fetching flagged transactions:", error)
    res.status(500).json({ error: "Failed to fetch flagged transactions" })
  }
})

// Review fraud alert
router.post("/review/:id", async (req, res) => {
  try {
    const { id } = req.params
    const { notes, user_id } = req.body

    const result = await pool.query(
      `
      UPDATE fraud_scores
      SET 
        reviewed = true,
        reviewed_by = $1,
        reviewed_at = CURRENT_TIMESTAMP,
        notes = $2
      WHERE transaction_id = $3
      RETURNING *
    `,
      [user_id, notes, id],
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Fraud score not found" })
    }

    res.json(result.rows[0])
  } catch (error) {
    console.error("Error reviewing fraud alert:", error)
    res.status(500).json({ error: "Failed to review fraud alert" })
  }
})

// Get fraud statistics
router.get("/stats", async (req, res) => {
  try {
    const { business_id } = req.query

    const result = await pool.query(
      `
      SELECT 
        COUNT(*) as total_analyzed,
        COUNT(*) FILTER (WHERE flagged = true) as flagged_count,
        COUNT(*) FILTER (WHERE risk_level = 'high' OR risk_level = 'critical') as high_risk_count,
        AVG(fraud_score) as avg_fraud_score,
        COUNT(*) FILTER (WHERE flagged = true AND reviewed = false) as pending_review
      FROM fraud_scores fs
      JOIN transactions t ON t.id = fs.transaction_id
      WHERE t.business_id = $1 OR $1 IS NULL
    `,
      [business_id || null],
    )

    res.json(result.rows[0])
  } catch (error) {
    console.error("Error fetching fraud stats:", error)
    res.status(500).json({ error: "Failed to fetch fraud statistics" })
  }
})

export default router
