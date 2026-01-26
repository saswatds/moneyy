# Encore to Standard Go Migration - Complete

This document describes the completed migration from Encore framework to standard Go HTTP API server.

## Migration Summary

Successfully migrated a 7-service Encore application (~6,000 lines) to a modular monolith using standard Go libraries.

### What Changed

- **Framework**: Encore → Standard Go with chi router
- **Database**: Encore sqldb → database/sql with pgx driver
- **Logging**: Encore rlog → standard library log/slog
- **Configuration**: Encore infra.config.json → config.yaml with viper
- **Migrations**: Encore migrations → golang-migrate
- **Architecture**: Microservices → Modular monolith (single binary)

### What Stayed the Same

- All business logic (100% preserved)
- All SQL queries
- All request/response types
- All API endpoints
- Frontend code (only env var for API URL)
- All migration files
- Encryption logic
- External API integrations (Wealthsimple, CBSA)

## Project Structure

```
money/
├── cmd/
│   ├── server/main.go        # HTTP server entry point
│   └── migrate/main.go       # Migration tool
├── internal/
│   ├── account/              # Account service (service.go, mortgage.go, loan.go, asset.go)
│   ├── balance/              # Balance service
│   ├── currency/             # Currency service
│   ├── holdings/             # Holdings service
│   ├── projections/          # Projections service (service.go, events.go)
│   ├── sync/                 # Sync service with encryption & wealthsimple client
│   │   ├── encryption/       # AES-256-GCM encryption
│   │   └── wealthsimple/     # Wealthsimple API client
│   ├── transaction/          # Transaction service
│   ├── server/
│   │   ├── response.go       # HTTP response helpers
│   │   └── handlers/         # HTTP handlers for each service
│   ├── database/
│   │   └── manager.go        # Multi-DB connection pool manager
│   ├── config/
│   │   └── config.go         # Configuration loader
│   └── logger/
│       └── logger.go         # Logging setup
├── migrations/               # Existing migrations (unchanged)
│   ├── account/
│   ├── balance/
│   ├── currency/
│   ├── holdings/
│   ├── projections/
│   ├── sync/
│   └── transaction/
├── frontend/                 # React app (no changes)
├── config.yaml               # Configuration file
├── .env.example              # Environment variables template
├── Dockerfile                # Multi-stage Docker build
├── docker-compose.yml        # Local development setup
└── go.mod                    # Updated dependencies
```

## Dependencies

### Added
- `github.com/go-chi/chi/v5` - HTTP router
- `github.com/go-chi/cors` - CORS middleware
- `github.com/spf13/viper` - Configuration management
- `github.com/golang-migrate/migrate/v4` - Database migrations
- `github.com/joho/godotenv` - .env file support (via viper)

### Kept
- `github.com/jackc/pgx/v5` - PostgreSQL driver
- `github.com/google/uuid` - UUID generation
- `golang.org/x/crypto` - Encryption

### Removed
- `encore.dev` - All Encore dependencies

## Configuration

### config.yaml

```yaml
server:
  port: 4000
  read_timeout: 30s
  write_timeout: 30s

databases:
  account:
    host: "192.168.1.90"
    port: 5432
    name: "account"
    user: "postgres"
    password_env: "DB_PASSWORD"
    max_open_conns: 25
    max_idle_conns: 5
    conn_max_lifetime: 5m
  # ... (7 databases total)

secrets:
  encryption_master_key_env: "ENC_MASTER_KEY"

logging:
  level: "info"
  format: "json"

cors:
  allowed_origins:
    - "http://localhost:5173"
  allowed_methods:
    - "GET"
    - "POST"
    - "PUT"
    - "DELETE"
    - "OPTIONS"
```

### Environment Variables (.env)

```bash
DB_PASSWORD=your_database_password
ENC_MASTER_KEY=your_32_byte_encryption_master_key_here
```

## Running the Application

### Local Development

1. **Set up environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

2. **Run migrations**:
   ```bash
   go run ./cmd/migrate --direction up
   ```

3. **Start the server**:
   ```bash
   go run ./cmd/server
   ```

4. **Start the frontend**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

### Using Docker

1. **Build and run with Docker Compose V2**:
   ```bash
   docker compose up -d --build
   ```

   > **Note**: Use `docker compose` (not `docker-compose`). The old standalone tool is deprecated.

2. **Access the application**:
   - API: http://localhost:4000
   - Frontend: http://localhost:5173
   - Health check: http://localhost:4000/health

3. **Migration Strategy**:
   - The `money-migrate` container runs continuously and watches the `migrations/` directory
   - When you add or modify migration files, it automatically detects changes and runs migrations
   - The API server (`money-api`) never runs migrations - it only serves requests
   - This separation of concerns ensures clean architecture and prevents race conditions

### Production Deployment

1. **Build the Docker image**:
   ```bash
   docker build -t money-api:latest .
   ```

2. **Run the container**:
   ```bash
   docker run -d \
     -p 4000:4000 \
     -e DB_PASSWORD=your_password \
     -e ENC_MASTER_KEY=your_key \
     -v $(pwd)/config.yaml:/app/config.yaml \
     money-api:latest
   ```

## Migration Tool Usage

The migration tool supports granular control over database migrations:

### Migrate all databases up
```bash
go run ./cmd/migrate --direction up
```

### Migrate specific database up
```bash
go run ./cmd/migrate --direction up --db account
```

### Rollback specific database (all steps)
```bash
go run ./cmd/migrate --direction down --db account --steps 0
```

### Rollback specific database (N steps)
```bash
go run ./cmd/migrate --direction down --db account --steps 2
```

## API Endpoints

All endpoints remain the same as before. Here's a summary:

### Account Service
- `POST /accounts` - Create account
- `GET /accounts` - List accounts
- `GET /accounts/with-balance` - List accounts with balances
- `GET /accounts/{id}` - Get account
- `PUT /accounts/{id}` - Update account
- `DELETE /accounts/{id}` - Delete account
- `GET /accounts/summary` - Get account summary
- Mortgage, loan, and asset endpoints under `/accounts/{id}/...`

### Balance Service
- `POST /balances` - Create balance
- `GET /balances/{id}` - Get balance
- `PUT /balances/{id}` - Update balance
- `DELETE /balances/{id}` - Delete balance
- `POST /balances/bulk` - Bulk import
- `GET /accounts/{accountId}/balances` - Get account balances

### Currency Service
- `GET /currency/rates` - Get latest exchange rates

### Holdings Service
- `POST /holdings` - Create holding
- `GET /holdings/{id}` - Get holding
- `PUT /holdings/{id}` - Update holding
- `DELETE /holdings/{id}` - Delete holding
- `GET /accounts/{accountId}/holdings` - Get account holdings

### Projections Service
- `POST /projections/calculate` - Calculate projections
- `POST /projections/scenarios` - Save scenario
- `GET /projections/scenarios` - List scenarios
- `GET /projections/scenarios/{id}` - Get scenario
- `PUT /projections/scenarios/{id}` - Update scenario
- `DELETE /projections/scenarios/{id}` - Delete scenario

### Sync Service
- `POST /sync/wealthsimple/initiate` - Initiate connection
- `POST /sync/wealthsimple/verify-otp` - Verify OTP
- `GET /sync/connections` - List connections
- `GET /sync/connections/{id}` - Get connection
- `POST /sync/connections/{id}/sync` - Trigger sync
- `DELETE /sync/connections/{id}` - Delete connection

### Transaction Service
- `POST /transactions/recurring` - Create recurring expense
- `GET /transactions/recurring` - List recurring expenses
- `GET /transactions/recurring/{id}` - Get recurring expense
- `PUT /transactions/recurring/{id}` - Update recurring expense
- `DELETE /transactions/recurring/{id}` - Delete recurring expense

## Testing

### Health Check
```bash
curl http://localhost:4000/health
```

### Sample API Call
```bash
# Create an account
curl -X POST http://localhost:4000/accounts \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Checking Account",
    "type": "checking",
    "currency": "CAD",
    "institution": "TD Bank",
    "is_asset": true
  }'

# List accounts
curl http://localhost:4000/accounts

# Get currency rates
curl http://localhost:4000/currency/rates
```

## Troubleshooting

### Database Connection Issues
- Verify database credentials in .env
- Check that all 7 databases exist on PostgreSQL server
- Ensure network connectivity to 192.168.1.90:5432

### Migration Failures
- Check migration files in migrations/ directories
- Verify database user has CREATE/ALTER permissions
- Run migrations one database at a time for debugging

### Build Errors
- Run `go mod tidy` to ensure all dependencies are downloaded
- Check Go version (requires Go 1.24+)

## Old Code

The original Encore service directories have been renamed with `_old_` prefix for reference:
- `_old_account/`
- `_old_balance/`
- `_old_currency/`
- `_old_holdings/`
- `_old_projections/`
- `_old_sync/`
- `_old_transaction/`

These can be removed once the migration is verified to be working correctly.

## Next Steps

1. **Add authentication**: Replace `"temp-user-id"` with JWT middleware
2. **Error standardization**: Implement consistent error response format
3. **Rate limiting**: Add middleware if needed for production
4. **Observability**: Add metrics (Prometheus) and tracing (OpenTelemetry)
5. **Testing**: Port existing tests to new structure
6. **Documentation**: Generate OpenAPI/Swagger documentation

## Benefits

- ✅ Single binary deployment
- ✅ No vendor lock-in
- ✅ Standard Go patterns
- ✅ Easier debugging
- ✅ Lower complexity
- ✅ Same functionality
- ✅ No frontend changes
- ✅ Clean dependency injection
- ✅ Modular architecture
