-- Sync system for connecting to external financial providers (SQLite)

-- Sync credentials table (encrypted storage for provider credentials)
CREATE TABLE IF NOT EXISTS sync_credentials (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    provider TEXT NOT NULL CHECK (provider IN ('wealthsimple')),
    -- Encrypted credential fields (nullable after token-based auth migration)
    encrypted_username BLOB,
    encrypted_password BLOB,
    encrypted_access_token BLOB,
    encrypted_refresh_token BLOB,
    token_expires_at DATETIME,
    -- Device and session tracking
    device_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    app_instance_id TEXT NOT NULL,
    encrypted_otp_claim BLOB,
    -- Provider metadata
    identity_canonical_id TEXT,
    email TEXT,
    profiles TEXT,
    -- Connection status fields (merged from connections table)
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'disconnected', 'error', 'syncing')),
    last_sync_at DATETIME,
    last_sync_error TEXT,
    sync_frequency TEXT NOT NULL DEFAULT 'daily' CHECK (sync_frequency IN ('daily', 'hourly', 'manual')),
    account_count INTEGER NOT NULL DEFAULT 0,
    -- Timestamps
    created_at DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sync_credentials_user_id ON sync_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_credentials_provider ON sync_credentials(provider);

-- Synced accounts table (mapping between local and provider accounts)
CREATE TABLE IF NOT EXISTS synced_accounts (
    id TEXT PRIMARY KEY,
    credential_id TEXT NOT NULL REFERENCES sync_credentials(id) ON DELETE CASCADE,
    local_account_id TEXT NOT NULL,
    provider_account_id TEXT NOT NULL,
    last_sync_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
    UNIQUE(credential_id, provider_account_id)
);

CREATE INDEX IF NOT EXISTS idx_synced_accounts_connection_id ON synced_accounts(credential_id);
CREATE INDEX IF NOT EXISTS idx_synced_accounts_local_account_id ON synced_accounts(local_account_id);
CREATE INDEX IF NOT EXISTS idx_synced_accounts_provider_account_id ON synced_accounts(provider_account_id);

-- Sync jobs table (tracking background sync operations)
CREATE TABLE IF NOT EXISTS sync_jobs (
    id TEXT PRIMARY KEY,
    synced_account_id TEXT NOT NULL REFERENCES synced_accounts(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('accounts', 'positions', 'activities', 'history', 'full')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    started_at DATETIME,
    completed_at DATETIME,
    error_message TEXT,
    items_processed INTEGER NOT NULL DEFAULT 0,
    items_created INTEGER NOT NULL DEFAULT 0,
    items_updated INTEGER NOT NULL DEFAULT 0,
    items_failed INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sync_jobs_synced_account_id ON sync_jobs(synced_account_id);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_status ON sync_jobs(status);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_type ON sync_jobs(type);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_created_at ON sync_jobs(created_at);
