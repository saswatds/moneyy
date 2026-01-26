-- Remove backup flags from webauthn_credentials
ALTER TABLE webauthn_credentials
DROP COLUMN backup_eligible,
DROP COLUMN backup_state;
