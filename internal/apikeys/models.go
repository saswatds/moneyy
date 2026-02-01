package apikeys

import (
	"time"
)

// APIKey represents an API key stored in the database
type APIKey struct {
	ID              string     `json:"id"`
	UserID          string     `json:"user_id"`
	Provider        string     `json:"provider"`
	EncryptedAPIKey []byte     `json:"-"` // Never expose encrypted key
	Name            string     `json:"name"`
	IsActive        bool       `json:"is_active"`
	LastUsedAt      *time.Time `json:"last_used_at,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

// SaveAPIKeyRequest represents a request to save an API key
type SaveAPIKeyRequest struct {
	Provider string  `json:"provider"`
	APIKey   string  `json:"api_key"`
	Name     *string `json:"name,omitempty"`
}

// APIKeyStatusResponse represents the status of an API key (without the actual key)
type APIKeyStatusResponse struct {
	Provider     string     `json:"provider"`
	IsConfigured bool       `json:"is_configured"`
	Name         *string    `json:"name,omitempty"`
	LastUsedAt   *time.Time `json:"last_used_at,omitempty"`
	IsActive     *bool      `json:"is_active,omitempty"`
}

// DeleteResponse represents a successful delete response
type DeleteResponse struct {
	Success bool `json:"success"`
}

// Supported providers
const (
	ProviderMoneyy = "moneyy"
)

// ValidProviders lists all valid provider names
var ValidProviders = []string{ProviderMoneyy}

// IsValidProvider checks if a provider name is valid
func IsValidProvider(provider string) bool {
	for _, p := range ValidProviders {
		if p == provider {
			return true
		}
	}
	return false
}
