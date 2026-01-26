package passkey

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"
)

// Credential represents a WebAuthn credential in the database
type Credential struct {
	ID             string
	UserID         string
	CredentialID   []byte
	PublicKey      []byte
	AAGUID         []byte
	SignCount      uint32
	CloneWarning   bool
	BackupEligible bool
	BackupState    bool
	CreatedAt      time.Time
	LastUsedAt     *time.Time
}

// CredentialRepository handles credential database operations
type CredentialRepository struct {
	db *sql.DB
}

// NewCredentialRepository creates a new credential repository
func NewCredentialRepository(db *sql.DB) *CredentialRepository {
	return &CredentialRepository{db: db}
}

// Create creates a new credential
func (r *CredentialRepository) Create(ctx context.Context, cred *Credential) error {
	query := `
		INSERT INTO webauthn_credentials (user_id, credential_id, public_key, aaguid, sign_count, backup_eligible, backup_state, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
		RETURNING id, created_at
	`

	err := r.db.QueryRowContext(
		ctx,
		query,
		cred.UserID,
		cred.CredentialID,
		cred.PublicKey,
		cred.AAGUID,
		cred.SignCount,
		cred.BackupEligible,
		cred.BackupState,
	).Scan(&cred.ID, &cred.CreatedAt)

	if err != nil {
		return fmt.Errorf("failed to create credential: %w", err)
	}

	return nil
}

// GetByCredentialID retrieves a credential by its credential ID
func (r *CredentialRepository) GetByCredentialID(ctx context.Context, credentialID []byte) (*Credential, error) {
	query := `
		SELECT id, user_id, credential_id, public_key, aaguid, sign_count, clone_warning, backup_eligible, backup_state, created_at, last_used_at
		FROM webauthn_credentials
		WHERE credential_id = $1
	`

	var cred Credential
	var lastUsedAt sql.NullTime

	err := r.db.QueryRowContext(ctx, query, credentialID).Scan(
		&cred.ID,
		&cred.UserID,
		&cred.CredentialID,
		&cred.PublicKey,
		&cred.AAGUID,
		&cred.SignCount,
		&cred.CloneWarning,
		&cred.BackupEligible,
		&cred.BackupState,
		&cred.CreatedAt,
		&lastUsedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("credential not found")
		}
		return nil, fmt.Errorf("failed to get credential: %w", err)
	}

	if lastUsedAt.Valid {
		cred.LastUsedAt = &lastUsedAt.Time
	}

	return &cred, nil
}

// GetByUserID retrieves all credentials for a user
func (r *CredentialRepository) GetByUserID(ctx context.Context, userID string) ([]*Credential, error) {
	query := `
		SELECT id, user_id, credential_id, public_key, aaguid, sign_count, clone_warning, backup_eligible, backup_state, created_at, last_used_at
		FROM webauthn_credentials
		WHERE user_id = $1
		ORDER BY created_at DESC
	`

	rows, err := r.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get credentials: %w", err)
	}
	defer rows.Close()

	var credentials []*Credential
	for rows.Next() {
		var cred Credential
		var lastUsedAt sql.NullTime

		err := rows.Scan(
			&cred.ID,
			&cred.UserID,
			&cred.CredentialID,
			&cred.PublicKey,
			&cred.AAGUID,
			&cred.SignCount,
			&cred.CloneWarning,
			&cred.BackupEligible,
			&cred.BackupState,
			&cred.CreatedAt,
			&lastUsedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan credential: %w", err)
		}

		if lastUsedAt.Valid {
			cred.LastUsedAt = &lastUsedAt.Time
		}

		credentials = append(credentials, &cred)
	}

	return credentials, nil
}

// UpdateSignCount updates the sign count and last used timestamp
func (r *CredentialRepository) UpdateSignCount(ctx context.Context, credentialID []byte, signCount uint32) error {
	query := `
		UPDATE webauthn_credentials
		SET sign_count = $2, last_used_at = NOW()
		WHERE credential_id = $1
	`

	_, err := r.db.ExecContext(ctx, query, credentialID, signCount)
	if err != nil {
		return fmt.Errorf("failed to update sign count: %w", err)
	}

	return nil
}

// SetCloneWarning sets the clone warning flag
func (r *CredentialRepository) SetCloneWarning(ctx context.Context, credentialID []byte) error {
	query := `
		UPDATE webauthn_credentials
		SET clone_warning = true
		WHERE credential_id = $1
	`

	_, err := r.db.ExecContext(ctx, query, credentialID)
	if err != nil {
		return fmt.Errorf("failed to set clone warning: %w", err)
	}

	return nil
}

// ToWebAuthnCredential converts a database credential to a WebAuthn credential
func (c *Credential) ToWebAuthnCredential() webauthn.Credential {
	return webauthn.Credential{
		ID:              c.CredentialID,
		PublicKey:       c.PublicKey,
		AttestationType: "",
		Transport:       []protocol.AuthenticatorTransport{},
		Flags: webauthn.CredentialFlags{
			UserPresent:    true,
			UserVerified:   true,
			BackupEligible: c.BackupEligible,
			BackupState:    c.BackupState,
		},
		Authenticator: webauthn.Authenticator{
			AAGUID:       c.AAGUID,
			SignCount:    c.SignCount,
			CloneWarning: c.CloneWarning,
		},
	}
}
