# Migration Verification Checklist

Use this checklist to verify that the migration from Encore to standard Go is working correctly.

## ✅ Build Verification

- [x] Server binary compiles: `go build ./cmd/server`
- [x] Migrate binary compiles: `go build ./cmd/migrate`
- [x] All packages compile: `go build ./...`
- [x] No import errors
- [x] go.mod dependencies resolved

## Database Connectivity

Test database connections to all 7 databases:

```bash
# Start the server (it will test connections on startup)
go run ./cmd/server
```

Expected output:
```
INFO: Connected to database name=account host=192.168.1.90
INFO: Connected to database name=balance host=192.168.1.90
INFO: Connected to database name=currency host=192.168.1.90
INFO: Connected to database name=holdings host=192.168.1.90
INFO: Connected to database name=projections host=192.168.1.90
INFO: Connected to database name=sync host=192.168.1.90
INFO: Connected to database name=transaction host=192.168.1.90
```

- [ ] All 7 databases connect successfully
- [ ] No connection errors
- [ ] Connection pool configured correctly

## Migrations

Test that migrations apply successfully:

```bash
# Run all migrations
go run ./cmd/migrate --direction up
```

Expected output:
```
INFO: Migrations completed database=account
INFO: Migrations completed database=balance
INFO: Migrations completed database=currency
INFO: Migrations completed database=holdings
INFO: Migrations completed database=projections
INFO: Migrations completed database=sync
INFO: Migrations completed database=transaction
```

- [ ] All migrations apply without errors
- [ ] No duplicate migration issues
- [ ] Schema matches expected structure

## Health Check

Test the health check endpoint:

```bash
curl http://localhost:4000/health
```

Expected response:
```json
{"status":"ok"}
```

- [ ] Health endpoint returns 200 OK
- [ ] JSON response is valid

## API Endpoints Testing

### Account Service

```bash
# Create account
curl -X POST http://localhost:4000/accounts \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Checking",
    "type": "checking",
    "currency": "CAD",
    "institution": "Test Bank",
    "is_asset": true
  }'

# List accounts
curl http://localhost:4000/accounts

# List accounts with balance
curl http://localhost:4000/accounts/with-balance

# Get account summary
curl http://localhost:4000/accounts/summary

# Get specific account (use ID from create response)
curl http://localhost:4000/accounts/{account_id}

# Update account
curl -X PUT http://localhost:4000/accounts/{account_id} \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Name"}'

# Delete account
curl -X DELETE http://localhost:4000/accounts/{account_id}
```

- [ ] POST /accounts creates account successfully
- [ ] GET /accounts returns list
- [ ] GET /accounts/with-balance returns accounts with balances
- [ ] GET /accounts/summary returns correct counts
- [ ] GET /accounts/{id} returns specific account
- [ ] PUT /accounts/{id} updates account
- [ ] DELETE /accounts/{id} deletes account

### Balance Service

```bash
# Create balance
curl -X POST http://localhost:4000/balances \
  -H "Content-Type: application/json" \
  -d '{
    "account_id": "{account_id}",
    "amount": 1000.50,
    "date": "2026-01-25T00:00:00Z",
    "notes": "Initial balance"
  }'

# Get account balances
curl http://localhost:4000/accounts/{account_id}/balances

# Bulk import
curl -X POST http://localhost:4000/balances/bulk \
  -H "Content-Type: application/json" \
  -d '{
    "entries": [
      {"account_id": "{account_id}", "amount": 1000, "date": "2026-01-01T00:00:00Z"},
      {"account_id": "{account_id}", "amount": 1100, "date": "2026-01-15T00:00:00Z"}
    ]
  }'
```

- [ ] POST /balances creates balance successfully
- [ ] GET /accounts/{id}/balances returns balance history
- [ ] POST /balances/bulk imports multiple balances
- [ ] Balances appear in accounts-with-balance endpoint

### Currency Service

```bash
# Get latest exchange rates
curl http://localhost:4000/currency/rates
```

Expected response structure:
```json
{
  "rates": {
    "CAD": {"USD": 0.73, "INR": 61.5, "CAD": 1.0},
    "USD": {"CAD": 1.37, "INR": 84.2, "USD": 1.0},
    "INR": {"CAD": 0.016, "USD": 0.012, "INR": 1.0}
  },
  "date": "2026-01-25T00:00:00Z"
}
```

- [ ] GET /currency/rates returns exchange rates
- [ ] All currency pairs present (CAD, USD, INR)
- [ ] Identity rates are 1.0 (e.g., CAD→CAD = 1.0)
- [ ] Rates sync from CBSA API if not present for today

### Holdings Service

```bash
# Create holding
curl -X POST http://localhost:4000/holdings \
  -H "Content-Type: application/json" \
  -d '{
    "account_id": "{account_id}",
    "type": "stock",
    "symbol": "AAPL",
    "quantity": 10,
    "cost_basis": 1500.00,
    "purchase_date": "2026-01-01"
  }'

# Get account holdings
curl http://localhost:4000/accounts/{account_id}/holdings
```

- [ ] POST /holdings creates holding successfully
- [ ] GET /accounts/{id}/holdings returns holdings list
- [ ] Holding data is correct (symbol, quantity, cost_basis)

### Projections Service

```bash
# Calculate projections
curl -X POST http://localhost:4000/projections/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "annual_salary": 80000,
    "annual_salary_growth": 0.03,
    "monthly_expenses": 3000,
    "annual_expense_growth": 0.02,
    "monthly_savings_rate": 0.20,
    "projection_years": 10
  }'

# Save scenario
curl -X POST http://localhost:4000/projections/scenarios \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Base Case",
    "description": "Conservative projection",
    "config": {
      "annual_salary": 80000,
      "projection_years": 10
    }
  }'

# List scenarios
curl http://localhost:4000/projections/scenarios
```

- [ ] POST /projections/calculate returns projection data
- [ ] Projection includes monthly breakdown
- [ ] Tax calculations are correct
- [ ] Amortization calculations for debts work
- [ ] POST /projections/scenarios saves scenario
- [ ] GET /projections/scenarios lists scenarios

### Sync Service

```bash
# Initiate Wealthsimple connection
curl -X POST http://localhost:4000/sync/wealthsimple/initiate \
  -H "Content-Type: application/json" \
  -d '{
    "username": "test@example.com",
    "password": "password123"
  }'

# List connections
curl http://localhost:4000/sync/connections
```

- [ ] POST /sync/wealthsimple/initiate initiates connection
- [ ] Credentials are encrypted before storage
- [ ] GET /sync/connections lists connections
- [ ] Connection status is tracked correctly

### Transaction Service

```bash
# Create recurring expense
curl -X POST http://localhost:4000/transactions/recurring \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Netflix Subscription",
    "amount": 15.99,
    "currency": "CAD",
    "category": "Entertainment",
    "frequency": "monthly",
    "day_of_month": 1
  }'

# List recurring expenses
curl http://localhost:4000/transactions/recurring
```

- [ ] POST /transactions/recurring creates expense
- [ ] GET /transactions/recurring lists expenses
- [ ] Recurring expense data is correct

## Cross-Service Integration

Test that services work together correctly:

### Account + Balance Integration

```bash
# 1. Create account
ACCOUNT_ID=$(curl -s -X POST http://localhost:4000/accounts \
  -H "Content-Type: application/json" \
  -d '{"name":"Integration Test","type":"checking","currency":"CAD","is_asset":true}' \
  | jq -r '.id')

# 2. Add balance
curl -X POST http://localhost:4000/balances \
  -H "Content-Type: application/json" \
  -d "{\"account_id\":\"$ACCOUNT_ID\",\"amount\":5000,\"date\":\"2026-01-25T00:00:00Z\"}"

# 3. Verify account shows balance
curl http://localhost:4000/accounts/with-balance | jq ".accounts[] | select(.id==\"$ACCOUNT_ID\")"
```

- [ ] Account created successfully
- [ ] Balance added to account
- [ ] Account with balance shows correct amount

### Account + Holdings Integration

```bash
# Create brokerage account and add holdings
BROKERAGE_ID=$(curl -s -X POST http://localhost:4000/accounts \
  -H "Content-Type: application/json" \
  -d '{"name":"Brokerage","type":"brokerage","currency":"CAD","is_asset":true}' \
  | jq -r '.id')

curl -X POST http://localhost:4000/holdings \
  -H "Content-Type: application/json" \
  -d "{\"account_id\":\"$BROKERAGE_ID\",\"type\":\"stock\",\"symbol\":\"AAPL\",\"quantity\":10,\"cost_basis\":1500}"

curl http://localhost:4000/accounts/$BROKERAGE_ID/holdings
```

- [ ] Holdings associated with correct account
- [ ] Holdings query returns data

### Projections + Account + Transaction Integration

```bash
# Create mortgage and recurring expenses, then run projection
curl -X POST http://localhost:4000/projections/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "annual_salary": 100000,
    "projection_years": 5
  }'
```

- [ ] Projection includes existing accounts
- [ ] Projection includes recurring expenses
- [ ] Mortgage amortization calculated correctly
- [ ] Net worth progression makes sense

## Encryption Verification

Test that encryption works for sensitive data:

```bash
# Check that credentials are encrypted in database
# Connect to sync database and verify credentials table
psql -h 192.168.1.90 -U postgres -d sync -c "SELECT id, username, encrypted_password FROM credentials LIMIT 1;"
```

- [ ] Credentials are stored encrypted (not plaintext)
- [ ] Encryption key from environment variable is used
- [ ] Decryption works when needed

## Frontend Integration

1. Start the frontend:
```bash
cd frontend
npm install
npm run dev
```

2. Test in browser:
- [ ] Frontend loads at http://localhost:5173
- [ ] API calls succeed
- [ ] Accounts page loads and displays data
- [ ] Balances page loads and displays data
- [ ] Projections page loads and displays data
- [ ] Can create/update/delete accounts
- [ ] No CORS errors in browser console

## Docker Build

Test Docker build:

```bash
# Build image
docker build -t money-api:test .

# Run container
docker run -d -p 4000:4000 \
  -e DB_PASSWORD=your_password \
  -e ENC_MASTER_KEY=your_key \
  --name money-test \
  money-api:test

# Check logs
docker logs money-test

# Test health
curl http://localhost:4000/health

# Cleanup
docker stop money-test
docker rm money-test
```

- [ ] Docker image builds successfully
- [ ] Container starts without errors
- [ ] Health check succeeds
- [ ] API endpoints work in container

## Docker Compose

Test full stack with Docker Compose:

```bash
# Start all services
docker-compose up -d

# Check logs
docker-compose logs api
docker-compose logs postgres
docker-compose logs frontend

# Test endpoints
curl http://localhost:4000/health
curl http://localhost:5173

# Cleanup
docker-compose down
```

- [ ] All services start successfully
- [ ] Database initializes with all 7 databases
- [ ] Migrations run automatically
- [ ] API is accessible
- [ ] Frontend is accessible
- [ ] Frontend can communicate with API

## Performance Verification

Basic performance checks:

```bash
# Test concurrent requests
ab -n 1000 -c 10 http://localhost:4000/health

# Test response times
curl -w "@-" -o /dev/null -s http://localhost:4000/accounts <<'EOF'
time_namelookup:  %{time_namelookup}\n
time_connect:  %{time_connect}\n
time_starttransfer:  %{time_starttransfer}\n
time_total:  %{time_total}\n
EOF
```

- [ ] Health endpoint handles concurrent requests
- [ ] Response times are reasonable (< 100ms for simple queries)
- [ ] No memory leaks under load
- [ ] Database connection pool works correctly

## Graceful Shutdown

Test graceful shutdown:

```bash
# Start server
go run ./cmd/server &
SERVER_PID=$!

# Make a request
curl http://localhost:4000/accounts

# Send SIGTERM
kill -TERM $SERVER_PID

# Check logs for graceful shutdown message
```

- [ ] Server handles SIGTERM correctly
- [ ] Active connections complete before shutdown
- [ ] Database connections closed properly
- [ ] No panics or errors during shutdown

## Final Checklist

- [ ] All services migrated successfully
- [ ] All business logic preserved
- [ ] All API endpoints working
- [ ] Database operations work correctly
- [ ] Cross-service communication works
- [ ] Encryption/decryption works
- [ ] Frontend integrates successfully
- [ ] Docker builds and runs
- [ ] No errors in logs
- [ ] Performance is acceptable

## Issues Found

Document any issues discovered during verification:

1. Issue:
   - Expected behavior:
   - Actual behavior:
   - Resolution:

2. Issue:
   - Expected behavior:
   - Actual behavior:
   - Resolution:

## Next Steps After Verification

Once all checks pass:

1. [ ] Remove old Encore service directories (_old_*)
2. [ ] Delete infra.config.json
3. [ ] Update deployment scripts
4. [ ] Update CI/CD pipelines
5. [ ] Notify team of new deployment process
6. [ ] Update production environment variables
7. [ ] Deploy to staging for final testing
8. [ ] Deploy to production
