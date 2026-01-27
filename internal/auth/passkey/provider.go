package passkey

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"

	"money/internal/auth"

	"github.com/go-chi/chi/v5"
	"github.com/go-webauthn/webauthn/webauthn"
)

const SingleUserID = "selfhosted-user"
const DemoUserID = "demo-user"

// PasskeyAuthProvider implements auth.AuthProvider for self-hosted mode
type PasskeyAuthProvider struct {
	db          *sql.DB
	webAuthn    *webauthn.WebAuthn
	jwtSecret   []byte
	userRepo    *auth.UserRepository
	sessionRepo *auth.SessionRepository
	credRepo    *CredentialRepository
}

// NewPasskeyAuthProvider creates a new passkey auth provider
func NewPasskeyAuthProvider(db *sql.DB) (*PasskeyAuthProvider, error) {
	// Get JWT secret from environment
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		return nil, fmt.Errorf("JWT_SECRET environment variable is required")
	}

	if len(jwtSecret) < 32 {
		return nil, fmt.Errorf("JWT_SECRET must be at least 32 characters")
	}

	// Get WebAuthn configuration from environment
	rpID := os.Getenv("WEBAUTHN_RP_ID")
	if rpID == "" {
		rpID = "localhost"
	}

	rpOrigin := os.Getenv("WEBAUTHN_RP_ORIGIN")
	if rpOrigin == "" {
		rpOrigin = "http://localhost:4000"
	}

	// Initialize WebAuthn
	wconfig := &webauthn.Config{
		RPDisplayName: "Money",
		RPID:          rpID,
		RPOrigins:     []string{rpOrigin},
	}

	webAuthn, err := webauthn.New(wconfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create webauthn: %w", err)
	}

	return &PasskeyAuthProvider{
		db:          db,
		webAuthn:    webAuthn,
		jwtSecret:   []byte(jwtSecret),
		userRepo:    auth.NewUserRepository(db),
		sessionRepo: auth.NewSessionRepository(db),
		credRepo:    NewCredentialRepository(db),
	}, nil
}

// Initialize sets up the auth provider
func (p *PasskeyAuthProvider) Initialize(ctx context.Context) error {
	// Create default user if doesn't exist
	user, err := p.userRepo.GetByID(ctx, SingleUserID)
	if err != nil {
		if err.Error() == "user not found" {
			log.Println("Creating default self-hosted user")
			user = &auth.User{
				ID:    SingleUserID,
				Email: "admin@selfhosted.local",
				Name:  "Administrator",
			}
			err = p.userRepo.Create(ctx, user)
			if err != nil {
				return fmt.Errorf("failed to create default user: %w", err)
			}
		} else {
			return err
		}
	}

	// Create demo user if doesn't exist
	demoUser, err := p.userRepo.GetByID(ctx, DemoUserID)
	if err != nil {
		if err.Error() == "user not found" {
			log.Println("Creating demo user")
			demoUser = &auth.User{
				ID:    DemoUserID,
				Email: "demo@local",
				Name:  "Demo User",
			}
			err = p.userRepo.Create(ctx, demoUser)
			if err != nil {
				return fmt.Errorf("failed to create demo user: %w", err)
			}
		} else {
			return err
		}
	}

	log.Printf("Passkey authentication initialized for user: %s", user.Email)
	log.Printf("Demo user initialized: %s", demoUser.Email)
	return nil
}

// VerifyToken validates a JWT and returns the user ID
func (p *PasskeyAuthProvider) VerifyToken(ctx context.Context, token string) (string, error) {
	// Verify JWT
	claims, err := auth.VerifyJWT(token, p.jwtSecret)
	if err != nil {
		return "", fmt.Errorf("invalid token: %w", err)
	}

	// Verify session exists and is valid
	tokenHash := auth.HashToken(token)
	session, err := p.sessionRepo.GetByTokenHash(ctx, tokenHash)
	if err != nil {
		return "", fmt.Errorf("session not found: %w", err)
	}

	// Update last activity
	_ = p.sessionRepo.UpdateActivity(ctx, session.ID)

	return claims.UserID, nil
}

// GetAuthMode returns "passkey"
func (p *PasskeyAuthProvider) GetAuthMode() string {
	return "passkey"
}

// RegisterRoutes registers passkey-specific routes
func (p *PasskeyAuthProvider) RegisterRoutes(r chi.Router) {
	r.Post("/register/begin", p.handleRegistrationBegin)
	r.Post("/register/finish", p.handleRegistrationFinish)
	r.Post("/login/begin", p.handleLoginBegin)
	r.Post("/login/finish", p.handleLoginFinish)
	r.Get("/status", p.handleStatus)
}
