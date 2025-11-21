/**
 * Machine Learning Model Service
 * Placeholder for more advanced ML-based fraud detection
 *
 * This can be extended with:
 * - TensorFlow.js for browser-based models
 * - scikit-learn models via Python bridge
 * - Cloud-based ML services (AWS SageMaker, Azure ML, etc.)
 */

/**
 * Feature extraction for ML model
 */
export function extractFeatures(transaction, history) {
  const features = {
    // Transaction features
    amount: transaction.trans_amount,
    hour_of_day: new Date(transaction.trans_time).getHours(),
    day_of_week: new Date(transaction.trans_time).getDay(),

    // Historical features (if available)
    amount_deviation: history?.avg_amount
      ? (transaction.trans_amount - history.avg_amount) / (history.stddev_amount || 1)
      : 0,

    customer_transaction_count: history?.customer_transactions || 0,

    // Derived features
    is_round_number: transaction.trans_amount % 1000 === 0 ? 1 : 0,
    is_unusual_hour:
      new Date(transaction.trans_time).getHours() >= 23 || new Date(transaction.trans_time).getHours() <= 5 ? 1 : 0,

    // Phone features
    phone_length: transaction.msisdn?.length || 0,
    has_country_code: transaction.msisdn?.startsWith("+") ? 1 : 0,
  }

  return features
}

/**
 * Simple logistic regression predictor (placeholder)
 * In production, this would load a trained model
 */
export function predictFraudScore(features) {
  // Weights (these would come from a trained model)
  const weights = {
    amount_deviation: 0.25,
    is_round_number: 0.1,
    is_unusual_hour: 0.15,
    customer_transaction_count: -0.05, // More transactions = less suspicious
  }

  let score = 0.5 // Base score

  // Apply weighted features
  score += weights.amount_deviation * Math.min(Math.abs(features.amount_deviation), 1)
  score += weights.is_round_number * features.is_round_number
  score += weights.is_unusual_hour * features.is_unusual_hour

  if (features.customer_transaction_count > 0) {
    score += weights.customer_transaction_count * Math.log(features.customer_transaction_count + 1)
  }

  // Clamp to [0, 1]
  return Math.max(0, Math.min(1, score))
}

/**
 * Ensemble prediction combining rule-based and ML approaches
 */
export function ensemblePredict(ruleBasedScore, mlScore, weights = { rule: 0.6, ml: 0.4 }) {
  return ruleBasedScore * weights.rule + mlScore * weights.ml
}
