-- Add backup_eligible and backup_state flags to webauthn_credentials
ALTER TABLE webauthn_credentials
ADD COLUMN backup_eligible BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN backup_state BOOLEAN NOT NULL DEFAULT false;
