import express from "express";
import pool from "../config/database.js";
import { analyzeFraud } from "../services/fraudDetection.js";
import mpesaService from "../services/mpesaService.js";

const router = express.Router();

// M-Pesa C2B callback endpoint
router.post("/callback", async (req, res) => {
  try {
    console.log("M-Pesa Callback received:", JSON.stringify(req.body, null, 2));

    const {
      TransID,
      TransactionType,
      TransAmount,
      BusinessShortCode,
      BillRefNumber,
      InvoiceNumber,
      OrgAccountBalance,
      ThirdPartyTransID,
      MSISDN,
      FirstName,
      MiddleName,
      LastName,
      TransTime,
    } = req.body;

    const parseNumericField = (value) => {
      if (value === "" || value === null || value === undefined) return null;
      return value;
    };

    // Parse transaction time (format: YYYYMMDDHHmmss)
    const year = TransTime.substring(0, 4);
    const month = TransTime.substring(4, 6);
    const day = TransTime.substring(6, 8);
    const hour = TransTime.substring(8, 10);
    const minute = TransTime.substring(10, 12);
    const second = TransTime.substring(12, 14);
    const transTime = new Date(
      `${year}-${month}-${day}T${hour}:${minute}:${second}`
    );

    // Find business by paybill number
    const businessResult = await pool.query(
      "SELECT id FROM businesses WHERE paybill_number = $1",
      [BusinessShortCode]
    );

    if (businessResult.rows.length === 0) {
      console.error("Business not found for paybill:", BusinessShortCode);
      return res.status(404).json({ error: "Business not found" });
    }

    const business_id = businessResult.rows[0].id;

    const transactionResult = await pool.query(
      `
      INSERT INTO transactions (
        business_id,
        transaction_id,
        transaction_type,
        trans_amount,
        business_short_code,
        bill_ref_number,
        invoice_number,
        org_account_balance,
        third_party_trans_id,
        msisdn,
        first_name,
        middle_name,
        last_name,
        trans_time
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `,
      [
        business_id,
        TransID,
        TransactionType,
        parseNumericField(TransAmount),
        BusinessShortCode,
        BillRefNumber || null,
        InvoiceNumber || null,
        parseNumericField(OrgAccountBalance),
        ThirdPartyTransID || null,
        MSISDN,
        FirstName || "",
        MiddleName || "",
        LastName || "",
        transTime,
      ]
    );

    const transaction = transactionResult.rows[0];

    // Analyze for fraud
    const fraudAnalysis = await analyzeFraud(transaction);

    // Insert fraud score
    await pool.query(
      `
      INSERT INTO fraud_scores (
        transaction_id,
        fraud_score,
        risk_level,
        risk_factors,
        flagged
      ) VALUES ($1, $2, $3, $4, $5)
    `,
      [
        transaction.id,
        fraudAnalysis.score,
        fraudAnalysis.risk_level,
        JSON.stringify(fraudAnalysis.factors),
        fraudAnalysis.flagged,
      ]
    );

    console.log(
      `Transaction ${TransID} processed. Fraud score: ${fraudAnalysis.score}, Risk level: ${fraudAnalysis.risk_level}`
    );

    res.json({
      status: "success",
      message: "Transaction received and analyzed",
      fraud_score: fraudAnalysis.score,
      risk_level: fraudAnalysis.risk_level,
    });
  } catch (error) {
    console.error("M-Pesa callback error:", error);
    res.status(500).json({ error: "Failed to process transaction" });
  }
});

// M-Pesa validation endpoint
router.post("/validation", (req, res) => {
  console.log("M-Pesa Validation request:", JSON.stringify(req.body, null, 2));

  // Accept all transactions (you can add custom validation logic here)
  res.json({
    ResultCode: 0,
    ResultDesc: "Accepted",
  });
});

// Register URLs with M-Pesa (for setup)
router.post("/register-urls", async (req, res) => {
  try {
    const { shortCode, callbackUrl, validationUrl } = req.body;

    // This would normally make a request to M-Pesa API to register URLs
    // For now, just return success
    console.log("URL Registration request:", {
      shortCode,
      callbackUrl,
      validationUrl,
    });

    res.json({
      status: "success",
      message: "URLs registered successfully",
      callback_url: callbackUrl,
      validation_url: validationUrl,
    });
  } catch (error) {
    console.error("URL registration error:", error);
    res.status(500).json({ error: "Failed to register URLs" });
  }
});

router.post("/stk-push", async (req, res) => {
  try {
    const { phoneNumber, amount, accountReference, transactionDesc } = req.body;

    if (!phoneNumber || !amount || !accountReference) {
      return res.status(400).json({
        error: "Missing required fields: phoneNumber, amount, accountReference",
      });
    }

    const result = await mpesaService.stkPush(
      phoneNumber,
      amount,
      accountReference,
      transactionDesc
    );

    res.json(result);
  } catch (error) {
    console.error("STK Push error:", error);
    res.status(500).json({ error: "Failed to initiate STK push" });
  }
});

router.post("/stk-query", async (req, res) => {
  try {
    const { checkoutRequestId } = req.body;

    if (!checkoutRequestId) {
      return res.status(400).json({ error: "Missing checkoutRequestId" });
    }

    const result = await mpesaService.queryStkPushStatus(checkoutRequestId);
    res.json(result);
  } catch (error) {
    console.error("STK Query error:", error);
    res.status(500).json({ error: "Failed to query STK push status" });
  }
});

router.post("/simulate", async (req, res) => {
  try {
    const { phoneNumber, amount, billRefNumber } = req.body;

    if (!phoneNumber || !amount) {
      return res.status(400).json({
        error: "Missing required fields: phoneNumber, amount",
      });
    }

    const result = await mpesaService.simulateC2BPayment(
      phoneNumber,
      amount,
      billRefNumber
    );

    res.json(result);
  } catch (error) {
    console.error("Simulate payment error:", error);
    res.status(500).json({ error: "Failed to simulate payment" });
  }
});

export default router;
