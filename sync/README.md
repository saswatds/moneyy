# Sync Service - Financial Account Connectors

This service provides connectivity to external financial institutions for automatic account syncing.

## Features

- **Wealthsimple Integration**: Connect and sync Wealthsimple accounts (TFSA, RRSP, Cash, etc.)
- **Encrypted Credentials**: AES-256-GCM encryption for all sensitive data
- **OAuth2 + 2FA**: Secure authentication with OTP support
- **GraphQL API**: Full access to account data, positions, and history
- **Sync Jobs**: Track and monitor sync operations
- **Multiple Accounts**: Support for multiple connections per user

## Architecture

### Database Tables

1. **connections** - Provider connections (Wealthsimple, Questrade, etc.)
2. **synced_accounts** - Links provider accounts to local accounts
3. **sync_credentials** - Encrypted credential storage
4. **sync_jobs** - Sync operation tracking

### Internal Packages

- **encryption** - AES-256-GCM encryption service
- **wealthsimple** - Wealthsimple API client with OAuth2 and GraphQL support

## API Endpoints

### Authentication

#### Initiate Connection
```bash
POST /sync/wealthsimple/initiate
Content-Type: application/json

{
  "username": "user@example.com",
  "password": "password123"
}
```

Response:
```json
{
  "credential_id": "cred-uuid",
  "require_otp": true,
  "message": "OTP required. Check your authenticator app."
}
```

#### Verify OTP
```bash
POST /sync/wealthsimple/verify-otp
Content-Type: application/json

{
  "credential_id": "cred-uuid",
  "otp_code": "123456"
}
```

Response:
```json
{
  "connection_id": "conn-uuid",
  "status": "syncing",
  "message": "Authentication successful. Initial sync started."
}
```

### Connection Management

#### List Connections
```bash
GET /sync/connections
```

Response:
```json
{
  "connections": [
    {
      "id": "conn-uuid",
      "user_id": "user-uuid",
      "provider": "wealthsimple",
      "name": "Wealthsimple - user@example.com",
      "status": "connected",
      "last_sync_at": "2026-01-24T10:00:00Z",
      "sync_frequency": "daily",
      "account_count": 3,
      "created_at": "2026-01-20T12:00:00Z",
      "updated_at": "2026-01-24T10:00:00Z"
    }
  ]
}
```

#### Get Connection Details
```bash
GET /sync/connections/:id
```

#### Delete Connection
```bash
DELETE /sync/connections/:id
```

#### Update Sync Frequency
```bash
PUT /sync/connections/:id/frequency
Content-Type: application/json

{
  "frequency": "hourly"  # Options: daily, hourly, manual
}
```

### Synced Accounts

#### List Synced Accounts
```bash
GET /sync/connections/:connectionId/accounts
```

Response:
```json
{
  "synced_accounts": [
    {
      "id": "sync-acc-uuid",
      "connection_id": "conn-uuid",
      "local_account_id": "acc-uuid",
      "provider_account_id": "ca-tfsa-123",
      "last_sync_at": "2026-01-24T10:00:00Z",
      "created_at": "2026-01-20T12:00:00Z",
      "updated_at": "2026-01-24T10:00:00Z"
    }
  ]
}
```

#### Get Synced Account Details
```bash
GET /sync/accounts/:id
```

### Sync Operations

#### Trigger Manual Sync
```bash
POST /sync/accounts/:id/sync
```

Response:
```json
{
  "job_id": "job-uuid",
  "status": "pending"
}
```

#### Get Sync Job History
```bash
GET /sync/accounts/:id/jobs
```

Response:
```json
{
  "jobs": [
    {
      "id": "job-uuid",
      "synced_account_id": "sync-acc-uuid",
      "type": "full",
      "status": "completed",
      "started_at": "2026-01-24T10:00:00Z",
      "completed_at": "2026-01-24T10:02:15Z",
      "items_processed": 150,
      "items_created": 5,
      "items_updated": 145,
      "items_failed": 0,
      "created_at": "2026-01-24T10:00:00Z"
    }
  ]
}
```

## Wealthsimple Integration

### Authentication Flow

1. **Step 1: Initial Login**
   - User provides email and password
   - Backend attempts OAuth2 login
   - Wealthsimple returns OTP required

2. **Step 2: OTP Verification**
   - User enters 6-digit code from authenticator app
   - Backend completes authentication
   - Stores encrypted credentials and tokens

3. **Step 3: Account Discovery**
   - Backend queries Wealthsimple GraphQL API
   - Creates local Account records
   - Links to SyncedAccount records

4. **Step 4: Initial Sync**
   - Fetches account balances
   - Fetches positions (holdings)
   - Creates Balance records
   - Creates Holding records (if applicable)

### GraphQL Queries

The Wealthsimple client supports:
- **ListAccounts** - Get all accounts
- **FetchAccountDetails** - Get balances and positions
- **FetchAccountActivities** - Get transaction history
- **FetchAccountHistory** - Get historical performance

### Data Mapping

| Wealthsimple Type | Local Type    |
|-------------------|---------------|
| ca_tfsa           | tfsa          |
| ca_rrsp           | rrsp          |
| non_registered    | brokerage     |
| ca_cash           | checking      |
| crypto            | crypto        |

## Security

### Encryption

All sensitive data is encrypted using AES-256-GCM:
- Usernames and passwords
- OAuth access tokens
- OAuth refresh tokens
- OTP claims (for "remember me")

### Secrets

The encryption master key must be configured in Encore secrets:

```bash
encore secret set --dev EncryptionMasterKey
```

Generate a secure 32-byte key:
```bash
openssl rand -base64 32
```

### Best Practices

- Never log decrypted credentials or tokens
- Tokens are automatically refreshed before expiration
- Device IDs are stable per user to avoid security alerts
- All API calls use HTTPS

## Development

### Adding a New Provider

1. Create a new client package in `internal/<provider>/`
2. Implement the authentication flow
3. Add data extraction methods
4. Create data mapping functions
5. Update the Connection and SyncedAccount models
6. Add new endpoints in `sync.go`

### Testing

```bash
# Run unit tests
encore test ./sync/...

# Test encryption service
go test ./sync/internal/encryption -v

# Test Wealthsimple client (requires credentials)
go test ./sync/internal/wealthsimple -v
```

### Local Development

```bash
# Start Encore
encore run

# Test endpoints
curl http://localhost:4000/sync/connections

# View logs
encore logs
```

## TODO

### Phase 1: Core Implementation (Current)
- [x] Database schema and migrations
- [x] Encryption service
- [x] Wealthsimple OAuth2 client
- [x] GraphQL query support
- [x] Basic CRUD endpoints
- [ ] Actual authentication implementation
- [ ] Token refresh mechanism
- [ ] Error handling and retry logic

### Phase 2: Sync Workers
- [ ] Background sync scheduler (cron jobs)
- [ ] Account data sync
- [ ] Position/holding sync
- [ ] Balance history backfill
- [ ] Transaction sync

### Phase 3: Frontend
- [ ] Connection wizard UI
- [ ] OTP input component
- [ ] Sync status dashboard
- [ ] Manual sync button
- [ ] Connection management UI

### Phase 4: Advanced Features
- [ ] Webhook support for real-time updates
- [ ] Multiple connection support
- [ ] Sync conflict resolution
- [ ] Performance metrics and monitoring
- [ ] Rate limiting and backoff

## Future Providers

- **Questrade** - Canadian discount broker
- **Interactive Brokers** - International broker
- **Plaid** - Banking aggregation (US/Canada)
- **Finicity** - Banking aggregation
- **Yodlee** - Banking aggregation

## References

- [Wealthsimple API Documentation](https://github.com/gboudreau/ws-api-python)
- [Encore Documentation](https://encore.dev/docs)
- [OAuth 2.0 RFC](https://tools.ietf.org/html/rfc6749)
- [GraphQL Specification](https://spec.graphql.org/)
