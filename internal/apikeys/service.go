package apikeys

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
	"money/internal/auth"
	"money/internal/sync/encryption"
)

// Service provides API key management functionality
type Service struct {
	db         *sql.DB
	encryption *encryption.Service
}

// NewService creates a new API keys service
func NewService(db *sql.DB, encryptionKey string) (*Service, error) {
	encSvc, err := encryption.NewService(encryptionKey)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize encryption service: %w", err)
	}

	return &Service{
		db:         db,
		encryption: encSvc,
	}, nil
}

// SaveAPIKey saves or updates an API key for a provider
func (s *Service) SaveAPIKey(ctx context.Context, req *SaveAPIKeyRequest) (*APIKeyStatusResponse, error) {
	userID := auth.GetUserID(ctx)
	if userID == "" {
		return nil, fmt.Errorf("user not authenticated")
	}

	// Validate provider
	if !IsValidProvider(req.Provider) {
		return nil, fmt.Errorf("invalid provider: %s", req.Provider)
	}

	// Validate API key is not empty
	if req.APIKey == "" {
		return nil, fmt.Errorf("API key cannot be empty")
	}

	// Encrypt the API key
	encryptedKey, err := s.encryption.Encrypt(req.APIKey)
	if err != nil {
		return nil, fmt.Errorf("failed to encrypt API key: %w", err)
	}

	// Default name
	name := "Default"
	if req.Name != nil && *req.Name != "" {
		name = *req.Name
	}

	// Upsert the API key
	now := time.Now()
	newID := uuid.New().String()

	_, err = s.db.ExecContext(ctx, `
		INSERT INTO api_keys (id, user_id, provider, encrypted_api_key, name, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (user_id, provider) DO UPDATE SET
			encrypted_api_key = excluded.encrypted_api_key,
			name = excluded.name,
			is_active = 1,
			updated_at = $7
	`, newID, userID, req.Provider, encryptedKey, name, now, now)

	if err != nil {
		return nil, fmt.Errorf("failed to save API key: %w", err)
	}

	// Fetch the saved/updated API key status
	return s.GetAPIKeyStatus(ctx, req.Provider)
}

// GetAPIKeyStatus returns the status of an API key for a provider
func (s *Service) GetAPIKeyStatus(ctx context.Context, provider string) (*APIKeyStatusResponse, error) {
	userID := auth.GetUserID(ctx)
	if userID == "" {
		return nil, fmt.Errorf("user not authenticated")
	}

	// Validate provider
	if !IsValidProvider(provider) {
		return nil, fmt.Errorf("invalid provider: %s", provider)
	}

	var apiKey APIKey
	err := s.db.QueryRowContext(ctx, `
		SELECT id, user_id, provider, name, is_active, last_used_at, created_at, updated_at
		FROM api_keys
		WHERE user_id = $1 AND provider = $2
	`, userID, provider).Scan(
		&apiKey.ID, &apiKey.UserID, &apiKey.Provider, &apiKey.Name,
		&apiKey.IsActive, &apiKey.LastUsedAt, &apiKey.CreatedAt, &apiKey.UpdatedAt)

	if err == sql.ErrNoRows {
		// No key configured
		return &APIKeyStatusResponse{
			Provider:     provider,
			IsConfigured: false,
		}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get API key status: %w", err)
	}

	return &APIKeyStatusResponse{
		Provider:     apiKey.Provider,
		IsConfigured: true,
		Name:         &apiKey.Name,
		LastUsedAt:   apiKey.LastUsedAt,
		IsActive:     &apiKey.IsActive,
	}, nil
}

// GetDecryptedAPIKey retrieves and decrypts the API key for a provider
func (s *Service) GetDecryptedAPIKey(ctx context.Context, provider string) (string, error) {
	userID := auth.GetUserID(ctx)
	if userID == "" {
		return "", fmt.Errorf("user not authenticated")
	}

	// Validate provider
	if !IsValidProvider(provider) {
		return "", fmt.Errorf("invalid provider: %s", provider)
	}

	var encryptedKey []byte
	err := s.db.QueryRowContext(ctx, `
		SELECT encrypted_api_key
		FROM api_keys
		WHERE user_id = $1 AND provider = $2 AND is_active = true
	`, userID, provider).Scan(&encryptedKey)

	if err == sql.ErrNoRows {
		return "", fmt.Errorf("API key not configured for provider: %s", provider)
	}
	if err != nil {
		return "", fmt.Errorf("failed to get API key: %w", err)
	}

	// Decrypt the API key
	decryptedKey, err := s.encryption.Decrypt(encryptedKey)
	if err != nil {
		return "", fmt.Errorf("failed to decrypt API key: %w", err)
	}

	// Update last_used_at
	go s.updateLastUsed(context.Background(), userID, provider)

	return decryptedKey, nil
}

// DeleteAPIKey removes an API key for a provider
func (s *Service) DeleteAPIKey(ctx context.Context, provider string) (*DeleteResponse, error) {
	userID := auth.GetUserID(ctx)
	if userID == "" {
		return nil, fmt.Errorf("user not authenticated")
	}

	// Validate provider
	if !IsValidProvider(provider) {
		return nil, fmt.Errorf("invalid provider: %s", provider)
	}

	result, err := s.db.ExecContext(ctx, `
		DELETE FROM api_keys WHERE user_id = $1 AND provider = $2
	`, userID, provider)
	if err != nil {
		return nil, fmt.Errorf("failed to delete API key: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return nil, fmt.Errorf("failed to check rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return nil, fmt.Errorf("API key not found for provider: %s", provider)
	}

	return &DeleteResponse{Success: true}, nil
}

// updateLastUsed updates the last_used_at timestamp
func (s *Service) updateLastUsed(ctx context.Context, userID, provider string) {
	_, _ = s.db.ExecContext(ctx, `
		UPDATE api_keys SET last_used_at = $1 WHERE user_id = $2 AND provider = $3
	`, time.Now(), userID, provider)
}
