// Package sync implements financial account sync functionality.
package sync

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"strings"
	"time"

	"money/internal/account"
	"money/internal/auth"
	"money/internal/balance"
	"money/internal/holdings"
	"money/internal/sync/encryption"
	"money/internal/sync/wealthsimple"
)

// AuthenticationError represents an authentication failure
type AuthenticationError struct {
	Message string
}

func (e *AuthenticationError) Error() string {
	return e.Message
}

// Service provides sync functionality
type Service struct {
	db            *sql.DB
	accountSvc    *account.Service
	balanceSvc    *balance.Service
	holdingsSvc   *holdings.Service
	encryptionKey string
}

// NewService creates a new sync service
func NewService(db *sql.DB, accountSvc *account.Service, balanceSvc *balance.Service, holdingsSvc *holdings.Service, encryptionKey string) *Service {
	return &Service{
		db:            db,
		accountSvc:    accountSvc,
		balanceSvc:    balanceSvc,
		holdingsSvc:   holdingsSvc,
		encryptionKey: encryptionKey,
	}
}

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

// SyncJobStatus represents the status of a sync job
type SyncJobStatus string

const (
	SyncJobStatusPending   SyncJobStatus = "pending"
	SyncJobStatusRunning   SyncJobStatus = "running"
	SyncJobStatusCompleted SyncJobStatus = "completed"
	SyncJobStatusFailed    SyncJobStatus = "failed"
)

// SyncJobType represents the type of sync job
type SyncJobType string

const (
	SyncJobTypeAccounts   SyncJobType = "accounts"
	SyncJobTypePositions  SyncJobType = "positions"
	SyncJobTypeActivities SyncJobType = "activities"
	SyncJobTypeHistory    SyncJobType = "history"
	SyncJobTypeFull       SyncJobType = "full"
)

// SyncJob represents a sync job for tracking progress
type SyncJob struct {
	ID              string        `json:"id"`
	SyncedAccountID string        `json:"synced_account_id"`
	AccountName     string        `json:"account_name,omitempty"`
	Type            SyncJobType   `json:"type"`
	Status          SyncJobStatus `json:"status"`
	StartedAt       *time.Time    `json:"started_at,omitempty"`
	CompletedAt     *time.Time    `json:"completed_at,omitempty"`
	ErrorMessage    string        `json:"error_message,omitempty"`
	ItemsProcessed  int           `json:"items_processed"`
	ItemsCreated    int           `json:"items_created"`
	ItemsUpdated    int           `json:"items_updated"`
	ItemsFailed     int           `json:"items_failed"`
	CreatedAt       time.Time     `json:"created_at"`
}

// ConnectionSyncStatusResponse represents detailed sync status for a connection
type ConnectionSyncStatusResponse struct {
	ConnectionID   string        `json:"connection_id"`
	ConnectionName string        `json:"connection_name"`
	Status         Status        `json:"status"`
	LastSyncAt     *time.Time    `json:"last_sync_at,omitempty"`
	LastSyncError  string        `json:"last_sync_error,omitempty"`
	Jobs           []SyncJob     `json:"jobs"`
	Summary        SyncSummary   `json:"summary"`
}

// SyncSummary provides aggregate statistics for all sync jobs
type SyncSummary struct {
	TotalJobs       int `json:"total_jobs"`
	CompletedJobs   int `json:"completed_jobs"`
	FailedJobs      int `json:"failed_jobs"`
	RunningJobs     int `json:"running_jobs"`
	PendingJobs     int `json:"pending_jobs"`
	TotalProcessed  int `json:"total_processed"`
	TotalCreated    int `json:"total_created"`
	TotalUpdated    int `json:"total_updated"`
	TotalFailed     int `json:"total_failed"`
}

// DeleteResponse represents a generic delete response
type DeleteResponse struct {
	Success bool `json:"success"`
}

// CheckWealthsimpleCredentialsResponse represents the response for checking credentials
type CheckWealthsimpleCredentialsResponse struct {
	HasCredentials bool   `json:"has_credentials"`
	Email          string `json:"email,omitempty"`
}

// CheckWealthsimpleCredentials checks if Wealthsimple credentials exist for the user
func (s *Service) CheckWealthsimpleCredentials(ctx context.Context) (*CheckWealthsimpleCredentialsResponse, error) {
	// TODO: Get user ID from auth context
	userID := auth.GetUserID(ctx)
	if userID == "" {
		return nil, fmt.Errorf("user not authenticated")
	}

	var encryptedUsername []byte
	err := s.db.QueryRowContext(ctx, `
		SELECT encrypted_username
		FROM sync_credentials
		WHERE user_id = $1 AND provider = 'wealthsimple'
	`, userID).Scan(&encryptedUsername)

	if err == sql.ErrNoRows {
		return &CheckWealthsimpleCredentialsResponse{
			HasCredentials: false,
		}, nil
	}

	if err != nil {
		return nil, err
	}

	// Decrypt the username/email to return
	encService, err := encryption.NewService(s.encryptionKey)
	if err != nil {
		// If encryption service fails, still return that credentials exist but no email
		return &CheckWealthsimpleCredentialsResponse{
			HasCredentials: true,
		}, nil
	}

	decryptedEmail, err := encService.Decrypt(encryptedUsername)
	if err != nil {
		// If decryption fails, still return that credentials exist but no email
		return &CheckWealthsimpleCredentialsResponse{
			HasCredentials: true,
		}, nil
	}

	return &CheckWealthsimpleCredentialsResponse{
		HasCredentials: true,
		Email:          decryptedEmail,
	}, nil
}

// InitiateWealthsimpleConnection initiates a connection to Wealthsimple
func (s *Service) InitiateWealthsimpleConnection(ctx context.Context, req *InitiateConnectionRequest) (*InitiateConnectionResponse, error) {
	// TODO: Get user ID from auth context
	userID := auth.GetUserID(ctx)
	if userID == "" {
		return nil, fmt.Errorf("user not authenticated")
	}

	// Use real implementation
	return s.initiateWealthsimpleConnectionReal(ctx, userID, req.Username, req.Password)
}

// VerifyOTP completes authentication by verifying the OTP code
func (s *Service) VerifyOTP(ctx context.Context, req *VerifyOTPRequest) (*VerifyOTPResponse, error) {
	// Use real implementation
	return s.verifyOTPReal(ctx, req.CredentialID, req.OTPCode)
}

// ListConnections retrieves all connections for the authenticated user
// and automatically validates sessions
func (s *Service) ListConnections(ctx context.Context) (*ListConnectionsResponse, error) {
	userID := auth.GetUserID(ctx)
	if userID == "" {
		return nil, fmt.Errorf("user not authenticated")
	}

	rows, err := s.db.QueryContext(ctx, `
		SELECT id, user_id, provider, name, status, last_sync_at, last_sync_error,
		       sync_frequency, account_count, created_at, updated_at,
		       encrypted_access_token, device_id, session_id, app_instance_id
		FROM sync_credentials
		WHERE user_id = $1
		ORDER BY created_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	// Initialize encryption service for token validation
	encService, err := encryption.NewService(s.encryptionKey)
	if err != nil {
		log.Printf("WARN: failed to initialize encryption service: %v", err)
		// Continue without validation
		encService = nil
	}

	var connections []*Connection
	for rows.Next() {
		conn := &Connection{}
		var lastSyncAt sql.NullTime
		var lastSyncError sql.NullString
		var encryptedAccessToken []byte
		var deviceID, sessionID, appInstanceID string
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
			&encryptedAccessToken,
			&deviceID,
			&sessionID,
			&appInstanceID,
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

		// Automatically validate session if connection is currently marked as connected
		if conn.Status == StatusConnected && encService != nil && len(encryptedAccessToken) > 0 {
			s.validateConnectionSession(ctx, conn, encryptedAccessToken, deviceID, sessionID, appInstanceID, encService)
		}

		connections = append(connections, conn)
	}

	return &ListConnectionsResponse{Connections: connections}, nil
}

// validateConnectionSession validates a connection's session in the background
func (s *Service) validateConnectionSession(ctx context.Context, conn *Connection, encryptedAccessToken []byte, deviceID, sessionID, appInstanceID string, encService *encryption.Service) {
	// Decrypt access token
	accessToken, err := encService.Decrypt(encryptedAccessToken)
	if err != nil {
		log.Printf("WARN: failed to decrypt access token for connection %s: %v", conn.ID, err)
		return
	}

	// Check if the access token is still valid
	client := wealthsimple.NewClient(deviceID, sessionID, appInstanceID)
	tokenInfo, err := client.CheckTokenInfo(ctx, accessToken)
	if err != nil {
		// Session is invalid - mark connection as disconnected
		log.Printf("INFO: session expired for connection %s, marking as disconnected: %v", conn.ID, err)
		_, _ = s.db.ExecContext(ctx, `
			UPDATE sync_credentials
			SET status = $1,
			    last_sync_error = $2,
			    updated_at = CURRENT_TIMESTAMP
			WHERE id = $3
		`, StatusDisconnected, "Session expired - please login again", conn.ID)

		// Update the connection object so it reflects the new status
		conn.Status = StatusDisconnected
		conn.LastSyncError = "Session expired - please login again"
		return
	}

	// Session is valid - log token expiration info
	log.Printf("DEBUG: session valid for connection %s, expires in %d seconds", conn.ID, tokenInfo.ExpiresIn)
}

// GetConnection retrieves a single connection by ID
func (s *Service) GetConnection(ctx context.Context, id string) (*Connection, error) {
	// TODO: Get user ID from auth context and verify ownership
	userID := auth.GetUserID(ctx)
	if userID == "" {
		return nil, fmt.Errorf("user not authenticated")
	}

	conn := &Connection{}
	var lastSyncAt sql.NullTime
	var lastSyncError sql.NullString
	err := s.db.QueryRowContext(ctx, `
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
func (s *Service) DeleteConnection(ctx context.Context, id string) (*DeleteResponse, error) {
	// TODO: Get user ID from auth context and verify ownership
	userID := auth.GetUserID(ctx)
	if userID == "" {
		return nil, fmt.Errorf("user not authenticated")
	}

	// Get all synced account IDs before deleting
	rows, err := s.db.QueryContext(ctx, `
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

	log.Printf("INFO: deleting synced accounts: credential_id=%s account_count=%d account_ids=%v",
		id, len(accountIDs), accountIDs)

	// Delete accounts via account service
	for _, accountID := range accountIDs {
		if _, err := s.accountSvc.Delete(ctx, accountID); err != nil {
			log.Printf("ERROR: failed to delete account: account_id=%s error=%v", accountID, err)
		}
	}

	// Delete credential (will cascade delete synced_accounts and sync_jobs)
	_, err = s.db.ExecContext(ctx, `
		DELETE FROM sync_credentials
		WHERE id = $1 AND user_id = $2
	`, id, userID)

	if err != nil {
		return nil, err
	}

	log.Printf("INFO: deleted connection: credential_id=%s", id)

	return &DeleteResponse{Success: true}, nil
}

// UpdateConnectionRequest represents a request to update connection settings
type UpdateConnectionRequest struct {
	SyncFrequency string `json:"sync_frequency"`
}

// UpdateConnection updates connection settings
func (s *Service) UpdateConnection(ctx context.Context, id string, req *UpdateConnectionRequest) error {
	userID := auth.GetUserID(ctx)
	if userID == "" {
		return fmt.Errorf("user not authenticated")
	}

	// Validate sync frequency
	validFrequencies := map[string]bool{
		"manual":  true,
		"daily":   true,
		"weekly":  true,
		"monthly": true,
	}
	if !validFrequencies[req.SyncFrequency] {
		return fmt.Errorf("invalid sync frequency: %s", req.SyncFrequency)
	}

	// Update the connection
	_, err := s.db.ExecContext(ctx, `
		UPDATE sync_credentials
		SET sync_frequency = $1, updated_at = CURRENT_TIMESTAMP
		WHERE id = $2 AND user_id = $3
	`, req.SyncFrequency, id, userID)
	if err != nil {
		return fmt.Errorf("failed to update connection: %w", err)
	}

	return nil
}

// TriggerSync triggers a sync for a connection
func (s *Service) TriggerSync(ctx context.Context, userID, connectionID string) error {
	if userID == "" {
		return fmt.Errorf("user not authenticated")
	}

	log.Printf("INFO: triggering sync for connection: user_id=%s connection_id=%s", userID, connectionID)

	// Perform the sync
	return s.performInitialSync(ctx, userID, connectionID)
}

// UpdateConnectionError updates the connection status to error with an error message
func (s *Service) UpdateConnectionError(ctx context.Context, connectionID, errorMessage string) error {
	// Check if this is an authentication error
	isAuthError := isAuthenticationError(errorMessage)

	var status Status
	if isAuthError {
		status = StatusDisconnected
		errorMessage = "Authentication failed - please login again"
		log.Printf("WARN: authentication error detected for connection %s - marking as disconnected", connectionID)
	} else {
		status = StatusError
	}

	_, err := s.db.ExecContext(ctx, `
		UPDATE sync_credentials
		SET status = $1, last_sync_error = $2, updated_at = CURRENT_TIMESTAMP
		WHERE id = $3
	`, string(status), errorMessage, connectionID)

	if err != nil {
		log.Printf("ERROR: failed to update connection error: connection_id=%s error=%v", connectionID, err)
		return fmt.Errorf("failed to update connection error: %w", err)
	}

	log.Printf("INFO: updated connection error: connection_id=%s status=%s error=%s", connectionID, status, errorMessage)
	return nil
}

// isAuthenticationError checks if an error message indicates authentication failure
func isAuthenticationError(errMsg string) bool {
	authErrorIndicators := []string{
		"401",
		"status 401",
		"unauthorized",
		"authentication failed",
		"invalid credentials",
		"credentials are invalid",
		"access denied",
		"not authenticated",
	}

	errMsgLower := strings.ToLower(errMsg)
	for _, indicator := range authErrorIndicators {
		if strings.Contains(errMsgLower, indicator) {
			return true
		}
	}
	return false
}

// GetConnectionSyncStatus retrieves detailed sync status for a connection
func (s *Service) GetConnectionSyncStatus(ctx context.Context, id string) (*ConnectionSyncStatusResponse, error) {
	userID := auth.GetUserID(ctx)
	if userID == "" {
		return nil, fmt.Errorf("user not authenticated")
	}

	// Get connection details
	conn, err := s.GetConnection(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("connection not found: %w", err)
	}

	// Get recent sync jobs for this connection (last 24 hours)
	rows, err := s.db.QueryContext(ctx, `
		SELECT
			sj.id, sj.synced_account_id, sj.type, sj.status,
			sj.started_at, sj.completed_at, sj.error_message,
			sj.items_processed, sj.items_created, sj.items_updated, sj.items_failed,
			sj.created_at,
			a.name as account_name
		FROM sync_jobs sj
		JOIN synced_accounts sa ON sa.id = sj.synced_account_id
		LEFT JOIN accounts a ON a.id = sa.local_account_id
		WHERE sa.credential_id = $1
		  AND sj.created_at > NOW() - INTERVAL '24 hours'
		ORDER BY sj.created_at DESC
		LIMIT 100
	`, id)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch sync jobs: %w", err)
	}
	defer rows.Close()

	var jobs []SyncJob
	summary := SyncSummary{}

	for rows.Next() {
		var job SyncJob
		var startedAt, completedAt sql.NullTime
		var errorMessage sql.NullString
		var accountName sql.NullString

		err := rows.Scan(
			&job.ID, &job.SyncedAccountID, &job.Type, &job.Status,
			&startedAt, &completedAt, &errorMessage,
			&job.ItemsProcessed, &job.ItemsCreated, &job.ItemsUpdated, &job.ItemsFailed,
			&job.CreatedAt,
			&accountName,
		)
		if err != nil {
			log.Printf("ERROR: failed to scan sync job: %v", err)
			continue
		}

		if startedAt.Valid {
			job.StartedAt = &startedAt.Time
		}
		if completedAt.Valid {
			job.CompletedAt = &completedAt.Time
		}
		if errorMessage.Valid {
			job.ErrorMessage = errorMessage.String
		}
		if accountName.Valid {
			job.AccountName = accountName.String
		}

		jobs = append(jobs, job)

		// Update summary
		summary.TotalJobs++
		summary.TotalProcessed += job.ItemsProcessed
		summary.TotalCreated += job.ItemsCreated
		summary.TotalUpdated += job.ItemsUpdated
		summary.TotalFailed += job.ItemsFailed

		switch job.Status {
		case SyncJobStatusCompleted:
			summary.CompletedJobs++
		case SyncJobStatusFailed:
			summary.FailedJobs++
		case SyncJobStatusRunning:
			summary.RunningJobs++
		case SyncJobStatusPending:
			summary.PendingJobs++
		}
	}

	if jobs == nil {
		jobs = []SyncJob{}
	}

	return &ConnectionSyncStatusResponse{
		ConnectionID:   conn.ID,
		ConnectionName: conn.Name,
		Status:         conn.Status,
		LastSyncAt:     conn.LastSyncAt,
		LastSyncError:  conn.LastSyncError,
		Jobs:           jobs,
		Summary:        summary,
	}, nil
}
