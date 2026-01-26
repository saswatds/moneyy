package passkey

import (
	"money/internal/auth"

	"github.com/go-webauthn/webauthn/webauthn"
)

// WebAuthnUser wraps auth.User to implement webauthn.User interface
type WebAuthnUser struct {
	*auth.User
	credentials []webauthn.Credential
}

// WebAuthnID returns the user's ID in bytes
func (u *WebAuthnUser) WebAuthnID() []byte {
	return []byte(u.ID)
}

// WebAuthnName returns the user's username
func (u *WebAuthnUser) WebAuthnName() string {
	return u.Email
}

// WebAuthnDisplayName returns the user's display name
func (u *WebAuthnUser) WebAuthnDisplayName() string {
	if u.Name != "" {
		return u.Name
	}
	return u.Email
}

// WebAuthnCredentials returns credentials owned by the user
func (u *WebAuthnUser) WebAuthnCredentials() []webauthn.Credential {
	return u.credentials
}

// WebAuthnIcon returns the user's icon URL (optional)
func (u *WebAuthnUser) WebAuthnIcon() string {
	return ""
}
