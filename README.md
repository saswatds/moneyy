# 💰 Moneyy - Take Control of Your Finances

**Your financial data belongs to you. Host it yourself.**

Money is a modern, self-hosted personal finance management platform that gives you complete control over your financial data. No third-party services, no data selling, no privacy concerns—just you and your money.

## Why Moneyy?

**Privacy First** - Your financial data never leaves your server. No third parties, no tracking, no compromises.

**Complete Control** - Own your data, customize everything, and keep your financial information secure on your own terms.

**Free Forever** - No subscriptions, no premium tiers, no hidden costs. Deploy once and use forever.

**Open Source** - Transparent codebase you can audit, modify, and trust.

## Features

- **Account Management** - Create and track all your financial accounts with balance history charts and multi-currency support (CAD, USD, INR)
- **Mortgage Tracking** - Setup mortgages, record payments, view amortization schedules, and track extra payments
- **Loan Management** - Track personal loans with payment schedules and interest calculations
- **Asset Tracking** - Monitor real estate, vehicles, collectibles, and equipment with automatic or manual depreciation
- **Recurring Expenses** - Manage weekly to annual recurring expenses with categorization (housing, utilities, transportation, and more)
- **Financial Projections** - Advanced forecasting with tax brackets, inflation rates, salary growth, and investment returns across TFSA, RRSP, and brokerage accounts
- **Data Integrations** - Connect your Wealthsimple account for automatic syncing (Plaid, Stripe, PayPal coming soon)
- **Multi-Currency** - Automatic exchange rate conversion across all accounts
- **Passkey Authentication** - Passwordless, secure login using WebAuthn technology

## Deployment

**Prerequisites:** Docker with Compose plugin installed

**1. Clone the repository**

```bash
git clone https://github.com/saswatds/moneyy.git
cd moneyy
```

**2. Create environment file**

Copy the example and configure:

```bash
cp .env.prod.example .env.prod
```

Edit `.env.prod` with your values:

```bash
# REQUIRED - Database password
DB_PASSWORD=your_secure_production_password_here

# REQUIRED - Generate secure keys
ENC_MASTER_KEY=your_production_encryption_key_here
JWT_SECRET=your_production_jwt_secret_min_32_chars_here

# REQUIRED - WebAuthn settings
WEBAUTHN_RP_ID=localhost
WEBAUTHN_RP_ORIGIN=http://localhost:4000

# Optional - CORS origins
CORS_ORIGINS=http://localhost:4000

# Optional - Docker image version (default: latest)
VERSION=latest
```

Generate secure keys:
```bash
openssl rand -base64 32  # Use for ENC_MASTER_KEY
openssl rand -base64 32  # Use for JWT_SECRET
```

**3. Deploy**

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

Your instance will be available at `http://localhost:4000`

---

## License

Copyright (c) 2026 Noob Ventures

Licensed under the [PolyForm Noncommercial License 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0).

This software is free to use for personal and noncommercial purposes. Commercial use requires a separate license. See [LICENSE](LICENSE) for full terms.
