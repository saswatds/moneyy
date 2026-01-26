-- Create webauthn_credentials table for selfhosted mode
CREATE TABLE webauthn_credentials (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    credential_id BYTEA NOT NULL UNIQUE,
    public_key BYTEA NOT NULL,
    aaguid BYTEA NOT NULL,
    sign_count INTEGER NOT NULL DEFAULT 0,
    clone_warning BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_webauthn_credentials_user_id ON webauthn_credentials(user_id);
CREATE UNIQUE INDEX idx_webauthn_credentials_credential_id ON webauthn_credentials(credential_id);
