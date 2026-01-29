// Package account implements account management functionality.
package account

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/lib/pq"

	"money/internal/auth"
	"money/internal/balance"
)

// Service provides account management functionality
type Service struct {
	db         *sql.DB
	balanceDB  *sql.DB
	balanceSvc *balance.Service
}

// NewService creates a new account service
func NewService(db, balanceDB *sql.DB, balanceSvc *balance.Service) *Service {
	return &Service{
		db:         db,
		balanceDB:  balanceDB,
		balanceSvc: balanceSvc,
	}
}

// AccountType represents the type of financial account
type AccountType string

const (
	AccountTypeChecking     AccountType = "checking"
	AccountTypeSavings      AccountType = "savings"
	AccountTypeCash         AccountType = "cash"
	AccountTypeBrokerage    AccountType = "brokerage"
	AccountTypeTFSA         AccountType = "tfsa"
	AccountTypeRRSP         AccountType = "rrsp"
	AccountTypeCrypto       AccountType = "crypto"
	AccountTypeRealEstate   AccountType = "real_estate"
	AccountTypeVehicle      AccountType = "vehicle"
	AccountTypeCollectible  AccountType = "collectible"
	AccountTypeCreditCard   AccountType = "credit_card"
	AccountTypeLoan         AccountType = "loan"
	AccountTypeMortgage     AccountType = "mortgage"
	AccountTypeLineOfCredit AccountType = "line_of_credit"
	AccountTypeOther        AccountType = "other"
)

// Currency represents supported currencies
type Currency string

const (
	CurrencyCAD Currency = "CAD"
	CurrencyUSD Currency = "USD"
	CurrencyINR Currency = "INR"
)

// Account represents a financial account
type Account struct {
	ID           string      `json:"id"`
	UserID       string      `json:"user_id"`
	Name         string      `json:"name"`
	Type         AccountType `json:"type"`
	Currency     Currency    `json:"currency"`
	Institution  *string     `json:"institution,omitempty"`
	IsAsset      bool        `json:"is_asset"`
	IsActive     bool        `json:"is_active"`
	IsSynced     bool        `json:"is_synced"`               // true if managed by a connection
	ConnectionID string      `json:"connection_id,omitempty"` // reference to Connection if synced
	CreatedAt    time.Time   `json:"created_at"`
	UpdatedAt    time.Time   `json:"updated_at"`
}

// CreateAccountRequest represents the request to create a new account
type CreateAccountRequest struct {
	Name         string      `json:"name"`
	Type         AccountType `json:"type"`
	Currency     Currency    `json:"currency"`
	Institution  *string     `json:"institution,omitempty"`
	IsAsset      bool        `json:"is_asset"`
	IsSynced     bool        `json:"is_synced,omitempty"`     // Optional: mark as synced account
	ConnectionID string      `json:"connection_id,omitempty"` // Optional: connection reference
}

// UpdateAccountRequest represents the request to update an account
type UpdateAccountRequest struct {
	Name        *string      `json:"name,omitempty"`
	Type        *AccountType `json:"type,omitempty"`
	Currency    *Currency    `json:"currency,omitempty"`
	Institution *string      `json:"institution,omitempty"`
	IsAsset     *bool        `json:"is_asset,omitempty"`
	IsActive    *bool        `json:"is_active,omitempty"`
}

// AccountWithBalance represents an account with its current balance
type AccountWithBalance struct {
	Account
	CurrentBalance *float64 `json:"current_balance,omitempty"`
	BalanceDate    *string  `json:"balance_date,omitempty"`
}

// ListAccountsResponse represents the response for listing accounts
type ListAccountsResponse struct {
	Accounts []*Account `json:"accounts"`
}

// ListAccountsWithBalanceResponse represents the response for listing accounts with balances
type ListAccountsWithBalanceResponse struct {
	Accounts []*AccountWithBalance `json:"accounts"`
}

// DeleteAccountResponse represents the response for deleting an account
type DeleteAccountResponse struct {
	Success bool `json:"success"`
}

// AccountSummary represents a summary of accounts
type AccountSummary struct {
	TotalAccounts     int            `json:"total_accounts"`
	ActiveAccounts    int            `json:"active_accounts"`
	AssetAccounts     int            `json:"asset_accounts"`
	LiabilityAccounts int            `json:"liability_accounts"`
	ByCurrency        map[string]int `json:"by_currency"`
	ByType            map[string]int `json:"by_type"`
}

// verifyAccountOwnership checks if the account belongs to the authenticated user
func (s *Service) verifyAccountOwnership(ctx context.Context, accountID string) error {
	userID := auth.GetUserID(ctx)
	if userID == "" {
		return fmt.Errorf("user not authenticated")
	}

	var ownerID string
	err := s.db.QueryRowContext(ctx, "SELECT user_id FROM accounts WHERE id = $1", accountID).Scan(&ownerID)
	if err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("account not found")
		}
		return fmt.Errorf("failed to verify account ownership: %w", err)
	}

	if ownerID != userID {
		return fmt.Errorf("access denied: account does not belong to user")
	}

	return nil
}

// Create creates a new account
func (s *Service) Create(ctx context.Context, req *CreateAccountRequest) (*Account, error) {
	// TODO: Get user ID from auth context
	userID := auth.GetUserID(ctx)
	if userID == "" {
		return nil, fmt.Errorf("user not authenticated")
	}

	account := &Account{
		UserID:       userID,
		Name:         req.Name,
		Type:         req.Type,
		Currency:     req.Currency,
		Institution:  req.Institution,
		IsAsset:      req.IsAsset,
		IsActive:     true,
		IsSynced:     req.IsSynced,
		ConnectionID: req.ConnectionID,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	err := s.db.QueryRowContext(ctx, `
		INSERT INTO accounts (user_id, name, type, currency, institution, is_asset, is_active, is_synced, connection_id, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING id
	`, userID, req.Name, req.Type, req.Currency, req.Institution, req.IsAsset, true, req.IsSynced, req.ConnectionID, account.CreatedAt, account.UpdatedAt).Scan(&account.ID)

	if err != nil {
		return nil, err
	}

	return account, nil
}

// Summary returns a summary of all accounts
func (s *Service) Summary(ctx context.Context) (*AccountSummary, error) {
	// TODO: Get user ID from auth context
	userID := auth.GetUserID(ctx)
	if userID == "" {
		return nil, fmt.Errorf("user not authenticated")
	}

	summary := &AccountSummary{
		ByCurrency: make(map[string]int),
		ByType:     make(map[string]int),
	}

	// Get total counts
	err := s.db.QueryRowContext(ctx, `
		SELECT
			COUNT(*) as total,
			COUNT(*) FILTER (WHERE is_active = true) as active,
			COUNT(*) FILTER (WHERE is_asset = true) as assets,
			COUNT(*) FILTER (WHERE is_asset = false) as liabilities
		FROM accounts
		WHERE user_id = $1
	`, userID).Scan(&summary.TotalAccounts, &summary.ActiveAccounts, &summary.AssetAccounts, &summary.LiabilityAccounts)

	if err != nil {
		return nil, err
	}

	// Get by currency
	rows, err := s.db.QueryContext(ctx, `
		SELECT currency, COUNT(*)
		FROM accounts
		WHERE user_id = $1
		GROUP BY currency
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var currency string
		var count int
		if err := rows.Scan(&currency, &count); err != nil {
			return nil, err
		}
		summary.ByCurrency[currency] = count
	}

	// Get by type
	rows, err = s.db.QueryContext(ctx, `
		SELECT type, COUNT(*)
		FROM accounts
		WHERE user_id = $1
		GROUP BY type
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var accountType string
		var count int
		if err := rows.Scan(&accountType, &count); err != nil {
			return nil, err
		}
		summary.ByType[accountType] = count
	}

	return summary, nil
}

// List retrieves all accounts for the authenticated user
func (s *Service) List(ctx context.Context) (*ListAccountsResponse, error) {
	// TODO: Get user ID from auth context
	userID := auth.GetUserID(ctx)
	if userID == "" {
		return nil, fmt.Errorf("user not authenticated")
	}

	rows, err := s.db.QueryContext(ctx, `
		SELECT id, user_id, name, type, currency, institution, is_asset, is_active, is_synced, connection_id, created_at, updated_at
		FROM accounts
		WHERE user_id = $1 AND is_active = true
		ORDER BY created_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	accounts := make([]*Account, 0)
	for rows.Next() {
		account := &Account{}
		var connectionID *string
		err := rows.Scan(
			&account.ID,
			&account.UserID,
			&account.Name,
			&account.Type,
			&account.Currency,
			&account.Institution,
			&account.IsAsset,
			&account.IsActive,
			&account.IsSynced,
			&connectionID,
			&account.CreatedAt,
			&account.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		if connectionID != nil {
			account.ConnectionID = *connectionID
		}
		accounts = append(accounts, account)
	}

	return &ListAccountsResponse{Accounts: accounts}, nil
}

// ListWithBalance retrieves all accounts with their current balance for the authenticated user
func (s *Service) ListWithBalance(ctx context.Context) (*ListAccountsWithBalanceResponse, error) {
	// TODO: Get user ID from auth context
	userID := auth.GetUserID(ctx)
	if userID == "" {
		return nil, fmt.Errorf("user not authenticated")
	}

	// First, get all accounts
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, user_id, name, type, currency, institution, is_asset, is_active, is_synced, connection_id, created_at, updated_at
		FROM accounts
		WHERE user_id = $1 AND is_active = true
		ORDER BY created_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	accounts := make([]*AccountWithBalance, 0)
	accountIDs := make([]string, 0)

	for rows.Next() {
		accountWithBalance := &AccountWithBalance{}
		var connectionID *string
		err := rows.Scan(
			&accountWithBalance.ID,
			&accountWithBalance.UserID,
			&accountWithBalance.Name,
			&accountWithBalance.Type,
			&accountWithBalance.Currency,
			&accountWithBalance.Institution,
			&accountWithBalance.IsAsset,
			&accountWithBalance.IsActive,
			&accountWithBalance.IsSynced,
			&connectionID,
			&accountWithBalance.CreatedAt,
			&accountWithBalance.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		if connectionID != nil {
			accountWithBalance.ConnectionID = *connectionID
		}
		accounts = append(accounts, accountWithBalance)
		accountIDs = append(accountIDs, accountWithBalance.ID)
	}

	// If there are accounts, fetch their latest balances
	if len(accountIDs) > 0 {
		// Query the balance database for the latest balance of each account
		balanceRows, err := s.balanceDB.QueryContext(ctx, `
			SELECT DISTINCT ON (account_id) account_id, amount, date
			FROM balances
			WHERE account_id = ANY($1)
			ORDER BY account_id, date DESC
		`, pq.Array(accountIDs))
		if err != nil {
			// If there's an error fetching balances, just return accounts without balances
			return &ListAccountsWithBalanceResponse{Accounts: accounts}, nil
		}
		defer balanceRows.Close()

		// Create a map of account_id to balance and date
		type balanceInfo struct {
			amount float64
			date   string
		}
		balanceMap := make(map[string]balanceInfo)
		for balanceRows.Next() {
			var accountID string
			var amount float64
			var date time.Time
			if err := balanceRows.Scan(&accountID, &amount, &date); err != nil {
				continue
			}
			balanceMap[accountID] = balanceInfo{
				amount: amount,
				date:   date.Format(time.RFC3339),
			}
		}

		// Attach balances to accounts
		for _, account := range accounts {
			if balanceInfo, ok := balanceMap[account.ID]; ok {
				account.CurrentBalance = &balanceInfo.amount
				account.BalanceDate = &balanceInfo.date
			}
		}
	}

	return &ListAccountsWithBalanceResponse{Accounts: accounts}, nil
}

// Get retrieves a single account by ID
func (s *Service) Get(ctx context.Context, id string) (*Account, error) {
	// TODO: Get user ID from auth context and verify ownership
	userID := auth.GetUserID(ctx)
	if userID == "" {
		return nil, fmt.Errorf("user not authenticated")
	}

	account := &Account{}
	var connectionID *string
	err := s.db.QueryRowContext(ctx, `
		SELECT id, user_id, name, type, currency, institution, is_asset, is_active, is_synced, connection_id, created_at, updated_at
		FROM accounts
		WHERE id = $1 AND user_id = $2
	`, id, userID).Scan(
		&account.ID,
		&account.UserID,
		&account.Name,
		&account.Type,
		&account.Currency,
		&account.Institution,
		&account.IsAsset,
		&account.IsActive,
		&account.IsSynced,
		&connectionID,
		&account.CreatedAt,
		&account.UpdatedAt,
	)

	if connectionID != nil {
		account.ConnectionID = *connectionID
	}

	if err != nil {
		return nil, err
	}

	return account, nil
}

// Update updates an existing account
func (s *Service) Update(ctx context.Context, id string, req *UpdateAccountRequest) (*Account, error) {
	// TODO: Get user ID from auth context and verify ownership
	userID := auth.GetUserID(ctx)
	if userID == "" {
		return nil, fmt.Errorf("user not authenticated")
	}

	// First, get the current account
	account, err := s.Get(ctx, id)
	if err != nil {
		return nil, err
	}

	// Update only the fields that are provided
	if req.Name != nil {
		account.Name = *req.Name
	}
	if req.Type != nil {
		account.Type = *req.Type
	}
	if req.Currency != nil {
		account.Currency = *req.Currency
	}
	if req.Institution != nil {
		account.Institution = req.Institution
	}
	if req.IsAsset != nil {
		account.IsAsset = *req.IsAsset
	}
	if req.IsActive != nil {
		account.IsActive = *req.IsActive
	}
	account.UpdatedAt = time.Now()

	_, err = s.db.ExecContext(ctx, `
		UPDATE accounts
		SET name = $1, type = $2, currency = $3, institution = $4, is_asset = $5, is_active = $6, updated_at = $7
		WHERE id = $8 AND user_id = $9 AND is_synced = false
	`, account.Name, account.Type, account.Currency, account.Institution, account.IsAsset, account.IsActive, account.UpdatedAt, id, userID)

	if err != nil {
		return nil, err
	}

	return account, nil
}

// Delete deletes an account (soft delete by setting is_active to false)
func (s *Service) Delete(ctx context.Context, id string) (*DeleteAccountResponse, error) {
	userID := auth.GetUserID(ctx)
	if userID == "" {
		return nil, fmt.Errorf("user not authenticated")
	}

	result, err := s.db.ExecContext(ctx, `
		DELETE FROM accounts
		WHERE id = $1 AND user_id = $2
	`, id, userID)

	if err != nil {
		return nil, err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return nil, err
	}

	if rowsAffected == 0 {
		return nil, fmt.Errorf("account not found or access denied")
	}

	return &DeleteAccountResponse{Success: true}, nil
}
