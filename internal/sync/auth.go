package sync

import (
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"money/internal/sync/encryption"
	"money/internal/sync/wealthsimple"

	"github.com/google/uuid"
)

// initiateWealthsimpleConnectionReal implements the real Wealthsimple connection flow
func (s *Service) initiateWealthsimpleConnectionReal(ctx context.Context, userID, username, password string) (*InitiateConnectionResponse, error) {
	// Initialize encryption service
	encService, err := encryption.NewService(s.encryptionKey)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize encryption: %w", err)
	}

	// Generate device IDs
	deviceID := uuid.New().String()
	sessionID := uuid.New().String()
	appInstanceID := uuid.New().String()

	// Create Wealthsimple client
	wsClient := wealthsimple.NewClient(deviceID, sessionID, appInstanceID)

	// Attempt login
	loginResp, err := wsClient.Login(ctx, username, password)
	if err != nil {
		return nil, fmt.Errorf("failed to login to Wealthsimple: %w", err)
	}

	// Encrypt credentials
	encryptedUsername, err := encService.Encrypt(username)
	if err != nil {
		return nil, fmt.Errorf("failed to encrypt username: %w", err)
	}

	encryptedPassword, err := encService.Encrypt(password)
	if err != nil {
		return nil, fmt.Errorf("failed to encrypt password: %w", err)
	}

	// Store encrypted credentials in database (temporary, until OTP verified)
	var credentialID string
	connectionName := fmt.Sprintf("Wealthsimple - %s", username)
	err = s.db.QueryRowContext(ctx, `
		INSERT INTO sync_credentials (
			user_id, provider, name, status, sync_frequency,
			encrypted_username, encrypted_password,
			device_id, session_id, app_instance_id, email,
			created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
		ON CONFLICT (user_id) DO UPDATE SET
			name = EXCLUDED.name,
			encrypted_username = EXCLUDED.encrypted_username,
			encrypted_password = EXCLUDED.encrypted_password,
			device_id = EXCLUDED.device_id,
			session_id = EXCLUDED.session_id,
			app_instance_id = EXCLUDED.app_instance_id,
			email = EXCLUDED.email,
			updated_at = EXCLUDED.updated_at
		RETURNING id
	`, userID, ProviderWealthsimple, connectionName, StatusSyncing, SyncFrequencyDaily,
		encryptedUsername, encryptedPassword,
		deviceID, sessionID, appInstanceID, username, time.Now(), time.Now()).Scan(&credentialID)

	if err != nil {
		return nil, fmt.Errorf("failed to store credentials: %w", err)
	}

	if loginResp.OTPRequired {
		// Store OTP authenticated claim for next step
		if loginResp.OTPAuthenticatedClaim != "" {
			encryptedClaim, _ := encService.Encrypt(loginResp.OTPAuthenticatedClaim)
			_, _ = s.db.ExecContext(ctx, `
				UPDATE sync_credentials
				SET encrypted_otp_claim = $1
				WHERE id = $2
			`, encryptedClaim, credentialID)
		}

		return &InitiateConnectionResponse{
			CredentialID: credentialID,
			RequireOTP:   true,
			Message:      "OTP required. Check your authenticator app.",
		}, nil
	}

	// If no OTP required (unlikely for Wealthsimple), proceed directly
	return &InitiateConnectionResponse{
		CredentialID: credentialID,
		RequireOTP:   false,
		Message:      "Authentication successful.",
	}, nil
}

// verifyOTPReal implements the real OTP verification flow
func (s *Service) verifyOTPReal(ctx context.Context, credentialID, otpCode string) (*VerifyOTPResponse, error) {
	// Get credential from database
	var creds struct {
		UserID                string
		EncryptedUsername     []byte
		EncryptedPassword     []byte
		EncryptedOTPClaim     []byte
		DeviceID              string
		SessionID             string
		AppInstanceID         string
	}

	err := s.db.QueryRowContext(ctx, `
		SELECT user_id, encrypted_username, encrypted_password, encrypted_otp_claim,
		       device_id, session_id, app_instance_id
		FROM sync_credentials
		WHERE id = $1
	`, credentialID).Scan(
		&creds.UserID,
		&creds.EncryptedUsername,
		&creds.EncryptedPassword,
		&creds.EncryptedOTPClaim,
		&creds.DeviceID,
		&creds.SessionID,
		&creds.AppInstanceID,
	)

	if err != nil {
		return nil, fmt.Errorf("credential not found: %w", err)
	}

	// Initialize encryption service
	encService, err := encryption.NewService(s.encryptionKey)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize encryption: %w", err)
	}

	// Decrypt credentials
	username, err := encService.Decrypt(creds.EncryptedUsername)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt username: %w", err)
	}

	password, err := encService.Decrypt(creds.EncryptedPassword)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt password: %w", err)
	}

	otpAuthenticatedClaim := ""
	if len(creds.EncryptedOTPClaim) > 0 {
		otpAuthenticatedClaim, _ = encService.Decrypt(creds.EncryptedOTPClaim)
	}

	// Create Wealthsimple client
	wsClient := wealthsimple.NewClient(creds.DeviceID, creds.SessionID, creds.AppInstanceID)

	// Complete authentication with OTP
	tokenResp, err := wsClient.VerifyOTP(ctx, username, password, otpCode, otpAuthenticatedClaim)
	if err != nil {
		return nil, fmt.Errorf("failed to verify OTP: %w", err)
	}

	log.Printf("DEBUG: received token response: identity_id=%s email=%s",
		tokenResp.IdentityCanonicalID, tokenResp.Email)

	// If identity_canonical_id is empty, extract it from the JWT token
	identityID := tokenResp.IdentityCanonicalID
	if identityID == "" {
		identityID = extractIdentityFromJWT(tokenResp.AccessToken)
		log.Printf("INFO: extracted identity from JWT: identity_id=%s", identityID)
	}

	// Encrypt tokens
	encryptedAccessToken, err := encService.Encrypt(tokenResp.AccessToken)
	if err != nil {
		return nil, fmt.Errorf("failed to encrypt access token: %w", err)
	}

	encryptedRefreshToken, err := encService.Encrypt(tokenResp.RefreshToken)
	if err != nil {
		return nil, fmt.Errorf("failed to encrypt refresh token: %w", err)
	}

	// Parse expiration time
	expiresAt, _ := time.Parse(time.RFC3339, tokenResp.ExpiresAt)

	// Store tokens in credentials
	profilesJSON := `{}`
	if len(tokenResp.Profiles) > 0 {
		// Simple JSON serialization
		profilesJSON = `{`
		first := true
		for key, val := range tokenResp.Profiles {
			if !first {
				profilesJSON += ","
			}
			defaultID := ""
			if def, ok := val["default"]; ok {
				defaultID = def
			}
			profilesJSON += fmt.Sprintf(`"%s":{"default":"%s"}`, key, defaultID)
			first = false
		}
		profilesJSON += `}`
	}

	log.Printf("DEBUG: storing identity_canonical_id: identity_id=%s credential_id=%s",
		identityID, credentialID)

	_, err = s.db.ExecContext(ctx, `
		UPDATE sync_credentials
		SET encrypted_access_token = $1,
		    encrypted_refresh_token = $2,
		    token_expires_at = $3,
		    identity_canonical_id = $4,
		    profiles = $5::jsonb,
		    updated_at = $6
		WHERE id = $7
	`, encryptedAccessToken, encryptedRefreshToken, expiresAt,
		identityID, profilesJSON, time.Now(), credentialID)

	if err != nil {
		return nil, fmt.Errorf("failed to store tokens: %w", err)
	}

	// Update connection status to syncing (credential already exists)
	connectionName := fmt.Sprintf("Wealthsimple - %s", tokenResp.Email)
	_, err = s.db.ExecContext(ctx, `
		UPDATE sync_credentials
		SET name = $1, status = $2, updated_at = $3
		WHERE id = $4
	`, connectionName, StatusSyncing, time.Now(), credentialID)

	if err != nil {
		return nil, fmt.Errorf("failed to update connection: %w", err)
	}

	// Trigger initial sync in background
	go func() {
		bgCtx := context.Background()
		if err := s.performInitialSync(bgCtx, creds.UserID, credentialID); err != nil {
			log.Printf("ERROR: initial sync failed: error=%v credential_id=%s", err, credentialID)
			_, _ = s.db.ExecContext(bgCtx, `
				UPDATE sync_credentials
				SET status = $1, last_sync_error = $2, updated_at = $3
				WHERE id = $4
			`, StatusError, err.Error(), time.Now(), credentialID)
		}
	}()

	return &VerifyOTPResponse{
		CredentialID: credentialID,
		Status:       StatusSyncing,
		Message:      "Authentication successful. Initial sync started.",
	}, nil
}

// refreshAccessToken refreshes an expired access token
func (s *Service) refreshAccessToken(ctx context.Context, credentialID string) error {
	// Get credential
	var creds struct {
		EncryptedRefreshToken []byte
		DeviceID              string
		SessionID             string
		AppInstanceID         string
	}

	err := s.db.QueryRowContext(ctx, `
		SELECT encrypted_refresh_token, device_id, session_id, app_instance_id
		FROM sync_credentials
		WHERE id = $1
	`, credentialID).Scan(
		&creds.EncryptedRefreshToken,
		&creds.DeviceID,
		&creds.SessionID,
		&creds.AppInstanceID,
	)

	if err != nil {
		return fmt.Errorf("credential not found: %w", err)
	}

	// Initialize encryption service
	encService, err := encryption.NewService(s.encryptionKey)
	if err != nil {
		return fmt.Errorf("failed to initialize encryption: %w", err)
	}

	// Decrypt refresh token
	refreshToken, err := encService.Decrypt(creds.EncryptedRefreshToken)
	if err != nil {
		return fmt.Errorf("failed to decrypt refresh token: %w", err)
	}

	// Create client and refresh
	wsClient := wealthsimple.NewClient(creds.DeviceID, creds.SessionID, creds.AppInstanceID)
	tokenResp, err := wsClient.RefreshAccessToken(ctx, refreshToken)
	if err != nil {
		return fmt.Errorf("failed to refresh token: %w", err)
	}

	// Encrypt new tokens
	encryptedAccessToken, err := encService.Encrypt(tokenResp.AccessToken)
	if err != nil {
		return fmt.Errorf("failed to encrypt access token: %w", err)
	}

	encryptedRefreshToken, err := encService.Encrypt(tokenResp.RefreshToken)
	if err != nil {
		return fmt.Errorf("failed to encrypt refresh token: %w", err)
	}

	// Parse expiration
	expiresAt, _ := time.Parse(time.RFC3339, tokenResp.ExpiresAt)

	// Update tokens
	_, err = s.db.ExecContext(ctx, `
		UPDATE sync_credentials
		SET encrypted_access_token = $1,
		    encrypted_refresh_token = $2,
		    token_expires_at = $3,
		    updated_at = $4
		WHERE id = $5
	`, encryptedAccessToken, encryptedRefreshToken, expiresAt, time.Now(), credentialID)

	return err
}

// getDecryptedCredentials retrieves and decrypts credentials for a user
func (s *Service) getDecryptedCredentials(ctx context.Context, userID string) (*wealthsimple.Client, error) {
	var creds struct {
		ID                    string
		EncryptedAccessToken  []byte
		TokenExpiresAt        sql.NullTime
		DeviceID              string
		SessionID             string
		AppInstanceID         string
	}

	err := s.db.QueryRowContext(ctx, `
		SELECT id, encrypted_access_token, token_expires_at,
		       device_id, session_id, app_instance_id
		FROM sync_credentials
		WHERE user_id = $1 AND provider = $2
	`, userID, ProviderWealthsimple).Scan(
		&creds.ID,
		&creds.EncryptedAccessToken,
		&creds.TokenExpiresAt,
		&creds.DeviceID,
		&creds.SessionID,
		&creds.AppInstanceID,
	)

	if err != nil {
		return nil, fmt.Errorf("credentials not found: %w", err)
	}

	// Check if token needs refresh
	if creds.TokenExpiresAt.Valid && time.Now().After(creds.TokenExpiresAt.Time.Add(-5*time.Minute)) {
		// Token expired or expiring soon, refresh it
		if err := s.refreshAccessToken(ctx, creds.ID); err != nil {
			return nil, fmt.Errorf("failed to refresh token: %w", err)
		}

		// Re-fetch credentials
		err = s.db.QueryRowContext(ctx, `
			SELECT encrypted_access_token
			FROM sync_credentials
			WHERE id = $1
		`, creds.ID).Scan(&creds.EncryptedAccessToken)

		if err != nil {
			return nil, fmt.Errorf("failed to re-fetch credentials: %w", err)
		}
	}

	// Decrypt access token
	encService, err := encryption.NewService(s.encryptionKey)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize encryption: %w", err)
	}

	accessToken, err := encService.Decrypt(creds.EncryptedAccessToken)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt access token: %w", err)
	}

	// Create authenticated client
	client := wealthsimple.NewClient(creds.DeviceID, creds.SessionID, creds.AppInstanceID)
	client.SetAccessToken(accessToken)

	return client, nil
}

// extractIdentityFromJWT extracts the identity ID from the JWT access token
func extractIdentityFromJWT(token string) string {
	// JWT format: header.payload.signature
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return ""
	}

	// Decode the payload (second part)
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return ""
	}

	// Parse JSON
	var claims map[string]interface{}
	if err := json.Unmarshal(payload, &claims); err != nil {
		return ""
	}

	// Extract "sub" claim which contains the identity ID
	if sub, ok := claims["sub"].(string); ok {
		return sub
	}

	return ""
}
