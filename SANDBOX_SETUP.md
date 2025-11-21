# M-Pesa Daraja API Sandbox Setup Guide

This guide will help you set up and test the M-Pesa Guardian application using the Safaricom Daraja API sandbox environment.

## Prerequisites

1. A Safaricom Developer Account
2. Node.js and npm installed
3. PostgreSQL database running
4. ngrok or similar tunneling service for local development

## Step 1: Create Daraja API Sandbox App

1. Go to https://developer.safaricom.co.ke/
2. Sign up or log in to your account
3. Click on "My Apps" and create a new app
4. Select the following APIs:
   - M-Pesa Sandbox
   - Lipa Na M-Pesa Online (STK Push)
   - C2B
5. Note down your **Consumer Key** and **Consumer Secret**

## Step 2: Configure Sandbox Credentials

The sandbox environment uses test credentials:

- **Shortcode**: `174379` (Test business short code)
- **Passkey**: `bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919`
- **Test Phone Numbers**: Use format `254708374149` (any 254... number works in sandbox)

Update your `.env` file:

\`\`\`env
MPESA_CONSUMER_KEY=your_consumer_key_here
MPESA_CONSUMER_SECRET=your_consumer_secret_here
MPESA_SHORTCODE=174379
MPESA_PASSKEY=bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919
\`\`\`

## Step 3: Set Up Callback URLs with ngrok

M-Pesa requires publicly accessible callback URLs. Use ngrok to expose your local server:

1. Install ngrok: https://ngrok.com/download
2. Start your backend server:
   \`\`\`bash
   cd backend
   npm install
   npm start
   \`\`\`
3. In a new terminal, start ngrok:
   \`\`\`bash
   ngrok http 3001
   \`\`\`
4. Copy the ngrok URL (e.g., `https://abc123.ngrok.io`)
5. Update your `.env` file:
   \`\`\`env
   MPESA_CALLBACK_URL=https://abc123.ngrok.io/api/mpesa/callback
   MPESA_VALIDATION_URL=https://abc123.ngrok.io/api/mpesa/validation
   \`\`\`

## Step 4: Register C2B URLs

Before receiving payments, you must register your callback URLs:

\`\`\`bash
curl -X POST http://localhost:3001/api/mpesa/register-urls
\`\`\`

Expected response:
\`\`\`json
{
"OriginatorCoversationID": "...",
"ResponseCode": "0",
"ResponseDescription": "Success"
}
\`\`\`

## Step 5: Test STK Push

Test the Lipa Na M-Pesa Online (STK Push) functionality:

\`\`\`bash
curl -X POST http://localhost:3001/api/mpesa/stk-push \
 -H "Content-Type: application/json" \
 -d '{
"phone_number": "254708374149",
"amount": 100,
"account_reference": "TEST001",
"transaction_desc": "Test Payment"
}'
\`\`\`

Expected response:
\`\`\`json
{
"MerchantRequestID": "...",
"CheckoutRequestID": "...",
"ResponseCode": "0",
"ResponseDescription": "Success. Request accepted for processing"
}
\`\`\`

## Step 6: Test C2B Payment Simulation

Simulate a customer payment to your business:

\`\`\`bash
curl -X POST http://localhost:3001/api/mpesa/simulate \
 -H "Content-Type: application/json" \
 -d '{
"phone_number": "254708374149",
"amount": 100,
"bill_ref_number": "TESTREF001"
}'
\`\`\`

## Step 7: Frontend Setup

1. Create a `.env.local` file in the root directory:
   \`\`\`env
   NEXT_PUBLIC_API_URL=http://localhost:3001/api
   \`\`\`

2. Start the frontend:
   \`\`\`bash
   npm install
   npm run dev
   \`\`\`

3. Visit http://localhost:3000 and register an account

## Testing Flow

1. **Register User & Business**

   - Go to http://localhost:3000/register
   - Fill in user details
   - Complete business profile with your Till/Paybill numbers

2. **Simulate Payment**

   - Use the API endpoint or create a test page to trigger payments
   - Check the dashboard for real-time updates

3. **View Fraud Analysis**
   - Transactions are automatically analyzed
   - Check fraud alerts in the dashboard
   - Review risk scores and patterns

## Sandbox Limitations

- Payments are simulated and no real money is involved
- Limited to test phone numbers
- Some features may not work exactly as in production
- Rate limits may apply

## Common Issues

### Issue: "Invalid Access Token"

**Solution**: Check your Consumer Key and Consumer Secret are correct

### Issue: "Callback URL not reachable"

**Solution**: Ensure ngrok is running and the URL is correctly set in .env

### Issue: "Transaction failed"

**Solution**: Verify you're using the correct sandbox shortcode (174379) and passkey

## Moving to Production

When ready for production:

1. Create a production app in Daraja Portal
2. Get production credentials
3. Update `.env` with production credentials
4. Set `NODE_ENV=production`
5. Use your actual business shortcode
6. Register production callback URLs
7. Test thoroughly before going live

## Support

- Daraja API Documentation: https://developer.safaricom.co.ke/docs
- M-Pesa Guardian Issues: Check your application logs
- Contact Safaricom Developer Support for API issues
