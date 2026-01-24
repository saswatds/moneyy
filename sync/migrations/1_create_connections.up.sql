-- Create connections table
CREATE TABLE connections (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL CHECK (provider IN ('wealthsimple')),
    name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('connected', 'disconnected', 'error', 'syncing')) DEFAULT 'connected',
    last_sync_at TIMESTAMP WITH TIME ZONE,
    last_sync_error TEXT,
    sync_frequency TEXT NOT NULL CHECK (sync_frequency IN ('daily', 'hourly', 'manual')) DEFAULT 'daily',
    account_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create synced_accounts table
CREATE TABLE synced_accounts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    connection_id TEXT NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
    local_account_id TEXT NOT NULL,
    provider_account_id TEXT NOT NULL,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(connection_id, provider_account_id)
);

-- Create sync_credentials table (encrypted storage)
CREATE TABLE sync_credentials (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    user_id TEXT NOT NULL UNIQUE,
    provider TEXT NOT NULL CHECK (provider IN ('wealthsimple')),
    encrypted_username BYTEA NOT NULL,
    encrypted_password BYTEA NOT NULL,
    encrypted_access_token BYTEA,
    encrypted_refresh_token BYTEA,
    token_expires_at TIMESTAMP WITH TIME ZONE,
    device_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    app_instance_id TEXT NOT NULL,
    encrypted_otp_claim BYTEA,
    identity_canonical_id TEXT,
    email TEXT,
    profiles JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create sync_jobs table
CREATE TABLE sync_jobs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    synced_account_id TEXT NOT NULL REFERENCES synced_accounts(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('accounts', 'positions', 'activities', 'history', 'full')),
    status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')) DEFAULT 'pending',
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    items_processed INTEGER NOT NULL DEFAULT 0,
    items_created INTEGER NOT NULL DEFAULT 0,
    items_updated INTEGER NOT NULL DEFAULT 0,
    items_failed INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for connections
CREATE INDEX idx_connections_user_id ON connections(user_id);
CREATE INDEX idx_connections_status ON connections(status);
CREATE INDEX idx_connections_provider ON connections(provider);

-- Indexes for synced_accounts
CREATE INDEX idx_synced_accounts_connection_id ON synced_accounts(connection_id);
CREATE INDEX idx_synced_accounts_local_account_id ON synced_accounts(local_account_id);
CREATE INDEX idx_synced_accounts_provider_account_id ON synced_accounts(provider_account_id);

-- Indexes for sync_credentials
CREATE INDEX idx_sync_credentials_user_id ON sync_credentials(user_id);
CREATE INDEX idx_sync_credentials_provider ON sync_credentials(provider);

-- Indexes for sync_jobs
CREATE INDEX idx_sync_jobs_synced_account_id ON sync_jobs(synced_account_id);
CREATE INDEX idx_sync_jobs_status ON sync_jobs(status);
CREATE INDEX idx_sync_jobs_type ON sync_jobs(type);
CREATE INDEX idx_sync_jobs_created_at ON sync_jobs(created_at DESC);
