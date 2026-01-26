package main

import (
	"database/sql"

	"money/internal/auth"
	"money/internal/auth/passkey"
)

func initializeAuthProvider(db *sql.DB) (auth.AuthProvider, error) {
	return passkey.NewPasskeyAuthProvider(db)
}
