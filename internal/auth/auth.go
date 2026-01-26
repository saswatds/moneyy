package auth

import (
	"context"

	"github.com/go-chi/chi/v5"
)

// AuthProvider is the interface for authentication providers
type AuthProvider interface {
	// Initialize sets up the auth provider
	Initialize(ctx context.Context) error

	// VerifyToken validates a JWT and returns the user ID
	VerifyToken(ctx context.Context, token string) (string, error)

	// GetAuthMode returns "passkey" or "clerk"
	GetAuthMode() string

	// RegisterRoutes registers auth-specific routes
	RegisterRoutes(r chi.Router)
}

// Claims represents JWT claims
type Claims struct {
	UserID    string `json:"user_id"`
	Email     string `json:"email"`
	IssuedAt  int64  `json:"iat"`
	ExpiresAt int64  `json:"exp"`
}
