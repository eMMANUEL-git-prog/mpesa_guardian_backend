import https from "https"
import dotenv from "dotenv"

dotenv.config()

/**
 * M-Pesa Daraja API Service
 * Handles authentication and API requests to Safaricom's Daraja API
 */

class MpesaService {
  constructor() {
    this.consumerKey = process.env.MPESA_CONSUMER_KEY
    this.consumerSecret = process.env.MPESA_CONSUMER_SECRET
    this.shortCode = process.env.MPESA_SHORTCODE
    this.passkey = process.env.MPESA_PASSKEY
    this.callbackUrl = process.env.MPESA_CALLBACK_URL
    this.validationUrl = process.env.MPESA_VALIDATION_URL
    this.baseUrl =
      process.env.NODE_ENV === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke"
    this.accessToken = null
    this.tokenExpiry = null
  }

  /**
   * Get OAuth access token
   */
  async getAccessToken() {
    // Return cached token if still valid
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken
    }

    return new Promise((resolve, reject) => {
      const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString("base64")

      const options = {
        hostname: this.baseUrl.replace("https://", ""),
        path: "/oauth/v1/generate?grant_type=client_credentials",
        method: "GET",
        headers: {
          Authorization: `Basic ${auth}`,
        },
      }

      const req = https.request(options, (res) => {
        let data = ""

        res.on("data", (chunk) => {
          data += chunk
        })

        res.on("end", () => {
          try {
            const response = JSON.parse(data)

            if (response.access_token) {
              this.accessToken = response.access_token
              // Token expires in 1 hour, cache for 55 minutes
              this.tokenExpiry = Date.now() + 55 * 60 * 1000
              resolve(this.accessToken)
            } else {
              reject(new Error("Failed to get access token"))
            }
          } catch (error) {
            reject(error)
          }
        })
      })

      req.on("error", (error) => {
        reject(error)
      })

      req.end()
    })
  }

  /**
   * Register C2B URLs for validation and confirmation
   */
  async registerUrls() {
    try {
      const token = await this.getAccessToken()

      const payload = {
        ShortCode: this.shortCode,
        ResponseType: "Completed", // or 'Cancelled'
        ConfirmationURL: this.callbackUrl,
        ValidationURL: this.validationUrl,
      }

      return new Promise((resolve, reject) => {
        const postData = JSON.stringify(payload)

        const options = {
          hostname: this.baseUrl.replace("https://", ""),
          path: "/mpesa/c2b/v1/registerurl",
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(postData),
          },
        }

        const req = https.request(options, (res) => {
          let data = ""

          res.on("data", (chunk) => {
            data += chunk
          })

          res.on("end", () => {
            try {
              const response = JSON.parse(data)
              resolve(response)
            } catch (error) {
              reject(error)
            }
          })
        })

        req.on("error", (error) => {
          reject(error)
        })

        req.write(postData)
        req.end()
      })
    } catch (error) {
      console.error("Error registering URLs:", error)
      throw error
    }
  }

  /**
   * Simulate C2B payment (for testing in sandbox)
   */
  async simulateC2BPayment(phoneNumber, amount, billRefNumber) {
    try {
      const token = await this.getAccessToken()

      const payload = {
        ShortCode: this.shortCode,
        CommandID: "CustomerPayBillOnline",
        Amount: amount,
        Msisdn: phoneNumber,
        BillRefNumber: billRefNumber || "TestPayment",
      }

      return new Promise((resolve, reject) => {
        const postData = JSON.stringify(payload)

        const options = {
          hostname: this.baseUrl.replace("https://", ""),
          path: "/mpesa/c2b/v1/simulate",
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(postData),
          },
        }

        const req = https.request(options, (res) => {
          let data = ""

          res.on("data", (chunk) => {
            data += chunk
          })

          res.on("end", () => {
            try {
              const response = JSON.parse(data)
              resolve(response)
            } catch (error) {
              reject(error)
            }
          })
        })

        req.on("error", (error) => {
          reject(error)
        })

        req.write(postData)
        req.end()
      })
    } catch (error) {
      console.error("Error simulating payment:", error)
      throw error
    }
  }

  /**
   * STK Push (Lipa Na M-Pesa Online)
   * Initiates payment request to customer's phone
   */
  async stkPush(phoneNumber, amount, accountReference, transactionDesc) {
    try {
      const token = await this.getAccessToken()
      const timestamp = new Date()
        .toISOString()
        .replace(/[-:TZ.]/g, "")
        .substring(0, 14)
      const password = Buffer.from(`${this.shortCode}${this.passkey}${timestamp}`).toString("base64")

      const payload = {
        BusinessShortCode: this.shortCode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: amount,
        PartyA: phoneNumber,
        PartyB: this.shortCode,
        PhoneNumber: phoneNumber,
        CallBackURL: this.callbackUrl,
        AccountReference: accountReference,
        TransactionDesc: transactionDesc || "Payment",
      }

      return new Promise((resolve, reject) => {
        const postData = JSON.stringify(payload)

        const options = {
          hostname: this.baseUrl.replace("https://", ""),
          path: "/mpesa/stkpush/v1/processrequest",
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(postData),
          },
        }

        const req = https.request(options, (res) => {
          let data = ""

          res.on("data", (chunk) => {
            data += chunk
          })

          res.on("end", () => {
            try {
              const response = JSON.parse(data)
              resolve(response)
            } catch (error) {
              reject(error)
            }
          })
        })

        req.on("error", (error) => {
          reject(error)
        })

        req.write(postData)
        req.end()
      })
    } catch (error) {
      console.error("Error initiating STK push:", error)
      throw error
    }
  }

  /**
   * Query STK Push transaction status
   */
  async queryStkPushStatus(checkoutRequestId) {
    try {
      const token = await this.getAccessToken()
      const timestamp = new Date()
        .toISOString()
        .replace(/[-:TZ.]/g, "")
        .substring(0, 14)
      const password = Buffer.from(`${this.shortCode}${this.passkey}${timestamp}`).toString("base64")

      const payload = {
        BusinessShortCode: this.shortCode,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId,
      }

      return new Promise((resolve, reject) => {
        const postData = JSON.stringify(payload)

        const options = {
          hostname: this.baseUrl.replace("https://", ""),
          path: "/mpesa/stkpushquery/v1/query",
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(postData),
          },
        }

        const req = https.request(options, (res) => {
          let data = ""

          res.on("data", (chunk) => {
            data += chunk
          })

          res.on("end", () => {
            try {
              const response = JSON.parse(data)
              resolve(response)
            } catch (error) {
              reject(error)
            }
          })
        })

        req.on("error", (error) => {
          reject(error)
        })

        req.write(postData)
        req.end()
      })
    } catch (error) {
      console.error("Error querying STK push status:", error)
      throw error
    }
  }
}

// Export singleton instance
export default new MpesaService()
