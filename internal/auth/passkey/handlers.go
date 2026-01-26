package passkey

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"money/internal/auth"
	"money/internal/server"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"
)

// Session store for WebAuthn challenges (in-memory for simplicity)
var sessionStore = make(map[string]*webauthn.SessionData)

// handleStatus checks if registration is needed
func (p *PasskeyAuthProvider) handleStatus(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Check if credentials exist for the single user
	credentials, err := p.credRepo.GetByUserID(ctx, SingleUserID)
	if err != nil {
		log.Printf("Error checking credentials: %v", err)
		server.RespondJSON(w, http.StatusOK, map[string]interface{}{
			"registered":    false,
			"needs_setup":   true,
			"error_details": err.Error(),
		})
		return
	}

	server.RespondJSON(w, http.StatusOK, map[string]interface{}{
		"registered":  len(credentials) > 0,
		"needs_setup": len(credentials) == 0,
	})
}

// handleRegistrationBegin starts the passkey registration process
func (p *PasskeyAuthProvider) handleRegistrationBegin(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Check if credentials already exist
	credentials, err := p.credRepo.GetByUserID(ctx, SingleUserID)
	if err != nil {
		log.Printf("Error checking credentials: %v", err)
		http.Error(w, `{"error":"internal_error"}`, http.StatusInternalServerError)
		return
	}

	if len(credentials) > 0 {
		http.Error(w, `{"error":"already_registered"}`, http.StatusBadRequest)
		return
	}

	// Get the user
	user, err := p.userRepo.GetByID(ctx, SingleUserID)
	if err != nil {
		log.Printf("Error getting user: %v", err)
		http.Error(w, `{"error":"user_not_found"}`, http.StatusInternalServerError)
		return
	}

	// Create WebAuthn user
	webAuthnUser := &WebAuthnUser{
		User:        user,
		credentials: []webauthn.Credential{},
	}

	// Generate registration options
	options, sessionData, err := p.webAuthn.BeginRegistration(webAuthnUser)
	if err != nil {
		log.Printf("Error beginning registration: %v", err)
		http.Error(w, `{"error":"registration_failed"}`, http.StatusInternalServerError)
		return
	}

	// Store session data
	sessionStore[SingleUserID] = sessionData

	// Return options to client
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(options)
}

// RegistrationFinishRequest represents the finish registration request
type RegistrationFinishRequest struct {
	Response protocol.CredentialCreationResponse `json:"response"`
}

// handleRegistrationFinish completes the passkey registration
func (p *PasskeyAuthProvider) handleRegistrationFinish(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Get user
	user, err := p.userRepo.GetByID(ctx, SingleUserID)
	if err != nil {
		log.Printf("Error getting user: %v", err)
		http.Error(w, `{"error":"user_not_found"}`, http.StatusInternalServerError)
		return
	}

	// Get session data
	sessionData, ok := sessionStore[SingleUserID]
	if !ok {
		http.Error(w, `{"error":"session_not_found"}`, http.StatusBadRequest)
		return
	}
	delete(sessionStore, SingleUserID)

	// Create WebAuthn user with no credentials
	webAuthnUser := &WebAuthnUser{
		User:        user,
		credentials: []webauthn.Credential{},
	}

	// Verify registration - let webauthn library parse the request body
	credential, err := p.webAuthn.FinishRegistration(webAuthnUser, *sessionData, r)
	if err != nil {
		log.Printf("Error finishing registration: %v", err)
		http.Error(w, fmt.Sprintf(`{"error":"registration_verification_failed","details":"%v"}`, err), http.StatusBadRequest)
		return
	}

	// Store credential in database
	dbCred := &Credential{
		UserID:         SingleUserID,
		CredentialID:   credential.ID,
		PublicKey:      credential.PublicKey,
		AAGUID:         credential.Authenticator.AAGUID,
		SignCount:      credential.Authenticator.SignCount,
		BackupEligible: credential.Flags.BackupEligible,
		BackupState:    credential.Flags.BackupState,
	}

	err = p.credRepo.Create(ctx, dbCred)
	if err != nil {
		log.Printf("Error storing credential: %v", err)
		http.Error(w, `{"error":"failed_to_store_credential"}`, http.StatusInternalServerError)
		return
	}

	// Generate JWT
	token, err := auth.GenerateJWT(user.ID, user.Email, p.jwtSecret)
	if err != nil {
		log.Printf("Error generating JWT: %v", err)
		http.Error(w, `{"error":"token_generation_failed"}`, http.StatusInternalServerError)
		return
	}

	// Create session
	session := &auth.Session{
		UserID:    user.ID,
		TokenHash: auth.HashToken(token),
		ExpiresAt: time.Now().Add(auth.TokenExpiry),
		IPAddress: r.RemoteAddr,
		UserAgent: r.UserAgent(),
	}

	err = p.sessionRepo.Create(ctx, session)
	if err != nil {
		log.Printf("Error creating session: %v", err)
		http.Error(w, `{"error":"session_creation_failed"}`, http.StatusInternalServerError)
		return
	}

	// Return token and user
	server.RespondJSON(w, http.StatusOK, map[string]interface{}{
		"token": token,
		"user": map[string]string{
			"id":    user.ID,
			"email": user.Email,
			"name":  user.Name,
		},
	})
}

// handleLoginBegin starts the passkey login process
func (p *PasskeyAuthProvider) handleLoginBegin(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Get user
	user, err := p.userRepo.GetByID(ctx, SingleUserID)
	if err != nil {
		log.Printf("Error getting user: %v", err)
		http.Error(w, `{"error":"user_not_found"}`, http.StatusInternalServerError)
		return
	}

	// Get credentials
	dbCredentials, err := p.credRepo.GetByUserID(ctx, SingleUserID)
	if err != nil || len(dbCredentials) == 0 {
		log.Printf("No credentials found for user")
		http.Error(w, `{"error":"no_credentials"}`, http.StatusBadRequest)
		return
	}

	// Convert to WebAuthn credentials
	credentials := make([]webauthn.Credential, len(dbCredentials))
	for i, dbCred := range dbCredentials {
		credentials[i] = dbCred.ToWebAuthnCredential()
	}

	// Create WebAuthn user
	webAuthnUser := &WebAuthnUser{
		User:        user,
		credentials: credentials,
	}

	// Generate assertion options
	options, sessionData, err := p.webAuthn.BeginLogin(webAuthnUser)
	if err != nil {
		log.Printf("Error beginning login: %v", err)
		http.Error(w, `{"error":"login_failed"}`, http.StatusInternalServerError)
		return
	}

	// Store session data
	sessionStore[SingleUserID] = sessionData

	// Return options to client
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(options)
}

// LoginFinishRequest represents the finish login request
type LoginFinishRequest struct {
	Response protocol.CredentialAssertionResponse `json:"response"`
}

// handleLoginFinish completes the passkey login
func (p *PasskeyAuthProvider) handleLoginFinish(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Get user
	user, err := p.userRepo.GetByID(ctx, SingleUserID)
	if err != nil {
		log.Printf("Error getting user: %v", err)
		http.Error(w, `{"error":"user_not_found"}`, http.StatusInternalServerError)
		return
	}

	// Get session data
	sessionData, ok := sessionStore[SingleUserID]
	if !ok {
		http.Error(w, `{"error":"session_not_found"}`, http.StatusBadRequest)
		return
	}
	delete(sessionStore, SingleUserID)

	// Get credentials
	dbCredentials, err := p.credRepo.GetByUserID(ctx, SingleUserID)
	if err != nil {
		log.Printf("Error getting credentials: %v", err)
		http.Error(w, `{"error":"credentials_not_found"}`, http.StatusInternalServerError)
		return
	}

	// Convert to WebAuthn credentials
	credentials := make([]webauthn.Credential, len(dbCredentials))
	for i, dbCred := range dbCredentials {
		credentials[i] = dbCred.ToWebAuthnCredential()
	}

	// Create WebAuthn user
	webAuthnUser := &WebAuthnUser{
		User:        user,
		credentials: credentials,
	}

	// Verify assertion - let webauthn library parse the request body
	credential, err := p.webAuthn.FinishLogin(webAuthnUser, *sessionData, r)
	if err != nil {
		log.Printf("Error finishing login: %v", err)
		http.Error(w, fmt.Sprintf(`{"error":"login_verification_failed","details":"%v"}`, err), http.StatusBadRequest)
		return
	}

	// Update sign count
	err = p.credRepo.UpdateSignCount(ctx, credential.ID, credential.Authenticator.SignCount)
	if err != nil {
		log.Printf("Error updating sign count: %v", err)
		// Don't fail the login, just log the error
	}

	// Check for clone warning
	if credential.Authenticator.CloneWarning {
		log.Printf("Clone warning for credential: %x", credential.ID)
		_ = p.credRepo.SetCloneWarning(ctx, credential.ID)
	}

	// Generate JWT
	token, err := auth.GenerateJWT(user.ID, user.Email, p.jwtSecret)
	if err != nil {
		log.Printf("Error generating JWT: %v", err)
		http.Error(w, `{"error":"token_generation_failed"}`, http.StatusInternalServerError)
		return
	}

	// Create session
	session := &auth.Session{
		UserID:    user.ID,
		TokenHash: auth.HashToken(token),
		ExpiresAt: time.Now().Add(auth.TokenExpiry),
		IPAddress: r.RemoteAddr,
		UserAgent: r.UserAgent(),
	}

	err = p.sessionRepo.Create(ctx, session)
	if err != nil {
		log.Printf("Error creating session: %v", err)
		http.Error(w, `{"error":"session_creation_failed"}`, http.StatusInternalServerError)
		return
	}

	// Return token and user
	server.RespondJSON(w, http.StatusOK, map[string]interface{}{
		"token": token,
		"user": map[string]string{
			"id":    user.ID,
			"email": user.Email,
			"name":  user.Name,
		},
	})
}
