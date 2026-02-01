// Package balance implements balance tracking functionality.
package balance

import (
	"context"
	"database/sql"
	"log"
	"time"

	"github.com/google/uuid"
)

// Service provides balance management functionality
type Service struct {
	db *sql.DB
}

// NewService creates a new balance service
func NewService(db *sql.DB) *Service {
	return &Service{db: db}
}

// Balance represents a balance entry for an account
type Balance struct {
	ID        string    `json:"id"`
	AccountID string    `json:"account_id"`
	Amount    float64   `json:"amount"`
	Date      time.Time `json:"date"`
	Notes     *string   `json:"notes,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

// CreateBalanceRequest represents the request to create a new balance entry
type CreateBalanceRequest struct {
	AccountID string    `json:"account_id"`
	Amount    float64   `json:"amount"`
	Date      time.Time `json:"date"`
	Notes     string    `json:"notes,omitempty"`
}

// CreateBalanceResponse represents the response from creating a balance
type CreateBalanceResponse struct {
	Balance   *Balance `json:"balance"`
	WasUpdate bool     `json:"was_update"` // true if existing record was updated, false if new record created
}

// UpdateBalanceRequest represents the request to update a balance entry
type UpdateBalanceRequest struct {
	Amount *float64   `json:"amount,omitempty"`
	Date   *time.Time `json:"date,omitempty"`
	Notes  *string    `json:"notes,omitempty"`
}

// BulkBalanceEntry represents a single entry in a bulk import
type BulkBalanceEntry struct {
	AccountID string    `json:"account_id"`
	Amount    float64   `json:"amount"`
	Date      time.Time `json:"date"`
	Notes     string    `json:"notes,omitempty"`
}

// BulkImportRequest represents a request to import multiple balances
type BulkImportRequest struct {
	Entries []*BulkBalanceEntry `json:"entries"`
}

// BulkImportResponse represents the response from a bulk import
type BulkImportResponse struct {
	Imported int      `json:"imported"`
	Failed   int      `json:"failed"`
	Errors   []string `json:"errors,omitempty"`
}

// ListBalancesResponse represents the response for listing balances
type ListBalancesResponse struct {
	Balances []*Balance `json:"balances"`
}

// DeleteBalanceResponse represents the response for deleting a balance
type DeleteBalanceResponse struct {
	Success bool `json:"success"`
}

// BulkImport imports multiple balance entries
func (s *Service) BulkImport(ctx context.Context, req *BulkImportRequest) (*BulkImportResponse, error) {
	// TODO: Verify user owns all the accounts in the bulk import

	response := &BulkImportResponse{
		Imported: 0,
		Failed:   0,
		Errors:   []string{},
	}

	for _, entry := range req.Entries {
		_, err := s.db.ExecContext(ctx, `
			INSERT INTO balances (account_id, amount, date, notes, created_at)
			VALUES ($1, $2, $3, $4, $5)
		`, entry.AccountID, entry.Amount, entry.Date, entry.Notes, time.Now())

		if err != nil {
			response.Failed++
			response.Errors = append(response.Errors, err.Error())
		} else {
			response.Imported++
		}
	}

	return response, nil
}

// GetAccountBalances retrieves balance history for a specific account
func (s *Service) GetAccountBalances(ctx context.Context, accountID string) (*ListBalancesResponse, error) {
	// TODO: Verify user owns the account

	rows, err := s.db.QueryContext(ctx, `
		SELECT id, account_id, amount, date, notes, created_at
		FROM balances
		WHERE account_id = $1
		ORDER BY date DESC
	`, accountID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	balances := make([]*Balance, 0)
	for rows.Next() {
		balance := &Balance{}
		err := rows.Scan(
			&balance.ID,
			&balance.AccountID,
			&balance.Amount,
			&balance.Date,
			&balance.Notes,
			&balance.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		balances = append(balances, balance)
	}

	return &ListBalancesResponse{Balances: balances}, nil
}

// Create creates a new balance entry
func (s *Service) Create(ctx context.Context, req *CreateBalanceRequest) (*CreateBalanceResponse, error) {
	// TODO: Verify user owns the account

	var notes *string
	if req.Notes != "" {
		notes = &req.Notes
	}
	balance := &Balance{
		AccountID: req.AccountID,
		Amount:    req.Amount,
		Date:      req.Date,
		Notes:     notes,
		CreatedAt: time.Now(),
	}

	// Check if balance already exists for this date
	var existingID string
	var existingAmount float64
	wasUpdate := false
	existingErr := s.db.QueryRowContext(ctx, `
		SELECT id, amount FROM balances WHERE account_id = $1 AND date = $2
	`, req.AccountID, req.Date).Scan(&existingID, &existingAmount)

	if existingErr == nil {
		wasUpdate = true
	}

	// Generate UUID for new balance entry
	newID := uuid.New().String()

	// SQLite-compatible upsert: INSERT with ON CONFLICT
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO balances (id, account_id, amount, date, notes, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (account_id, date) DO UPDATE SET
			amount = excluded.amount,
			notes = excluded.notes
	`, newID, req.AccountID, req.Amount, req.Date, req.Notes, balance.CreatedAt)

	if err == nil {
		// Fetch the actual ID (might be the existing one if it was an update)
		s.db.QueryRowContext(ctx, `SELECT id FROM balances WHERE account_id = $1 AND date = $2`, req.AccountID, req.Date).Scan(&balance.ID)
	}

	if err != nil {
		log.Printf("ERROR: failed to insert/update balance: account_id=%s date=%v amount=%f error=%v",
			req.AccountID, req.Date, req.Amount, err)
		return nil, err
	}

	return &CreateBalanceResponse{
		Balance:   balance,
		WasUpdate: wasUpdate,
	}, nil
}

// Get retrieves a single balance entry by ID
func (s *Service) Get(ctx context.Context, id string) (*Balance, error) {
	// TODO: Verify user owns the account associated with this balance

	balance := &Balance{}
	err := s.db.QueryRowContext(ctx, `
		SELECT id, account_id, amount, date, notes, created_at
		FROM balances
		WHERE id = $1
	`, id).Scan(
		&balance.ID,
		&balance.AccountID,
		&balance.Amount,
		&balance.Date,
		&balance.Notes,
		&balance.CreatedAt,
	)

	if err != nil {
		return nil, err
	}

	return balance, nil
}

// Update updates an existing balance entry
func (s *Service) Update(ctx context.Context, id string, req *UpdateBalanceRequest) (*Balance, error) {
	// TODO: Verify user owns the account associated with this balance

	// First, get the current balance
	balance, err := s.Get(ctx, id)
	if err != nil {
		return nil, err
	}

	// Update only the fields that are provided
	if req.Amount != nil {
		balance.Amount = *req.Amount
	}
	if req.Date != nil {
		balance.Date = *req.Date
	}
	if req.Notes != nil {
		balance.Notes = req.Notes
	}

	_, err = s.db.ExecContext(ctx, `
		UPDATE balances
		SET amount = $1, date = $2, notes = $3
		WHERE id = $4
	`, balance.Amount, balance.Date, balance.Notes, id)

	if err != nil {
		return nil, err
	}

	return balance, nil
}

// Delete deletes a balance entry
func (s *Service) Delete(ctx context.Context, id string) (*DeleteBalanceResponse, error) {
	// TODO: Verify user owns the account associated with this balance

	_, err := s.db.ExecContext(ctx, `
		DELETE FROM balances
		WHERE id = $1
	`, id)

	if err != nil {
		return nil, err
	}

	return &DeleteBalanceResponse{Success: true}, nil
}
