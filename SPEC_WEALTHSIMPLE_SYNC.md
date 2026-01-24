# Wealthsimple Synced Accounts - Technical Specification

## 1. Overview

Automatically sync account balances, holdings, and transactions from Wealthsimple accounts. Since Wealthsimple doesn't provide a public API, this feature uses reverse-engineered web APIs with cookie-based authentication.

**⚠️ Important Disclaimers:**
- This is for **read-only data syncing** purposes only
- Trading via unofficial APIs violates Wealthsimple's Terms of Service and IIROC regulations
- Use at your own risk - Wealthsimple may block access or update their APIs at any time
- Credentials are stored encrypted and never shared

## 2. Authentication Flow

### 2.1 Initial Authentication

#### Step 1: Login Request
```
POST https://api.production.wealthsimple.com/v1/oauth/v2/token

Headers:
  x-wealthsimple-client: @wealthsimple/wealthsimple
  x-ws-api-version: 12
  x-ws-device-id: <generated UUID>
  x-ws-session-id: <generated UUID>
  x-app-instance-id: <generated UUID>
  x-platform-os: web
  Content-Type: application/json

Body:
{
  "grant_type": "password",
  "username": "user@example.com",
  "password": "user_password",
  "skip_provision": true,
  "redirect_uri": "https://my.wealthsimple.com/app/login",
  "scope": "invest.read invest.write trade.read trade.write",
  "client_id": "4da53ac2b03225bed1550eba8e4611e086c7b905a3855e6ed12ea08c246758fa"
}

Response (401 Unauthorized):
Headers:
  x-wealthsimple-otp-required: true
  x-wealthsimple-otp: required; method=app
  x-wealthsimple-otp-authenticated-claim: <JWT_TOKEN>
  x-wealthsimple-otp-options: <JWT_TOKEN_WITH_METHODS>

Body:
{
  "error": "invalid_grant",
  "error_description": "Two-step verification code required"
}
```

#### Step 2: 2FA/OTP Challenge
```
POST https://api.production.wealthsimple.com/v1/oauth/v2/token

Headers:
  x-wealthsimple-client: @wealthsimple/wealthsimple
  x-ws-api-version: 12
  x-ws-device-id: <same as step 1>
  x-ws-session-id: <same as step 1>
  x-app-instance-id: <same as step 1>
  x-platform-os: web
  x-wealthsimple-otp: <6_DIGIT_CODE>;remember=true
  x-wealthsimple-otp-authenticated-claim: <from step 1 response>
  x-wealthsimple-otp-claim: <from step 1 response or stored from previous login>
  Content-Type: application/json

Body:
{
  "grant_type": "password",
  "username": "user@example.com",
  "password": "user_password",
  "skip_provision": true,
  "redirect_uri": "https://my.wealthsimple.com/app/login",
  "scope": "invest.read invest.write trade.read trade.write",
  "client_id": "4da53ac2b03225bed1550eba8e4611e086c7b905a3855e6ed12ea08c246758fa"
}

Response (200 OK):
{
  "access_token": "<ACCESS_TOKEN>",
  "token_type": "Bearer",
  "expires_in": 1800,
  "refresh_token": "<REFRESH_TOKEN>",
  "scope": "invest.read invest.write trade.read trade.write",
  "created_at": 1769243205,
  "okta_group_claims": [],
  "identity_canonical_id": "identity-xxx",
  "clock_skew": { "skewed": false },
  "expires_at": "2026-01-24T08:56:45.000Z",
  "email": "user@example.com",
  "profiles": {
    "invest": { "default": "user-xxx" },
    "trade": { "default": "user-xxx" }
  },
  "client_canonical_ids": {
    "trade": { "default": null },
    "invest": { "default": null }
  },
  "suspended_profiles": {}
}
```

**Note**: The OTP format is `<6_DIGIT_CODE>;remember=true` to enable remember me functionality.

### 2.2 Device ID Management
- Generate stable device ID, session ID, and app instance ID per user
- Store these IDs in the database to maintain consistent device fingerprint
- Reuse same device IDs across sessions to avoid triggering security alerts

### 2.3 Session Creation

After obtaining the OAuth token, create a session:

```
POST https://my.wealthsimple.com/api/sessions

Headers:
  Authorization: Bearer <ACCESS_TOKEN>
  x-app-instance-id: <app_instance_id>
  x-platform-os: web
  x-ws-api-version: 12
  x-ws-profile: invest
  x-ws-session-id: <session_id>
  x-ws-user-id: <user_id_from_oauth_response>
  Content-Type: application/json

Body:
{
  "session": {
    "access_token": "<ACCESS_TOKEN>"
  }
}

Response (200 OK):
{
  "ok": true
}
```

**Note**: This endpoint just returns a simple success response. The session is tracked server-side via the headers and cookies.

### 2.4 Token Verification

Verify token validity:

```
GET https://api.production.wealthsimple.com/v1/oauth/v2/token/info

Headers:
  Authorization: Bearer <ACCESS_TOKEN>
  x-wealthsimple-client: @wealthsimple/wealthsimple
  x-ws-api-version: 12
  x-app-instance-id: <app_instance_id>
  x-platform-os: web
  x-ws-device-id: <device_id>
  x-ws-session-id: <session_id>

Response (200 OK):
{
  "resource_owner_id": "identity-xxx",
  "scope": ["invest.read", "invest.write", "trade.read", "trade.write"],
  "expires_in": 1523,
  "application": {
    "uid": "4da53ac2b03225bed1550eba8e4611e086c7b905a3855e6ed12ea08c246758fa"
  },
  "created_at": 1769243205
}
```

### 2.5 Token Management
- Access tokens expire after 30 minutes (1800 seconds)
- Store refresh token securely for automatic re-authentication
- Implement automatic token refresh before expiration
- Handle token expiration gracefully with user notification
- Store OTP claim JWT for "remember me" functionality (expires after ~35 days)

## 3. Data Extraction via GraphQL

Wealthsimple uses a GraphQL API for data fetching. All GraphQL requests go to:

**Base URL**: `https://my.wealthsimple.com/graphql`

**Common Headers**:
```
Authorization: Bearer <ACCESS_TOKEN>
Content-Type: application/json
x-platform-os: web
x-ws-api-version: 12
x-ws-client-library: gql-sdk
x-ws-device-id: <device_id>
x-ws-locale: en-CA
x-ws-profile: <invest|trade>
```

### 3.1 Account Information

**GraphQL Query**: `FetchAccounts`

```graphql
query FetchAccounts($ids: [String!]!) {
  accounts(ids: $ids) {
    ...AccountWithLink
  }
}

fragment AccountWithLink on Account {
  ...Account
  linkedAccount {
    ...Account
  }
}

fragment Account on Account {
  ...AccountCore
  custodianAccounts {
    ...CustodianAccount
  }
}

fragment AccountCore on Account {
  id
  archivedAt
  branch
  closedAt
  createdAt
  cacheExpiredAt
  currency
  requiredIdentityVerification
  unifiedAccountType
  supportedCurrencies
  compatibleCurrencies
  nickname
  status
  applicationFamilyId
  accountOwnerConfiguration
  accountFeatures {
    ...AccountFeature
  }
  accountOwners {
    ...AccountOwner
  }
  accountEntityRelationships {
    ...AccountEntityRelationship
  }
  accountUpgradeProcesses {
    ...AccountUpgradeProcess
  }
  type
}

fragment AccountFeature on AccountFeature {
  name
  enabled
  functional
  firstEnabledOn
}

fragment AccountOwner on AccountOwner {
  accountId
  identityId
  accountNickname
  clientCanonicalId
  accountOpeningAgreementsSigned
  name
  email
  ownershipType
  activeInvitation {
    ...AccountOwnerInvitation
  }
  sentInvitations {
    ...AccountOwnerInvitation
  }
}

fragment AccountOwnerInvitation on AccountOwnerInvitation {
  id
  createdAt
  inviteeName
  inviteeEmail
  inviterName
  inviterEmail
  updatedAt
  sentAt
  status
}

fragment AccountEntityRelationship on AccountEntityRelationship {
  accountCanonicalId
  entityCanonicalId
  entityOwnershipType
  entityType
}

fragment AccountUpgradeProcess on AccountUpgradeProcess {
  canonicalId
  status
  targetAccountType
}

fragment CustodianAccount on CustodianAccount {
  id
  branch
  custodian
  status
  updatedAt
}
```

**Request**:
```json
{
  "operationName": "FetchAccounts",
  "variables": {
    "ids": ["ca-cash-msb-8r1ee8xy"]
  },
  "query": "<GraphQL query above>"
}
```

**Response**:
```json
{
  "data": {
    "accounts": [
      {
        "id": "ca-cash-msb-8r1ee8xy",
        "type": "ca_cash",
        "currency": "CAD",
        "nickname": "Cash Account",
        "status": "open",
        "createdAt": "2020-01-01T00:00:00.000Z",
        "unifiedAccountType": "cash",
        "supportedCurrencies": ["CAD", "USD"],
        "accountOwners": [
          {
            "name": "John Doe",
            "email": "user@example.com",
            "ownershipType": "individual"
          }
        ]
      }
    ]
  }
}
```

### 3.2 List All Accounts

To get all accounts (without specific IDs), use a different query:

**GraphQL Query**: `ListAccounts`

```graphql
query ListAccounts {
  user {
    accounts {
      id
      type
      currency
      nickname
      status
      unifiedAccountType
      createdAt
    }
  }
}
```

### 3.3 Account Balances and Positions

**GraphQL Query**: `FetchAccountDetails`

```graphql
query FetchAccountDetails($accountId: String!) {
  account(id: $accountId) {
    id
    currency
    balances {
      current {
        amount
        currency
      }
      available {
        amount
        currency
      }
      netDeposits {
        amount
        currency
      }
    }
    positions {
      id
      quantity
      security {
        id
        symbol
        name
        currency
        securityType
      }
      costBasis {
        amount
        currency
      }
      marketValue {
        amount
        currency
      }
      bookValue {
        amount
        currency
      }
      averageEntryPrice {
        amount
        currency
      }
    }
  }
}
```

### 3.4 Activities (Transactions)

**GraphQL Query**: `FetchAccountActivities`

```graphql
query FetchAccountActivities(
  $accountId: String!
  $limit: Int
  $cursor: String
) {
  account(id: $accountId) {
    activities(limit: $limit, after: $cursor) {
      edges {
        node {
          id
          type
          status
          symbol
          quantity
          marketValue {
            amount
            currency
          }
          acceptedAt
          settledAt
          description
        }
        cursor
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
}
```

### 3.5 Historical Performance

**GraphQL Query**: `FetchAccountHistory`

```graphql
query FetchAccountHistory(
  $accountId: String!
  $interval: HistoryInterval!
) {
  account(id: $accountId) {
    history(interval: $interval) {
      date
      value {
        amount
        currency
      }
      netDeposits {
        amount
        currency
      }
      gainLoss {
        amount
        currency
      }
    }
  }
}
```

**Intervals**: `ONE_DAY`, `ONE_WEEK`, `ONE_MONTH`, `THREE_MONTHS`, `ONE_YEAR`, `ALL`

### 3.6 Profile-Based Access

Wealthsimple has different profiles with different data access:

- **invest**: Investment accounts (TFSA, RRSP, non-registered)
- **trade**: Trading accounts

Set the appropriate profile in the `x-ws-profile` header based on the account type you're accessing.

## 4. Data Models

### 4.1 SyncedAccount
```go
type SyncProvider string

const (
    SyncProviderWealthsimple SyncProvider = "wealthsimple"
    // Future: SyncProviderQuestrade, SyncProviderInteractiveBrokers, etc.
)

type SyncStatus string

const (
    SyncStatusConnected    SyncStatus = "connected"
    SyncStatusDisconnected SyncStatus = "disconnected"
    SyncStatusError        SyncStatus = "error"
    SyncStatusSyncing      SyncStatus = "syncing"
)

type SyncedAccount struct {
    ID                string       `json:"id"`
    UserID            string       `json:"user_id"`
    Provider          SyncProvider `json:"provider"`
    ProviderAccountID string       `json:"provider_account_id"`
    LocalAccountID    string       `json:"local_account_id"` // Links to Account table
    Status            SyncStatus   `json:"status"`
    LastSyncAt        *time.Time   `json:"last_sync_at,omitempty"`
    LastSyncError     string       `json:"last_sync_error,omitempty"`
    SyncFrequency     string       `json:"sync_frequency"` // daily, hourly, manual
    CreatedAt         time.Time    `json:"created_at"`
    UpdatedAt         time.Time    `json:"updated_at"`
}
```

### 4.2 SyncCredentials (Encrypted Storage)
```go
type SyncCredentials struct {
    ID                    string            `json:"id"`
    UserID                string            `json:"user_id"`
    Provider              SyncProvider      `json:"provider"`
    EncryptedUsername     []byte            `json:"-"` // Never expose in JSON
    EncryptedPassword     []byte            `json:"-"` // Never expose in JSON
    AccessToken           string            `json:"-"` // Encrypted in DB
    RefreshToken          string            `json:"-"` // Encrypted in DB
    TokenExpiresAt        *time.Time        `json:"token_expires_at,omitempty"`
    DeviceID              string            `json:"device_id"`
    SessionID             string            `json:"session_id"`
    AppInstanceID         string            `json:"app_instance_id"`
    OTPClaim              string            `json:"-"` // OTP claim for remember me (long-lived)
    OTPAuthenticatedClaim string            `json:"-"` // OTP authenticated claim (short-lived)
    RequireOTP            bool              `json:"require_otp"`
    IdentityCanonicalID   string            `json:"identity_canonical_id"`
    Email                 string            `json:"email"`
    Profiles              map[string]string `json:"profiles"` // invest, trade user IDs
    CreatedAt             time.Time         `json:"created_at"`
    UpdatedAt             time.Time         `json:"updated_at"`
}
```

### 4.3 SyncJob
```go
type SyncJobType string

const (
    SyncJobTypeAccounts   SyncJobType = "accounts"
    SyncJobTypePositions  SyncJobType = "positions"
    SyncJobTypeActivities SyncJobType = "activities"
    SyncJobTypeHistory    SyncJobType = "history"
    SyncJobTypeFull       SyncJobType = "full"
)

type SyncJobStatus string

const (
    SyncJobStatusPending   SyncJobStatus = "pending"
    SyncJobStatusRunning   SyncJobStatus = "running"
    SyncJobStatusCompleted SyncJobStatus = "completed"
    SyncJobStatusFailed    SyncJobStatus = "failed"
)

type SyncJob struct {
    ID              string        `json:"id"`
    SyncedAccountID string        `json:"synced_account_id"`
    Type            SyncJobType   `json:"type"`
    Status          SyncJobStatus `json:"status"`
    StartedAt       *time.Time    `json:"started_at,omitempty"`
    CompletedAt     *time.Time    `json:"completed_at,omitempty"`
    ErrorMessage    string        `json:"error_message,omitempty"`
    ItemsProcessed  int           `json:"items_processed"`
    ItemsCreated    int           `json:"items_created"`
    ItemsUpdated    int           `json:"items_updated"`
    ItemsFailed     int           `json:"items_failed"`
    CreatedAt       time.Time     `json:"created_at"`
}
```

## 5. Database Schema

```sql
-- Synced accounts table
CREATE TABLE synced_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    provider VARCHAR(50) NOT NULL,
    provider_account_id VARCHAR(255) NOT NULL,
    local_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'connected',
    last_sync_at TIMESTAMP,
    last_sync_error TEXT,
    sync_frequency VARCHAR(20) NOT NULL DEFAULT 'daily',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, provider, provider_account_id)
);

-- Sync credentials table (encrypted)
CREATE TABLE sync_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    provider VARCHAR(50) NOT NULL,
    encrypted_username BYTEA NOT NULL,
    encrypted_password BYTEA NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP,
    device_id VARCHAR(255) NOT NULL,
    session_id VARCHAR(255) NOT NULL,
    app_instance_id VARCHAR(255) NOT NULL,
    otp_claim TEXT,
    otp_authenticated_claim TEXT,
    require_otp BOOLEAN NOT NULL DEFAULT true,
    identity_canonical_id VARCHAR(255),
    email VARCHAR(255),
    profiles JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Sync jobs table
CREATE TABLE sync_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    synced_account_id UUID NOT NULL REFERENCES synced_accounts(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,
    items_processed INT NOT NULL DEFAULT 0,
    items_created INT NOT NULL DEFAULT 0,
    items_updated INT NOT NULL DEFAULT 0,
    items_failed INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_synced_accounts_user_id ON synced_accounts(user_id);
CREATE INDEX idx_synced_accounts_status ON synced_accounts(status);
CREATE INDEX idx_sync_credentials_user_id ON sync_credentials(user_id);
CREATE INDEX idx_sync_jobs_synced_account_id ON sync_jobs(synced_account_id);
CREATE INDEX idx_sync_jobs_status ON sync_jobs(status);
CREATE INDEX idx_sync_jobs_created_at ON sync_jobs(created_at DESC);
```

## 6. API Endpoints

### 6.1 Sync Service
```
POST   /sync/wealthsimple/initiate     - Initiate connection (username/password)
POST   /sync/wealthsimple/verify-otp   - Complete authentication (OTP code)
GET    /sync/accounts                  - List all synced accounts
GET    /sync/accounts/:id              - Get synced account details
DELETE /sync/accounts/:id              - Disconnect synced account
POST   /sync/accounts/:id/sync         - Trigger manual sync
GET    /sync/accounts/:id/jobs         - Get sync job history
GET    /sync/accounts/:id/status       - Get current sync status
PUT    /sync/accounts/:id/frequency    - Update sync frequency
POST   /sync/accounts/:id/reconnect    - Re-authenticate (if token expired)
```

### 6.2 Request/Response Examples

#### Initiate Connection (Step 1)
```
POST /sync/wealthsimple/initiate

Request:
{
  "username": "user@example.com",
  "password": "user_password"
}

Response (200 OK):
{
  "credential_id": "cred-123",
  "require_otp": true,
  "message": "OTP required. Check your authenticator app."
}

Response (401 Unauthorized):
{
  "error": "Invalid username or password"
}
```

#### Verify OTP (Step 2)
```
POST /sync/wealthsimple/verify-otp

Request:
{
  "credential_id": "cred-123",
  "otp_code": "123456"
}

Response (200 OK):
{
  "synced_account_id": "sync-123",
  "local_account_id": "acc-456",
  "status": "syncing",
  "message": "Authentication successful. Initial sync started."
}

Response (400 Bad Request):
{
  "error": "Invalid or expired OTP code"
}
```

#### Trigger Manual Sync
```
POST /sync/accounts/:id/sync

Response (202 Accepted):
{
  "job_id": "job-789",
  "status": "pending"
}
```

## 7. GraphQL Client Implementation

### 7.1 GraphQL Client Setup

Create a GraphQL client for Wealthsimple:

```go
type WealthsimpleGraphQLClient struct {
    baseURL      string
    accessToken  string
    deviceID     string
    sessionID    string
    appInstanceID string
    profile      string // invest or trade
}

func (c *WealthsimpleGraphQLClient) Query(ctx context.Context, query string, variables map[string]interface{}) (map[string]interface{}, error) {
    req := map[string]interface{}{
        "query": query,
        "variables": variables,
    }

    body, _ := json.Marshal(req)
    httpReq, _ := http.NewRequestWithContext(ctx, "POST", c.baseURL, bytes.NewBuffer(body))

    // Set headers
    httpReq.Header.Set("Authorization", "Bearer "+c.accessToken)
    httpReq.Header.Set("Content-Type", "application/json")
    httpReq.Header.Set("x-platform-os", "web")
    httpReq.Header.Set("x-ws-api-version", "12")
    httpReq.Header.Set("x-ws-client-library", "gql-sdk")
    httpReq.Header.Set("x-ws-device-id", c.deviceID)
    httpReq.Header.Set("x-ws-locale", "en-CA")
    httpReq.Header.Set("x-ws-profile", c.profile)

    // Execute request...
}
```

### 7.2 Query Storage

Store commonly used GraphQL queries as constants:

```go
const (
    QueryListAccounts = `
        query ListAccounts {
            user {
                accounts {
                    id
                    type
                    currency
                    nickname
                    status
                    unifiedAccountType
                    createdAt
                }
            }
        }
    `

    QueryFetchAccountDetails = `
        query FetchAccountDetails($accountId: String!) {
            account(id: $accountId) {
                id
                currency
                balances {
                    current { amount currency }
                    available { amount currency }
                    netDeposits { amount currency }
                }
                positions {
                    id
                    quantity
                    security {
                        id symbol name currency securityType
                    }
                    costBasis { amount currency }
                    marketValue { amount currency }
                    bookValue { amount currency }
                    averageEntryPrice { amount currency }
                }
            }
        }
    `
)
```

## 8. Sync Logic

### 8.1 Full Sync Flow

1. **Fetch accounts** from Wealthsimple via GraphQL
   - Query: `ListAccounts`
   - Create/update local Account records
   - Link to SyncedAccount records
   - Determine appropriate profile (invest/trade) for each account

2. **Fetch positions** for each account via GraphQL
   - Query: `FetchAccountDetails` with account ID
   - Create/update Holding records
   - Map Wealthsimple position data to local holdings model
   - Store current market value

3. **Fetch activities** (transactions) via GraphQL
   - Query: `FetchAccountActivities` with pagination
   - Store recent transactions for reference
   - Use for calculating cost basis and realized gains

4. **Fetch historical performance** via GraphQL
   - Query: `FetchAccountHistory` with various intervals
   - Create Balance records for historical data points
   - Backfill balance history if not exists

5. **Update sync metadata**
   - Update LastSyncAt timestamp
   - Update account balances
   - Mark sync job as completed

### 7.2 Incremental Sync

- Fetch only new activities since last sync
- Update position quantities and market values
- Create new balance entry with current value
- Faster than full sync, run more frequently

### 7.3 Conflict Resolution

- Wealthsimple data is source of truth for synced accounts
- Local manual edits are overwritten on sync
- Show "Synced" badge on accounts to indicate they're managed
- Prevent manual balance/holding edits on synced accounts

### 8.4 Profile Detection

Determine the appropriate profile for each account:

```go
func DetermineProfile(accountType string) string {
    switch {
    case strings.Contains(accountType, "tfsa"),
         strings.Contains(accountType, "rrsp"),
         strings.Contains(accountType, "rrif"),
         accountType == "non_registered":
        return "invest"
    case strings.Contains(accountType, "trade"),
         strings.Contains(accountType, "cash"):
        return "trade"
    default:
        return "invest" // default to invest
    }
}
```

### 8.5 Sync Scheduling

- **Manual**: User-triggered via UI button
- **Hourly**: For active traders (off-market hours: every 4 hours)
- **Daily**: For long-term investors (runs at 5 PM EST after market close)
- Implement using Encore cron jobs

```go
// Example cron job
var _ = cron.NewJob("sync-daily", cron.JobConfig{
    Title:    "Daily Wealthsimple Sync",
    Schedule: "0 17 * * *", // 5 PM EST daily
    Endpoint: SyncAllAccounts,
})
```

## 9. Security and Credential Management

### 9.1 Overview

Store encrypted credentials and tokens in the database. User provides username, password, and manually enters OTP codes when needed.

**Approach**:
- Username and password encrypted using AES-256-GCM
- Tokens encrypted and stored in database
- Manual OTP entry via authenticator app
- All sensitive data encrypted at rest

### 9.2 Data Model

```go
type SyncCredentials struct {
    ID                    string            `json:"id"`
    UserID                string            `json:"user_id"`
    Provider              SyncProvider      `json:"provider"`
    EncryptedUsername     []byte            `json:"-"` // Never expose in JSON
    EncryptedPassword     []byte            `json:"-"` // Never expose in JSON
    EncryptedAccessToken  []byte            `json:"-"` // Encrypted in DB
    EncryptedRefreshToken []byte            `json:"-"` // Encrypted in DB
    TokenExpiresAt        *time.Time        `json:"token_expires_at,omitempty"`
    DeviceID              string            `json:"device_id"`
    SessionID             string            `json:"session_id"`
    AppInstanceID         string            `json:"app_instance_id"`
    EncryptedOTPClaim     []byte            `json:"-"` // Encrypted OTP claim for remember me
    IdentityCanonicalID   string            `json:"identity_canonical_id"`
    Email                 string            `json:"email"`
    Profiles              map[string]string `json:"profiles"`
    CreatedAt             time.Time         `json:"created_at"`
    UpdatedAt             time.Time         `json:"updated_at"`
}
```

### 9.3 Database Schema

```sql
-- Sync credentials table with encrypted credentials and tokens
CREATE TABLE sync_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    provider VARCHAR(50) NOT NULL,
    encrypted_username BYTEA NOT NULL,
    encrypted_password BYTEA NOT NULL,
    encrypted_access_token BYTEA,
    encrypted_refresh_token BYTEA,
    token_expires_at TIMESTAMP,
    device_id VARCHAR(255) NOT NULL,
    session_id VARCHAR(255) NOT NULL,
    app_instance_id VARCHAR(255) NOT NULL,
    encrypted_otp_claim BYTEA,
    identity_canonical_id VARCHAR(255),
    email VARCHAR(255),
    profiles JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### 9.4 Encryption Service

Encrypt credentials and tokens before storing in database:

```go
type EncryptionService struct {
    masterKey []byte
}

func NewEncryptionService(masterKey string) (*EncryptionService, error) {
    key, err := base64.StdEncoding.DecodeString(masterKey)
    if err != nil {
        return nil, err
    }
    return &EncryptionService{masterKey: key}, nil
}

// EncryptToken encrypts a token using AES-256-GCM
func (s *EncryptionService) EncryptToken(plaintext string) ([]byte, error) {
    block, err := aes.NewCipher(s.masterKey)
    if err != nil {
        return nil, err
    }

    gcm, err := cipher.NewGCM(block)
    if err != nil {
        return nil, err
    }

    nonce := make([]byte, gcm.NonceSize())
    if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
        return nil, err
    }

    ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
    return ciphertext, nil
}

// DecryptToken decrypts a token using AES-256-GCM
func (s *EncryptionService) DecryptToken(ciphertext []byte) (string, error) {
    block, err := aes.NewCipher(s.masterKey)
    if err != nil {
        return "", err
    }

    gcm, err := cipher.NewGCM(block)
    if err != nil {
        return "", err
    }

    nonceSize := gcm.NonceSize()
    if len(ciphertext) < nonceSize {
        return "", errors.New("ciphertext too short")
    }

    nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]
    plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
    if err != nil {
        return "", err
    }

    return string(plaintext), nil
}
```

### 9.5 Secrets Management

```go
// Store encryption key in Encore secrets
var secrets struct {
    EncryptionMasterKey string // Base64-encoded AES-256 key (32 bytes for AES-256)
}

// Never log decrypted credentials or tokens
// Sanitize error messages to exclude sensitive data
```

### 9.6 Authentication Flow

**Step 1: Initiate Connection**

```go
func InitiateConnection(ctx context.Context, userID, username, password string) (*InitiateResponse, error) {
    // Initialize encryption service
    encService, err := NewEncryptionService(secrets.EncryptionMasterKey)
    if err != nil {
        return nil, err
    }

    // Encrypt credentials
    encryptedUsername, err := encService.EncryptToken(username)
    if err != nil {
        return nil, err
    }

    encryptedPassword, err := encService.EncryptToken(password)
    if err != nil {
        return nil, err
    }

    // Generate device IDs
    deviceID := uuid.New().String()
    sessionID := uuid.New().String()
    appInstanceID := uuid.New().String()

    // Attempt login to Wealthsimple
    wsClient := NewWealthsimpleClient(deviceID, sessionID, appInstanceID)
    loginResp, err := wsClient.Login(ctx, username, password)
    if err != nil {
        return nil, err
    }

    // Store encrypted credentials in database (temporary, until OTP verified)
    syncCreds := &SyncCredentials{
        UserID:            userID,
        Provider:          SyncProviderWealthsimple,
        EncryptedUsername: encryptedUsername,
        EncryptedPassword: encryptedPassword,
        DeviceID:          deviceID,
        SessionID:         sessionID,
        AppInstanceID:     appInstanceID,
        Email:             username,
    }

    db.Create(syncCreds)

    return &InitiateResponse{
        CredentialID:          syncCreds.ID,
        RequireOTP:            true,
        OTPAuthenticatedClaim: loginResp.OTPAuthenticatedClaim,
    }, nil
}
```

**Step 2: Verify OTP and Complete Authentication**

```go
func VerifyOTPAndConnect(ctx context.Context, credentialID, otpCode string) (*ConnectResponse, error) {
    // Get credential from database
    var syncCreds SyncCredentials
    db.First(&syncCreds, "id = ?", credentialID)

    // Initialize encryption service
    encService, err := NewEncryptionService(secrets.EncryptionMasterKey)
    if err != nil {
        return nil, err
    }

    // Decrypt credentials
    username, err := encService.DecryptToken(syncCreds.EncryptedUsername)
    if err != nil {
        return nil, err
    }

    password, err := encService.DecryptToken(syncCreds.EncryptedPassword)
    if err != nil {
        return nil, err
    }

    // Complete authentication with OTP
    wsClient := NewWealthsimpleClient(syncCreds.DeviceID, syncCreds.SessionID, syncCreds.AppInstanceID)
    tokenResp, err := wsClient.VerifyOTP(ctx, username, password, otpCode)
    if err != nil {
        return nil, err
    }

    // Encrypt tokens
    encryptedAccessToken, _ := encService.EncryptToken(tokenResp.AccessToken)
    encryptedRefreshToken, _ := encService.EncryptToken(tokenResp.RefreshToken)
    encryptedOTPClaim, _ := encService.EncryptToken(tokenResp.OTPClaim)

    // Update with encrypted tokens and profiles
    syncCreds.EncryptedAccessToken = encryptedAccessToken
    syncCreds.EncryptedRefreshToken = encryptedRefreshToken
    syncCreds.EncryptedOTPClaim = encryptedOTPClaim
    syncCreds.TokenExpiresAt = &tokenResp.ExpiresAt
    syncCreds.IdentityCanonicalID = tokenResp.IdentityCanonicalID
    syncCreds.Profiles = tokenResp.Profiles
    db.Save(&syncCreds)

    // Create local account and link to synced account
    localAccountID := createLocalAccount(&syncCreds)

    // Trigger initial sync in background
    go StartInitialSync(ctx, syncCreds.ID)

    return &ConnectResponse{
        SyncedAccountID: syncCreds.ID,
        LocalAccountID:  localAccountID,
        Status:          "syncing",
    }, nil
}
```


### 9.10 Token Refresh

```go
func RefreshToken(ctx context.Context, userID string) error {
    // Get credential reference
    var syncCreds SyncCredentials
    db.First(&syncCreds, "user_id = ?", userID)

    // Check if token needs refresh
    if syncCreds.TokenExpiresAt != nil && time.Now().Before(syncCreds.TokenExpiresAt.Add(-5*time.Minute)) {
        // Token still valid for 5+ minutes
        return nil
    }

    // Initialize encryption service
    encService, err := NewEncryptionService(secrets.EncryptionMasterKey)
    if err != nil {
        return err
    }

    // Decrypt refresh token
    refreshToken, err := encService.DecryptToken(syncCreds.EncryptedRefreshToken)
    if err != nil {
        return err
    }

    // Refresh token
    wsClient := NewWealthsimpleClient(syncCreds.DeviceID, syncCreds.SessionID, syncCreds.AppInstanceID)
    tokenResp, err := wsClient.RefreshAccessToken(ctx, refreshToken)
    if err != nil {
        return err
    }

    // Encrypt new tokens
    encryptedAccessToken, err := encService.EncryptToken(tokenResp.AccessToken)
    if err != nil {
        return err
    }

    encryptedRefreshToken, err := encService.EncryptToken(tokenResp.RefreshToken)
    if err != nil {
        return err
    }

    // Update encrypted tokens in database
    syncCreds.EncryptedAccessToken = encryptedAccessToken
    syncCreds.EncryptedRefreshToken = encryptedRefreshToken
    syncCreds.TokenExpiresAt = &tokenResp.ExpiresAt
    db.Save(&syncCreds)

    return nil
}
```

### 9.7 Benefits of This Approach

- **Single source**: All credentials and tokens in one database
- **Encrypted at rest**: AES-256-GCM encryption for all sensitive data
- **Token refresh**: Automatic token refresh using stored encrypted credentials
- **Simple UX**: User enters credentials once with manual OTP
- **No external dependencies**: No third-party services required
- **Performance**: Fast access to credentials and tokens

## 10. Error Handling

### 10.1 Authentication Errors

| Error | Handling Strategy |
|-------|-------------------|
| Invalid credentials | Prompt user to re-enter |
| OTP required | Always required on first auth, store claim for future |
| OTP expired | Request new OTP authenticated claim |
| Token expired | Automatically refresh using refresh token |
| Refresh token expired | Require full re-authentication with 2FA |

### 10.2 Sync Errors

| Error | Handling Strategy |
|-------|-------------------|
| Network errors | Retry with exponential backoff (max 3 retries) |
| API errors (5xx) | Log and retry after 1 minute |
| Rate limiting (429) | Back off for specified time in Retry-After header |
| Data validation errors | Log, skip item, continue sync |
| Account not found | Mark synced account as disconnected |

### 10.3 User Notifications

- Email notification on sync failure after 3 consecutive attempts
- In-app banner for accounts requiring re-authentication
- Sync status visible on account detail page

## 11. Frontend Implementation

### 11.1 New Pages

```
/sync                      - Synced accounts dashboard
/sync/connect              - Connect new Wealthsimple account
/sync/connect/otp          - OTP verification page
/accounts/:id/sync-status  - Sync status for specific account
```

### 11.2 New Components

```typescript
// SyncAccountCard - Display synced account status
interface SyncAccountCardProps {
  syncedAccount: SyncedAccount;
  account: Account;
  onSync: () => void;
  onDisconnect: () => void;
}

// WealthsimpleConnectForm - Username/password entry
interface WealthsimpleConnectFormProps {
  onSuccess: (credentialId: string) => void;
}

// Fields:
// - Email (required)
// - Password (required)

// OTPVerificationForm - 6-digit OTP input
interface OTPVerificationFormProps {
  credentialId: string;
  onVerify: (code: string) => Promise<void>;
}

// SyncStatusBadge - Visual indicator of sync status
interface SyncStatusBadgeProps {
  status: SyncStatus;
  lastSyncAt?: Date;
}

// SyncHistoryTable - List of past sync jobs
interface SyncHistoryTableProps {
  jobs: SyncJob[];
}
```

### 11.3 UI/UX Flow

#### Step 1: Enter Credentials
1. Navigate to /sync
2. Click "Connect Wealthsimple Account"
3. Enter email and password
4. Submit to backend

#### Step 2: Verify OTP
1. Backend returns OTP required response
2. Frontend redirects to /sync/connect/otp
3. User opens authenticator app (e.g., Google Authenticator)
4. User enters 6-digit code from authenticator app
5. Submit OTP code

#### Step 3: Complete Setup
1. Backend verifies OTP and stores encrypted credentials/tokens
2. Backend creates local account linked to synced account
3. Backend starts initial sync in background
4. Frontend redirects to account detail page
5. Show sync progress indicator

#### Step 3: View Synced Data
1. Redirect to account detail page
2. Show "Synced from Wealthsimple" badge
3. Display last sync time
4. Show sync status (syncing, up to date, error)
5. Provide manual "Sync Now" button

#### Step 4: Ongoing Sync
1. Automatic syncs run based on schedule
2. Update UI with sync status in real-time
3. Show notification for sync errors
4. Provide easy re-authentication flow

## 12. Data Mapping

### 12.1 Account Mapping

Map Wealthsimple account types to local account types:

| Wealthsimple Type | Local Type | Notes |
|-------------------|------------|-------|
| ca_tfsa | tfsa | TFSA |
| ca_rrsp | rrsp | Registered Retirement Savings Plan |
| ca_rrif | other | Registered Retirement Income Fund |
| non_registered | brokerage | Non-registered investment account |
| ca_resp | other | Registered Education Savings Plan |
| crypto | crypto | Cryptocurrency account |

### 12.2 Position Mapping

Map Wealthsimple position data to local holdings:

| Wealthsimple Field | Local Field | Notes |
|-------------------|-------------|-------|
| symbol | symbol | Ticker symbol |
| quantity | quantity | Number of shares/units |
| average_entry_price.amount | cost_basis | Cost per share |
| stock.currency | - | Not stored (use account currency) |
| market_value | - | Calculate from current price |
| stock.security_type | type | stock, etf, mutual_fund, etc. |

### 12.3 Activity Mapping (Future Feature)

For transaction history tracking:

| Wealthsimple Activity | Local Transaction |
|----------------------|-------------------|
| buy | purchase |
| sell | sale |
| deposit | deposit |
| withdrawal | withdrawal |
| dividend | dividend |
| interest | interest |

## 13. Testing Strategy

### 13.1 Unit Tests

- Encryption/decryption functions
- Token refresh logic
- Data mapping functions
- Error handling

### 13.2 Integration Tests

- Mock Wealthsimple API responses
- Test full sync flow
- Test OTP verification
- Test error scenarios

### 13.3 Manual Testing Checklist

- [ ] Connect new Wealthsimple account with username/password
- [ ] Verify OTP with authenticator app
- [ ] View synced accounts and positions
- [ ] Trigger manual sync
- [ ] Disconnect synced account
- [ ] Reconnect after token expiry
- [ ] Handle incorrect OTP code
- [ ] Handle expired OTP code
- [ ] Handle invalid credentials
- [ ] Handle network errors during sync
- [ ] View sync history
- [ ] Test with multiple Wealthsimple accounts

## 14. Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Design database schema (SyncedAccount, SyncCredentials, SyncJob)
- [ ] Create database migrations
- [ ] Implement encryption service for credentials
- [ ] Create sync service skeleton
- [ ] Set up Wealthsimple API client

### Phase 2: Authentication (Week 2)
- [ ] Implement credential encryption service
- [ ] Implement OAuth2 password grant flow
- [ ] Implement OTP verification flow
- [ ] Implement token encryption and storage
- [ ] Implement token refresh mechanism
- [ ] Build username/password form (frontend)
- [ ] Build OTP verification form (frontend)
- [ ] Test authentication flow end-to-end

### Phase 3: Data Extraction (Week 3)
- [ ] Implement account fetching
- [ ] Implement position fetching
- [ ] Implement activity fetching
- [ ] Implement historical data fetching
- [ ] Build data mapping layer
- [ ] Test data extraction with real accounts

### Phase 4: Sync Logic (Week 4)
- [ ] Implement full sync flow
- [ ] Implement incremental sync flow
- [ ] Implement sync job management
- [ ] Create Encore cron jobs for scheduled syncs
- [ ] Build sync status UI
- [ ] Add manual sync button

### Phase 5: Error Handling & Polish (Week 5)
- [ ] Implement comprehensive error handling
- [ ] Add retry logic with exponential backoff
- [ ] Build re-authentication flow
- [ ] Add sync history view
- [ ] Implement user notifications
- [ ] Add rate limiting protection
- [ ] Polish UI/UX
- [ ] Write documentation

## 15. Monitoring & Maintenance

### 15.1 Metrics to Track

- Sync success rate
- Average sync duration
- Number of active synced accounts
- Token refresh success rate
- API error rates by type
- Number of re-authentication requests

### 15.2 Alerts

- Sync failure rate > 10%
- API consistently returning 5xx errors
- Token refresh failing
- Encryption/decryption errors

### 15.3 Maintenance Tasks

- Monitor for Wealthsimple API changes
- Update API version headers as needed
- Review and rotate encryption keys quarterly
- Clean up old sync job records (> 90 days)
- Review security best practices

## 16. Future Enhancements

- Support for other providers (Questrade, Interactive Brokers)
- Real-time sync via WebSockets (if available)
- Sync transaction history
- Automatic categorization of holdings
- Portfolio rebalancing suggestions
- Performance benchmarking against indices
- Multi-factor authentication options (SMS, email)
- Sync scheduling preferences per account

## 17. Legal & Compliance Notes

⚠️ **Important Considerations:**

### 17.1 Terms of Service
Using unofficial APIs may violate Wealthsimple's Terms of Service. Users accept this risk when connecting their accounts.

### 17.2 Data Privacy
User credentials and financial data must be protected with enterprise-grade security:
- AES-256 encryption for credentials
- TLS 1.3 for all network communications
- Secure key management
- Regular security audits

### 17.3 No Trading
This feature is explicitly for **READ-ONLY** data syncing. No trading or modification of positions is permitted.

### 17.4 Disclaimer
Display clear disclaimer that this is an unofficial integration and may break at any time.

### 17.5 User Consent
Require explicit consent checkbox acknowledging risks before connecting account:

```
☐ I understand that this is an unofficial integration with Wealthsimple
☐ I acknowledge that my account credentials will be encrypted and stored securely
☐ I understand that this integration may stop working if Wealthsimple changes their APIs
☐ I agree that this integration is for read-only data syncing only, not for trading
```

### 17.6 Data Retention
Allow users to delete all synced data and credentials at any time with a clear "Disconnect Account" button.

## 18. References

### 18.1 Community Projects
- [Wsimple](https://github.com/yusuf8ahmed/Wsimple) - Python/Web interface for Wealthsimple Trade
- [UnofficialWealthsimpleApi](https://github.com/Jspsun/UnofficialWealthsimpleApi) - Portfolio balance fetching
- [ws-api-python](https://github.com/gboudreau/ws-api-python) - GraphQL API access

### 18.2 Technical Resources
- [OAuth 2.0 RFC 6749](https://tools.ietf.org/html/rfc6749) - OAuth specification
- [TOTP RFC 6238](https://tools.ietf.org/html/rfc6238) - Time-based One-Time Password
- [AES-GCM](https://csrc.nist.gov/publications/detail/sp/800-38d/final) - NIST encryption standard

---

**Document Version**: 2.0
**Last Updated**: 2026-01-24
**Author**: Claude Code
**Status**: Draft - Ready for Implementation
**Changes in v2.0**: Simplified authentication - removed 1Password integration, using encrypted credentials with manual OTP entry
