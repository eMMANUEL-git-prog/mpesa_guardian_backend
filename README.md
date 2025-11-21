# M-Pesa Guardian Backend

Express.js backend API for M-Pesa Guardian fraud detection system.

## Setup

1. Install dependencies:
\`\`\`bash
cd backend
npm install
\`\`\`

2. Configure environment variables:
\`\`\`bash
cp .env.example .env
# Edit .env with your database credentials and M-Pesa API keys
\`\`\`

3. Run database migrations:
\`\`\`bash
# Execute the SQL scripts in the scripts/ folder in your PostgreSQL database
\`\`\`

4. Start the server:
\`\`\`bash
npm run dev
\`\`\`

The API will be available at `http://localhost:3001`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login

### Transactions
- `GET /api/transactions` - Get all transactions
- `GET /api/transactions/:id` - Get single transaction
- `GET /api/transactions/search` - Search transactions

### Fraud Detection
- `GET /api/fraud/flagged` - Get flagged transactions
- `POST /api/fraud/review/:id` - Review fraud alert
- `GET /api/fraud/stats` - Get fraud statistics

### Dashboard
- `GET /api/dashboard/overview` - Get dashboard overview
- `GET /api/dashboard/recent` - Get recent transactions
- `GET /api/dashboard/top-customers` - Get top customers

### M-Pesa Integration
- `POST /api/mpesa/callback` - M-Pesa C2B callback
- `POST /api/mpesa/validation` - M-Pesa validation endpoint
- `POST /api/mpesa/register-urls` - Register callback URLs

## Environment Variables

- `PORT` - Server port (default: 3001)
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret key for JWT tokens
- `MPESA_CONSUMER_KEY` - M-Pesa API consumer key
- `MPESA_CONSUMER_SECRET` - M-Pesa API consumer secret
- `MPESA_SHORTCODE` - Your M-Pesa paybill/till number
- `MPESA_PASSKEY` - M-Pesa API passkey
