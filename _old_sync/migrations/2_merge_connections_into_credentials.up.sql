-- Add connection fields to sync_credentials
ALTER TABLE sync_credentials ADD COLUMN name TEXT;
ALTER TABLE sync_credentials ADD COLUMN status TEXT NOT NULL DEFAULT 'connected'
    CHECK (status IN ('connected', 'disconnected', 'error', 'syncing'));
ALTER TABLE sync_credentials ADD COLUMN last_sync_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE sync_credentials ADD COLUMN last_sync_error TEXT;
ALTER TABLE sync_credentials ADD COLUMN sync_frequency TEXT NOT NULL DEFAULT 'daily'
    CHECK (sync_frequency IN ('daily', 'hourly', 'manual'));
ALTER TABLE sync_credentials ADD COLUMN account_count INTEGER NOT NULL DEFAULT 0;

-- Update synced_accounts to reference sync_credentials instead of connections
ALTER TABLE synced_accounts DROP CONSTRAINT IF EXISTS synced_accounts_connection_id_fkey;
ALTER TABLE synced_accounts RENAME COLUMN connection_id TO credential_id;
ALTER TABLE synced_accounts ADD CONSTRAINT synced_accounts_credential_id_fkey
    FOREIGN KEY (credential_id) REFERENCES sync_credentials(id) ON DELETE CASCADE;

-- Drop connections table
DROP TABLE IF EXISTS connections CASCADE;

-- Update name for existing credentials
UPDATE sync_credentials
SET name = 'Wealthsimple - ' || email
WHERE name IS NULL;

ALTER TABLE sync_credentials ALTER COLUMN name SET NOT NULL;
