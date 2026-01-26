-- Clear stored username/password credentials for security
-- After OTP verification, we only use refresh tokens for authentication
-- This migration clears any existing stored credentials to reduce security risk

-- First, remove NOT NULL constraints so we can clear the credentials
ALTER TABLE sync_credentials ALTER COLUMN encrypted_username DROP NOT NULL;
ALTER TABLE sync_credentials ALTER COLUMN encrypted_password DROP NOT NULL;

-- Now clear stored credentials for all accounts with valid tokens
UPDATE sync_credentials
SET encrypted_username = NULL,
    encrypted_password = NULL,
    encrypted_otp_claim = NULL
WHERE encrypted_access_token IS NOT NULL; -- Only clear if we have tokens
