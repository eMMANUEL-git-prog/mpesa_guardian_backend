# M-Pesa Daraja API Setup Guide

This guide walks you through setting up M-Pesa Daraja API integration for M-Pesa Guardian.

## Prerequisites

1. M-Pesa Developer Account at https://developer.safaricom.co.ke/
2. Registered business with Safaricom (for production)

## Step 1: Create Daraja App

1. Go to https://developer.safaricom.co.ke/
2. Sign up or log in to your account
3. Navigate to "My Apps"
4. Click "Create New App"
5. Select the APIs you need:
   - **C2B (Customer to Business)** - For receiving payments
   - **STK Push** - For initiating payment requests
6. Note down your **Consumer Key** and **Consumer Secret**

## Step 2: Configure Environment Variables

Add the following to your `.env` file:

\`\`\`env
# M-Pesa Daraja API Configuration
MPESA_CONSUMER_KEY=your-consumer-key-here
MPESA_CONSUMER_SECRET=your-consumer-secret-here
MPESA_SHORTCODE=174379
MPESA_PASSKEY=your-passkey-here
MPESA_CALLBACK_URL=https://your-domain.com/api/mpesa/callback
MPESA_VALIDATION_URL=https://your-domain.com/api/mpesa/validation
\`\`\`

### Getting Your Credentials:

- **Consumer Key & Secret**: From your Daraja app
- **Shortcode**: Your paybill or till number
- **Passkey**: From Daraja portal under STK Push settings
- **Callback URLs**: Your public server endpoints (use ngrok for testing)

## Step 3: Register Callback URLs

### For Testing (Sandbox):

\`\`\`bash
curl -X POST "http://localhost:3001/api/mpesa/register-urls" \\
  -H "Content-Type: application/json" \\
  -d '{
    "shortCode": "174379",
    "callbackUrl": "https://your-ngrok-url.ngrok.io/api/mpesa/callback",
    "validationUrl": "https://your-ngrok-url.ngrok.io/api/mpesa/validation"
  }'
\`\`\`

### For Production:

Register your production URLs through Safaricom's support or Daraja portal.

## Step 4: Test the Integration

### Option A: Simulate Payment (Sandbox Only)

\`\`\`bash
curl -X POST "http://localhost:3001/api/mpesa/simulate" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phoneNumber": "254712345678",
    "amount": 100,
    "billRefNumber": "TEST001"
  }'
\`\`\`

### Option B: Initiate STK Push

\`\`\`bash
curl -X POST "http://localhost:3001/api/mpesa/stk-push" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phoneNumber": "254712345678",
    "amount": 100,
    "accountReference": "INV001",
    "transactionDesc": "Payment for goods"
  }'
\`\`\`

The customer will receive a payment prompt on their phone.

## Step 5: Handle Callbacks

The system automatically handles M-Pesa callbacks at:

- **Confirmation**: `POST /api/mpesa/callback`
- **Validation**: `POST /api/mpesa/validation`

When a payment is received:
1. Transaction is stored in the database
2. Fraud detection analysis runs automatically
3. Risk score is calculated and stored
4. High-risk transactions are flagged for review

## Sandbox vs Production

### Sandbox (Testing)
- Base URL: `https://sandbox.safaricom.co.ke`
- Test credentials from Daraja portal
- Use simulate endpoints for testing
- No real money involved

### Production
- Base URL: `https://api.safaricom.co.ke`
- Production credentials from Safaricom
- Real M-Pesa transactions
- Requires business verification

Switch between environments using `NODE_ENV`:

\`\`\`env
NODE_ENV=production  # Use production API
NODE_ENV=development # Use sandbox API
\`\`\`

## Troubleshooting

### Common Issues:

1. **Invalid Access Token**
   - Check your Consumer Key and Secret
   - Ensure you're using the correct environment (sandbox/production)

2. **Callback URL Not Reachable**
   - Use ngrok or similar service for local testing
   - Ensure your server is publicly accessible
   - Check firewall settings

3. **Transaction Not Received**
   - Verify callback URLs are registered
   - Check server logs for incoming requests
   - Ensure database is properly configured

4. **STK Push Failed**
   - Verify phone number format (254XXXXXXXXX)
   - Check passkey is correct
   - Ensure shortcode matches your paybill/till number

## Security Best Practices

1. **Never commit credentials** - Use environment variables
2. **Validate callbacks** - Check transaction authenticity
3. **Use HTTPS** - All callback URLs must be HTTPS in production
4. **Implement rate limiting** - Prevent abuse of API endpoints
5. **Log everything** - Keep audit trail of all transactions
6. **Regular monitoring** - Check for suspicious patterns

## Support

For M-Pesa API issues:
- Daraja Support: https://developer.safaricom.co.ke/support
- Email: apisupport@safaricom.co.ke

For M-Pesa Guardian issues:
- Check backend logs
- Review database entries
- Test fraud detection module
\`\`\`
