// Service balance implements balance tracking functionality.
package balance

import (
	"context"
	"time"

	"encore.dev/storage/sqldb"
)

// Balance represents a balance entry for an account
type Balance struct {
	ID        string    `json:"id"`
	AccountID string    `json:"account_id"`
	Amount    float64   `json:"amount"`
	Date      time.Time `json:"date"`
	Notes     string    `json:"notes,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

// CreateBalanceRequest represents the request to create a new balance entry
type CreateBalanceRequest struct {
	AccountID string    `json:"account_id"`
	Amount    float64   `json:"amount"`
	Date      time.Time `json:"date"`
	Notes     string    `json:"notes,omitempty"`
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

// Database instance
var db = sqldb.NewDatabase("balance", sqldb.DatabaseConfig{
	Migrations: "./migrations",
})

// BulkImport imports multiple balance entries
//
//encore:api public path=/balances/bulk method=POST
func BulkImport(ctx context.Context, req *BulkImportRequest) (*BulkImportResponse, error) {
	// TODO: Verify user owns all the accounts in the bulk import

	response := &BulkImportResponse{
		Imported: 0,
		Failed:   0,
		Errors:   []string{},
	}

	for _, entry := range req.Entries {
		_, err := db.Exec(ctx, `
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
//
//encore:api public path=/account-balances/:accountID method=GET
func GetAccountBalances(ctx context.Context, accountID string) (*ListBalancesResponse, error) {
	// TODO: Verify user owns the account

	rows, err := db.Query(ctx, `
		SELECT id, account_id, amount, date, notes, created_at
		FROM balances
		WHERE account_id = $1
		ORDER BY date DESC
	`, accountID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var balances []*Balance
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
//
//encore:api public path=/balances method=POST
func Create(ctx context.Context, req *CreateBalanceRequest) (*Balance, error) {
	// TODO: Verify user owns the account

	balance := &Balance{
		AccountID: req.AccountID,
		Amount:    req.Amount,
		Date:      req.Date,
		Notes:     req.Notes,
		CreatedAt: time.Now(),
	}

	err := db.QueryRow(ctx, `
		INSERT INTO balances (account_id, amount, date, notes, created_at)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id
	`, req.AccountID, req.Amount, req.Date, req.Notes, balance.CreatedAt).Scan(&balance.ID)

	if err != nil {
		return nil, err
	}

	return balance, nil
}

// Get retrieves a single balance entry by ID
//
//encore:api public path=/balances/:id method=GET
func Get(ctx context.Context, id string) (*Balance, error) {
	// TODO: Verify user owns the account associated with this balance

	balance := &Balance{}
	err := db.QueryRow(ctx, `
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
//
//encore:api public path=/balances/:id method=PUT
func Update(ctx context.Context, id string, req *UpdateBalanceRequest) (*Balance, error) {
	// TODO: Verify user owns the account associated with this balance

	// First, get the current balance
	balance, err := Get(ctx, id)
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
		balance.Notes = *req.Notes
	}

	_, err = db.Exec(ctx, `
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
//
//encore:api public path=/balances/:id method=DELETE
func Delete(ctx context.Context, id string) (*DeleteBalanceResponse, error) {
	// TODO: Verify user owns the account associated with this balance

	_, err := db.Exec(ctx, `
		DELETE FROM balances
		WHERE id = $1
	`, id)

	if err != nil {
		return nil, err
	}

	return &DeleteBalanceResponse{Success: true}, nil
}
