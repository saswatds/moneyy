-- Sync system for connecting to external financial providers

-- Sync credentials table (encrypted storage for provider credentials)
CREATE TABLE sync_credentials (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    user_id TEXT NOT NULL UNIQUE,
    provider TEXT NOT NULL CHECK (provider IN ('wealthsimple')),
    -- Encrypted credential fields (nullable after token-based auth migration)
    encrypted_username BYTEA,
    encrypted_password BYTEA,
    encrypted_access_token BYTEA,
    encrypted_refresh_token BYTEA,
    token_expires_at TIMESTAMP WITH TIME ZONE,
    -- Device and session tracking
    device_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    app_instance_id TEXT NOT NULL,
    encrypted_otp_claim BYTEA,
    -- Provider metadata
    identity_canonical_id TEXT,
    email TEXT,
    profiles JSONB,
    -- Connection status fields (merged from connections table)
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'disconnected', 'error', 'syncing')),
    last_sync_at TIMESTAMP WITH TIME ZONE,
    last_sync_error TEXT,
    sync_frequency TEXT NOT NULL DEFAULT 'daily' CHECK (sync_frequency IN ('daily', 'hourly', 'manual')),
    account_count INTEGER NOT NULL DEFAULT 0,
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sync_credentials_user_id ON sync_credentials(user_id);
CREATE INDEX idx_sync_credentials_provider ON sync_credentials(provider);

-- Synced accounts table (mapping between local and provider accounts)
CREATE TABLE synced_accounts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    credential_id TEXT NOT NULL REFERENCES sync_credentials(id) ON DELETE CASCADE,
    local_account_id TEXT NOT NULL,
    provider_account_id TEXT NOT NULL,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(credential_id, provider_account_id)
);

CREATE INDEX idx_synced_accounts_connection_id ON synced_accounts(credential_id);
CREATE INDEX idx_synced_accounts_local_account_id ON synced_accounts(local_account_id);
CREATE INDEX idx_synced_accounts_provider_account_id ON synced_accounts(provider_account_id);

-- Sync jobs table (tracking background sync operations)
CREATE TABLE sync_jobs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    synced_account_id TEXT NOT NULL REFERENCES synced_accounts(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('accounts', 'positions', 'activities', 'history', 'full')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    items_processed INTEGER NOT NULL DEFAULT 0,
    items_created INTEGER NOT NULL DEFAULT 0,
    items_updated INTEGER NOT NULL DEFAULT 0,
    items_failed INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sync_jobs_synced_account_id ON sync_jobs(synced_account_id);
CREATE INDEX idx_sync_jobs_status ON sync_jobs(status);
CREATE INDEX idx_sync_jobs_type ON sync_jobs(type);
CREATE INDEX idx_sync_jobs_created_at ON sync_jobs(created_at);
