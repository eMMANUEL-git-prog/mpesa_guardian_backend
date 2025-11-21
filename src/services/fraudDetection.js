import pool from "../config/database.js";

/**
 * Lightweight fraud detection engine
 * Analyzes transactions using rule-based patterns and statistical analysis
 */

// Calculate fraud score for a transaction
export async function analyzeFraud(transaction) {
  const factors = [];
  let totalScore = 0;

  // Get fraud patterns from database
  const patternsResult = await pool.query(
    "SELECT * FROM fraud_patterns WHERE active = true"
  );
  const patterns = patternsResult.rows;

  // Get historical data for the business
  const historyResult = await pool.query(
    `
    SELECT 
      AVG(trans_amount) as avg_amount,
      STDDEV(trans_amount) as stddev_amount,
      COUNT(*) as total_transactions
    FROM transactions
    WHERE business_id = $1
  `,
    [transaction.business_id]
  );

  const history = historyResult.rows[0];

  // Get customer transaction history
  const customerResult = await pool.query(
    `
    SELECT COUNT(*) as customer_transactions
    FROM transactions
    WHERE business_id = $1 AND msisdn = $2
  `,
    [transaction.business_id, transaction.msisdn]
  );

  const customerHistory = customerResult.rows[0];

  // Check recent transactions from same number (velocity check)
  const velocityResult = await pool.query(
    `
    SELECT COUNT(*) as recent_count
    FROM transactions
    WHERE business_id = $1 
      AND msisdn = $2
      AND trans_time >= NOW() - INTERVAL '5 minutes'
  `,
    [transaction.business_id, transaction.msisdn]
  );

  const velocityCount = velocityResult.rows[0].recent_count;

  // Pattern 1: Unusual Amount Detection
  if (history.avg_amount && history.stddev_amount) {
    const zScore = Math.abs(
      (transaction.trans_amount - history.avg_amount) / history.stddev_amount
    );

    if (zScore > 3) {
      const pattern = patterns.find((p) => p.pattern_type === "unusual_amount");
      if (pattern) {
        const score = pattern.weight * Math.min(zScore / 5, 1);
        totalScore += score;
        factors.push({
          type: "unusual_amount",
          description: "Transaction amount significantly deviates from average",
          severity: zScore > 5 ? "high" : "medium",
          details: {
            amount: transaction.trans_amount,
            avg_amount: history.avg_amount,
            z_score: zScore.toFixed(2),
          },
        });
      }
    }
  }

  // Pattern 2: Unusual Time Detection
  const transHour = new Date(transaction.trans_time).getHours();
  if (transHour >= 23 || transHour <= 5) {
    const pattern = patterns.find((p) => p.pattern_type === "unusual_time");
    if (pattern) {
      totalScore += pattern.weight;
      factors.push({
        type: "unusual_time",
        description: "Transaction at unusual hours",
        severity: "low",
        details: {
          hour: transHour,
          time: transaction.trans_time,
        },
      });
    }
  }

  // Pattern 3: Rapid Succession (Velocity Check)
  if (velocityCount >= 3) {
    const pattern = patterns.find((p) => p.pattern_type === "rapid_succession");
    if (pattern) {
      const multiplier = Math.min(velocityCount / 3, 2);
      totalScore += pattern.weight * multiplier;
      factors.push({
        type: "rapid_succession",
        description: "Multiple transactions in short time window",
        severity: velocityCount >= 5 ? "high" : "medium",
        details: {
          transaction_count: velocityCount,
          time_window: "5 minutes",
        },
      });
    }
  }

  // Pattern 4: Large Amount Detection (any customer with large amount)
  if (transaction.trans_amount > 50000) {
    const pattern = patterns.find(
      (p) => p.pattern_type === "new_customer_large_amount"
    );
    if (pattern) {
      // Higher weight for completely new customers
      const isNewCustomer = customerHistory.customer_transactions === 0;
      const weight = isNewCustomer ? pattern.weight : pattern.weight * 0.7;

      totalScore += weight;
      factors.push({
        type: "large_amount",
        description: isNewCustomer
          ? "First-time customer with large transaction"
          : "Large transaction amount detected",
        severity: "high",
        details: {
          amount: transaction.trans_amount,
          is_first_transaction: isNewCustomer,
          threshold: 50000,
        },
      });
    }
  }

  // Pattern 5: Round Number Pattern
  const roundNumbers = [1000, 5000, 10000, 50000, 100000];
  if (roundNumbers.includes(transaction.trans_amount)) {
    // Check if customer has made multiple round number transactions
    const roundNumResult = await pool.query(
      `
      SELECT COUNT(*) as round_count
      FROM transactions
      WHERE business_id = $1 
        AND msisdn = $2
        AND trans_amount = ANY($3)
    `,
      [transaction.business_id, transaction.msisdn, roundNumbers]
    );

    if (roundNumResult.rows[0].round_count >= 2) {
      const pattern = patterns.find(
        (p) => p.pattern_type === "round_number_pattern"
      );
      if (pattern) {
        totalScore += pattern.weight;
        factors.push({
          type: "round_number_pattern",
          description: "Multiple round number transactions",
          severity: "low",
          details: {
            amount: transaction.trans_amount,
            round_transaction_count: roundNumResult.rows[0].round_count,
          },
        });
      }
    }
  }

  // Pattern 6: Geographic Anomaly (basic implementation)
  const phonePrefix = transaction.msisdn.substring(0, 4);
  const suspiciousPrefixes = ["0700", "0701", "+2547", "+2540"];

  if (suspiciousPrefixes.includes(phonePrefix)) {
    const pattern = patterns.find(
      (p) => p.pattern_type === "geographic_anomaly"
    );
    if (pattern) {
      // Only flag if combined with other factors
      if (factors.length > 0) {
        totalScore += pattern.weight * 0.5;
        factors.push({
          type: "geographic_anomaly",
          description: "Unusual phone prefix detected",
          severity: "low",
          details: {
            phone: transaction.msisdn,
            prefix: phonePrefix,
          },
        });
      }
    }
  }

  // Normalize score to 0-1 range
  const normalizedScore = Math.min(totalScore, 1);

  // Determine risk level
  let riskLevel;
  let flagged = false;

  if (normalizedScore >= 0.75) {
    riskLevel = "critical";
    flagged = true;
  } else if (normalizedScore >= 0.5) {
    riskLevel = "high";
    flagged = true;
  } else if (normalizedScore >= 0.3) {
    riskLevel = "medium";
    flagged = normalizedScore >= 0.4; // Flag upper medium range
  } else {
    riskLevel = "low";
    flagged = false;
  }

  return {
    score: normalizedScore,
    risk_level: riskLevel,
    flagged,
    factors,
    analyzed_at: new Date(),
  };
}

/**
 * Batch analyze multiple transactions
 */
export async function batchAnalyzeFraud(transactions) {
  const results = [];

  for (const transaction of transactions) {
    try {
      const analysis = await analyzeFraud(transaction);
      results.push({
        transaction_id: transaction.id,
        ...analysis,
      });
    } catch (error) {
      console.error(`Failed to analyze transaction ${transaction.id}:`, error);
      results.push({
        transaction_id: transaction.id,
        error: error.message,
      });
    }
  }

  return results;
}

/**
 * Get fraud detection statistics
 */
export function calculateStatistics(analyses) {
  const total = analyses.length;
  const flagged = analyses.filter((a) => a.flagged).length;
  const byRiskLevel = {
    low: analyses.filter((a) => a.risk_level === "low").length,
    medium: analyses.filter((a) => a.risk_level === "medium").length,
    high: analyses.filter((a) => a.risk_level === "high").length,
    critical: analyses.filter((a) => a.risk_level === "critical").length,
  };

  const avgScore = analyses.reduce((sum, a) => sum + a.score, 0) / total;

  return {
    total,
    flagged,
    flagged_percentage: ((flagged / total) * 100).toFixed(2),
    by_risk_level: byRiskLevel,
    average_score: avgScore.toFixed(4),
  };
}
