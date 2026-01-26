# Moneyy Architecture

## Overview

Moneyy is a personal finance management application built with a Go backend and React frontend, deployed as a single container in production.

## Technology Stack

### Backend
- **Language**: Go 1.24
- **Framework**: Chi router (lightweight HTTP router)
- **Database**: PostgreSQL 16
- **Migrations**: golang-migrate
- **Logging**: slog (Go standard library)

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **UI**: Tailwind CSS
- **Charts**: Recharts

## Architecture Pattern

### Development
- **3 containers**: Separate frontend (Vite), API (Go), and database (PostgreSQL)
- Hot reload enabled for both frontend and backend
- Frontend served on port 5173, API on port 4000

### Production
- **2 containers**: Single app container (Go serves both API + frontend static files) + database
- Frontend built as static assets and embedded in Go binary
- Single deployment artifact - one Docker image
- All traffic goes through Go server on port 4000

## Request Flow

### Development
```
Browser → localhost:5173 (Vite Dev Server) → /api → localhost:4000 (Go API)
```

### Production
```
Browser → :4000 (Go Server)
  ├── /api/* → API handlers
  ├── /assets/* → Static assets (JS, CSS)
  └── /* → index.html (SPA fallback)
```

## Project Structure

```
money/
├── cmd/
│   ├── server/          # HTTP server entry point
│   └── migrate/         # Database migration tool
├── internal/
│   ├── account/         # Account management
│   ├── balance/         # Balance tracking
│   ├── currency/        # Currency exchange
│   ├── holdings/        # Investment holdings
│   ├── projections/     # Financial projections
│   ├── sync/            # External sync (Wealthsimple)
│   ├── transaction/     # Recurring transactions
│   ├── database/        # Database manager
│   ├── env/             # Environment config
│   ├── logger/          # Logging utilities
│   └── server/
│       └── handlers/    # HTTP request handlers
├── frontend/
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── pages/       # Page components
│   │   ├── lib/         # Utilities & API client
│   │   └── main.tsx     # Entry point
│   └── dist/            # Build output (production)
├── migrations/          # Database migrations
├── scripts/             # Utility scripts
├── backups/             # Database backups
├── Dockerfile           # Production multi-stage build
├── Dockerfile.dev       # Development with hot reload
├── docker-compose.yml   # Development stack
└── docker-compose.prod.yml # Production stack
```

## Database Schema

Single PostgreSQL database named `moneyy` with tables:

- **accounts** - Bank accounts, assets, liabilities
- **balances** - Historical balance snapshots
- **holdings** - Investment holdings
- **transactions** - Recurring transactions
- **currencies** - Exchange rates
- **asset_details** - Asset metadata (depreciation, etc.)
- **mortgage_details** - Mortgage information
- **loan_details** - Loan information
- **projections** - Saved projection scenarios
- **sync_connections** - External service connections
- **schema_migrations** - Migration tracking

## API Endpoints

All API endpoints are prefixed with `/api`:

### Accounts
- `GET /api/accounts` - List all accounts
- `POST /api/accounts` - Create account
- `GET /api/accounts/{id}` - Get account details
- `PUT /api/accounts/{id}` - Update account
- `DELETE /api/accounts/{id}` - Delete account
- `GET /api/accounts-with-balance` - Accounts with latest balances
- `GET /api/summary/accounts` - Account summary statistics

### Balances
- `POST /api/balances` - Create balance entry
- `GET /api/balances/{id}` - Get balance
- `PUT /api/balances/{id}` - Update balance
- `DELETE /api/balances/{id}` - Delete balance
- `GET /api/account-balances/{accountId}` - Get account balances

### Holdings
- `POST /api/holdings` - Create holding
- `GET /api/holdings/{id}` - Get holding
- `PUT /api/holdings/{id}` - Update holding
- `DELETE /api/holdings/{id}` - Delete holding
- `GET /api/account-holdings/{accountId}` - Get account holdings

### Currencies
- `GET /api/currencies` - List currencies
- `GET /api/currency/rates` - Get exchange rates
- `POST /api/currency/rates` - Update rates

### Projections
- `POST /api/projections/calculate` - Calculate projection
- `POST /api/projections/scenarios` - Save scenario
- `GET /api/projections/scenarios` - List scenarios
- `DELETE /api/projections/scenarios/{id}` - Delete scenario

### Transactions
- `GET /api/recurring-expenses` - List recurring expenses
- `POST /api/recurring-expenses` - Create recurring expense
- `GET /api/recurring-expenses/{id}` - Get expense
- `PUT /api/recurring-expenses/{id}` - Update expense
- `DELETE /api/recurring-expenses/{id}` - Delete expense

### Sync
- `GET /api/sync/connections` - List connections
- `POST /api/sync/wealthsimple/connect` - Connect Wealthsimple
- `POST /api/sync/wealthsimple/sync` - Sync data

### Assets
- `GET /api/assets/summary` - Asset summary with valuations
- `POST /api/accounts/{id}/asset` - Create asset details
- `GET /api/accounts/{id}/asset` - Get asset details
- `GET /api/accounts/{id}/asset/depreciation-schedule` - Depreciation schedule

### Mortgages
- `POST /api/accounts/{id}/mortgage` - Create mortgage
- `GET /api/accounts/{id}/mortgage` - Get mortgage
- `GET /api/accounts/{id}/mortgage/amortization` - Amortization schedule

### Loans
- `POST /api/accounts/{id}/loan` - Create loan
- `GET /api/accounts/{id}/loan` - Get loan
- `GET /api/accounts/{id}/loan/amortization` - Amortization schedule

### Health
- `GET /api/health` - API health check

## Deployment

### Development

```bash
# Start entire stack
make dev

# Or manually
docker compose up -d

# View logs
make logs

# Stop
make stop
```

Services:
- Frontend: http://localhost:5173
- API: http://localhost:4000
- Database: localhost:5432

### Production

```bash
# Pull latest image
docker pull ghcr.io/saswat/moneyy:latest

# Start stack
docker compose -f docker-compose.prod.yml up -d

# View logs
docker compose -f docker-compose.prod.yml logs -f

# Stop
docker compose -f docker-compose.prod.yml down
```

Services:
- App (Frontend + API): http://localhost:4000
- Database: localhost:5432

## Build & Publish

```bash
# Build production image
make build

# Login to GitHub Container Registry
make registry-login

# Push to registry
make push

# Or build and push together
make build-push
```

## Environment Variables

### Required
- `DB_PASSWORD` - Database password
- `ENC_MASTER_KEY` - Encryption key for sensitive data (32-byte base64)

### Optional
- `DB_HOST` - Database host (default: localhost)
- `DB_PORT` - Database port (default: 5432)
- `DB_NAME` - Database name (default: moneyy)
- `DB_USER` - Database user (default: postgres)
- `SERVER_PORT` - Server port (default: 4000)
- `LOG_LEVEL` - Logging level (default: info)
- `LOG_FORMAT` - Log format (default: json)
- `CORS_ORIGINS` - CORS allowed origins (default: *)

## Security Features

- **Encryption**: Sensitive data encrypted at rest using AES-256-GCM
- **CORS**: Configurable CORS policy
- **Environment-based secrets**: No hardcoded credentials
- **Health checks**: All containers have health checks
- **Read-only mounts**: Sensitive files mounted as read-only in production

## Migration Strategy

Database migrations are handled by a separate watcher service:
- Watches `migrations/` directory for changes
- Automatically applies new migrations
- Runs continuously in background
- Logs all migration activity

Manual migration:
```bash
docker compose exec migrate ./migrate --direction up
```

## Monitoring

### Health Checks
- API: `GET /api/health`
- Database: `pg_isready`

### Logs
```bash
# All logs
docker compose logs -f

# Specific service
docker compose logs -f app
docker compose logs -f postgres
docker compose logs -f migrate
```

### Database Backups
```bash
# Create backup
./scripts/backup-db.sh

# Restore backup
./scripts/restore-backup.sh backups/backup_YYYYMMDD_HHMMSS.sql
```

## Performance

### Frontend
- Code splitting with Vite
- Tree shaking
- Asset optimization
- Gzip compression
- Static asset caching (1 year)

### Backend
- Connection pooling
- Prepared statements
- Index optimization
- Health check caching

### Database
- Indexed queries
- Materialized views for summaries
- Partitioning for historical data (future)

## Future Enhancements

- [ ] JWT authentication
- [ ] Role-based access control
- [ ] Multi-user support
- [ ] API rate limiting
- [ ] Metrics (Prometheus)
- [ ] Distributed tracing (OpenTelemetry)
- [ ] Automated database backups
- [ ] Horizontal scaling support
- [ ] Redis caching layer
