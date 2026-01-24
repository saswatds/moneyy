// Service sync implements financial account sync functionality.
package sync

import (
	"context"
	"database/sql"
	"time"

	accountsvc "encore.app/account"
	"encore.dev/rlog"
	"encore.dev/storage/sqldb"
)

// Provider represents a financial institution provider
type Provider string

const (
	ProviderWealthsimple Provider = "wealthsimple"
	// Future: ProviderQuestrade, etc.
)

// Status represents the status of a connection
type Status string

const (
	StatusConnected    Status = "connected"
	StatusDisconnected Status = "disconnected"
	StatusError        Status = "error"
	StatusSyncing      Status = "syncing"
)

// SyncFrequency represents how often to sync
type SyncFrequency string

const (
	SyncFrequencyDaily  SyncFrequency = "daily"
	SyncFrequencyHourly SyncFrequency = "hourly"
	SyncFrequencyManual SyncFrequency = "manual"
)

// Connection represents a connection (stored in sync_credentials)
type Connection struct {
	ID            string        `json:"id"`
	UserID        string        `json:"user_id"`
	Provider      Provider      `json:"provider"`
	Name          string        `json:"name"`
	Email          string        `json:"email"`
	Status        Status        `json:"status"`
	LastSyncAt    *time.Time    `json:"last_sync_at,omitempty"`
	LastSyncError string        `json:"last_sync_error,omitempty"`
	SyncFrequency SyncFrequency `json:"sync_frequency"`
	AccountCount  int           `json:"account_count"`
	CreatedAt     time.Time     `json:"created_at"`
	UpdatedAt     time.Time     `json:"updated_at"`
}

// SyncStatus is a simple status type for sync responses
type SyncStatus string

const (
	SyncStatusSuccess SyncStatus = "success"
	SyncStatusPending SyncStatus = "pending"
	SyncStatusError   SyncStatus = "error"
)

// Request/Response types

// InitiateConnectionRequest represents the request to initiate a connection
type InitiateConnectionRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// InitiateConnectionResponse represents the response after initiating a connection
type InitiateConnectionResponse struct {
	CredentialID string `json:"credential_id"`
	RequireOTP   bool   `json:"require_otp"`
	Message      string `json:"message"`
}

// VerifyOTPRequest represents the request to verify OTP
type VerifyOTPRequest struct {
	CredentialID string `json:"credential_id"`
	OTPCode      string `json:"otp_code"`
}

// VerifyOTPResponse represents the response after verifying OTP
type VerifyOTPResponse struct {
	CredentialID string `json:"credential_id"`
	Status       Status `json:"status"`
	Message      string `json:"message"`
}

// ListConnectionsResponse represents the response for listing connections
type ListConnectionsResponse struct {
	Connections []*Connection `json:"connections"`
}

// TriggerSyncResponse represents the response after triggering a sync
type TriggerSyncResponse struct {
	ConnectionID string     `json:"connection_id"`
	Status       SyncStatus `json:"status"`
	Message      string     `json:"message"`
}

// DeleteResponse represents a generic delete response
type DeleteResponse struct {
	Success bool `json:"success"`
}

// Database instance
var db = sqldb.NewDatabase("sync", sqldb.DatabaseConfig{
	Migrations: "./migrations",
})

// InitiateWealthsimpleConnection initiates a connection to Wealthsimple
//
//encore:api public path=/sync/wealthsimple/initiate method=POST
func InitiateWealthsimpleConnection(ctx context.Context, req *InitiateConnectionRequest) (*InitiateConnectionResponse, error) {
	// TODO: Get user ID from auth context
	userID := "temp-user-id" // Placeholder until auth is implemented

	// Use real implementation
	return initiateWealthsimpleConnectionReal(ctx, userID, req.Username, req.Password)
}

// VerifyOTP completes authentication by verifying the OTP code
//
//encore:api public path=/sync/wealthsimple/verify-otp method=POST
func VerifyOTP(ctx context.Context, req *VerifyOTPRequest) (*VerifyOTPResponse, error) {
	// Use real implementation
	return verifyOTPReal(ctx, req.CredentialID, req.OTPCode)
}

// ListConnections retrieves all connections for the authenticated user
//
//encore:api public path=/sync/connections method=GET
func ListConnections(ctx context.Context) (*ListConnectionsResponse, error) {
	// TODO: Get user ID from auth context
	userID := "temp-user-id"

	rows, err := db.Query(ctx, `
		SELECT id, user_id, provider, name, status, last_sync_at, last_sync_error,
		       sync_frequency, account_count, created_at, updated_at
		FROM sync_credentials
		WHERE user_id = $1
		ORDER BY created_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var connections []*Connection
	for rows.Next() {
		conn := &Connection{}
		var lastSyncAt sql.NullTime
		var lastSyncError sql.NullString
		err := rows.Scan(
			&conn.ID,
			&conn.UserID,
			&conn.Provider,
			&conn.Name,
			&conn.Status,
			&lastSyncAt,
			&lastSyncError,
			&conn.SyncFrequency,
			&conn.AccountCount,
			&conn.CreatedAt,
			&conn.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		if lastSyncAt.Valid {
			conn.LastSyncAt = &lastSyncAt.Time
		}
		if lastSyncError.Valid {
			conn.LastSyncError = lastSyncError.String
		}
		connections = append(connections, conn)
	}

	return &ListConnectionsResponse{Connections: connections}, nil
}

// GetConnection retrieves a single connection by ID
//
//encore:api public path=/sync/connections/:id method=GET
func GetConnection(ctx context.Context, id string) (*Connection, error) {
	// TODO: Get user ID from auth context and verify ownership
	userID := "temp-user-id"

	conn := &Connection{}
	var lastSyncAt sql.NullTime
	var lastSyncError sql.NullString
	err := db.QueryRow(ctx, `
		SELECT id, user_id, provider, name, status, last_sync_at, last_sync_error,
		       sync_frequency, account_count, created_at, updated_at
		FROM sync_credentials
		WHERE id = $1 AND user_id = $2
	`, id, userID).Scan(
		&conn.ID,
		&conn.UserID,
		&conn.Provider,
		&conn.Name,
		&conn.Status,
		&lastSyncAt,
		&lastSyncError,
		&conn.SyncFrequency,
		&conn.AccountCount,
		&conn.CreatedAt,
		&conn.UpdatedAt,
	)

	if err != nil {
		return nil, err
	}

	if lastSyncAt.Valid {
		conn.LastSyncAt = &lastSyncAt.Time
	}

	if lastSyncError.Valid {
		conn.LastSyncError = lastSyncError.String
	}

	return conn, nil
}

// DeleteConnection disconnects and deletes a connection
//
//encore:api public path=/sync/connections/:id method=DELETE
func DeleteConnection(ctx context.Context, id string) (*DeleteResponse, error) {
	// TODO: Get user ID from auth context and verify ownership
	userID := "temp-user-id"

	// Get all synced account IDs before deleting
	rows, err := db.Query(ctx, `
		SELECT local_account_id
		FROM synced_accounts
		WHERE credential_id = $1
	`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var accountIDs []string
	for rows.Next() {
		var accountID string
		if err := rows.Scan(&accountID); err != nil {
			continue
		}
		accountIDs = append(accountIDs, accountID)
	}

	rlog.Info("deleting synced accounts",
		"credential_id", id,
		"account_count", len(accountIDs),
		"account_ids", accountIDs)

	// Delete accounts via account service API
	for _, accountID := range accountIDs {
		if _, err := accountsvc.Delete(ctx, accountID); err != nil {
			rlog.Error("failed to delete account",
				"account_id", accountID,
				"error", err)
		}
	}

	// Delete credential (will cascade delete synced_accounts and sync_jobs)
	_, err = db.Exec(ctx, `
		DELETE FROM sync_credentials
		WHERE id = $1 AND user_id = $2
	`, id, userID)

	if err != nil {
		return nil, err
	}

	rlog.Info("deleted connection", "credential_id", id)

	return &DeleteResponse{Success: true}, nil
}
