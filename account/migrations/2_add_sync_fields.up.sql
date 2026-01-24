-- Add sync-related fields to accounts table
ALTER TABLE accounts ADD COLUMN is_synced BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE accounts ADD COLUMN connection_id TEXT;

-- Create index on is_synced for filtering
CREATE INDEX idx_accounts_is_synced ON accounts(is_synced);

-- Create index on connection_id for looking up synced accounts
CREATE INDEX idx_accounts_connection_id ON accounts(connection_id);
