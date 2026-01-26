-- Down migration: Restore NOT NULL constraints
-- Cannot restore cleared credential values - users will need to re-authenticate
-- This is intentional for security reasons

-- Restore NOT NULL constraints
-- Note: This will fail if there are NULL values. In that case, delete those rows first.
ALTER TABLE sync_credentials ALTER COLUMN encrypted_username SET NOT NULL;
ALTER TABLE sync_credentials ALTER COLUMN encrypted_password SET NOT NULL;
