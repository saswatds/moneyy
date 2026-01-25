// Package holdings implements portfolio holdings management.
package holdings

import (
	"context"
	"database/sql"
	"time"
)

// Service provides holdings management functionality
type Service struct {
	db *sql.DB
}

// NewService creates a new holdings service
func NewService(db *sql.DB) *Service {
	return &Service{db: db}
}

// HoldingType represents the type of holding
type HoldingType string

const (
	HoldingTypeCash       HoldingType = "cash"
	HoldingTypeStock      HoldingType = "stock"
	HoldingTypeETF        HoldingType = "etf"
	HoldingTypeMutualFund HoldingType = "mutual_fund"
	HoldingTypeBond       HoldingType = "bond"
	HoldingTypeCrypto     HoldingType = "crypto"
	HoldingTypeOption     HoldingType = "option"
	HoldingTypeOther      HoldingType = "other"
)

// Currency represents supported currencies
type Currency string

const (
	CurrencyCAD Currency = "CAD"
	CurrencyUSD Currency = "USD"
	CurrencyINR Currency = "INR"
)

// Holding represents a security or cash position in an account
type Holding struct {
	ID        string      `json:"id"`
	AccountID string      `json:"account_id"`
	Type      HoldingType `json:"type"`

	// For securities
	Symbol    *string  `json:"symbol,omitempty"`
	Quantity  *float64 `json:"quantity,omitempty"`
	CostBasis *float64 `json:"cost_basis,omitempty"`

	// For cash
	Currency *Currency `json:"currency,omitempty"`
	Amount   *float64  `json:"amount,omitempty"`

	// Metadata
	PurchaseDate *time.Time `json:"purchase_date,omitempty"`
	Notes        string     `json:"notes,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

// CreateHoldingRequest represents the request to create a new holding
type CreateHoldingRequest struct {
	AccountID string      `json:"account_id"`
	Type      HoldingType `json:"type"`

	// For securities
	Symbol    *string  `json:"symbol,omitempty"`
	Quantity  *float64 `json:"quantity,omitempty"`
	CostBasis *float64 `json:"cost_basis,omitempty"`

	// For cash
	Currency *string  `json:"currency,omitempty"`
	Amount   *float64 `json:"amount,omitempty"`

	// Metadata
	PurchaseDate *string `json:"purchase_date,omitempty"`
	Notes        string  `json:"notes,omitempty"`
}

// UpdateHoldingRequest represents the request to update a holding
type UpdateHoldingRequest struct {
	Quantity  *float64 `json:"quantity,omitempty"`
	CostBasis *float64 `json:"cost_basis,omitempty"`
	Amount    *float64 `json:"amount,omitempty"`
	Notes     *string  `json:"notes,omitempty"`
}

// ListHoldingsResponse represents the response for listing holdings
type ListHoldingsResponse struct {
	Holdings []*Holding `json:"holdings"`
}

// DeleteHoldingResponse represents the response for deleting a holding
type DeleteHoldingResponse struct {
	Success bool `json:"success"`
}

// Create creates a new holding
func (s *Service) Create(ctx context.Context, req *CreateHoldingRequest) (*Holding, error) {
	// TODO: Verify user owns the account

	holding := &Holding{
		AccountID: req.AccountID,
		Type:      req.Type,
		Symbol:    req.Symbol,
		Quantity:  req.Quantity,
		CostBasis: req.CostBasis,
		Notes:     req.Notes,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	// Handle currency for cash holdings
	if req.Currency != nil {
		curr := Currency(*req.Currency)
		holding.Currency = &curr
	}
	holding.Amount = req.Amount

	// Parse purchase date if provided
	var purchaseDate *time.Time
	if req.PurchaseDate != nil {
		t, err := time.Parse("2006-01-02", *req.PurchaseDate)
		if err == nil {
			purchaseDate = &t
		}
	}
	holding.PurchaseDate = purchaseDate

	err := s.db.QueryRowContext(ctx, `
		INSERT INTO holdings (
			account_id, type, symbol, quantity, cost_basis,
			currency, amount, purchase_date, notes, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		ON CONFLICT (account_id, symbol) DO UPDATE SET
			quantity = EXCLUDED.quantity,
			cost_basis = EXCLUDED.cost_basis,
			notes = EXCLUDED.notes,
			updated_at = EXCLUDED.updated_at
		RETURNING id
	`, req.AccountID, req.Type, req.Symbol, req.Quantity, req.CostBasis,
		holding.Currency, req.Amount, purchaseDate, req.Notes,
		holding.CreatedAt, holding.UpdatedAt).Scan(&holding.ID)

	if err != nil {
		return nil, err
	}

	return holding, nil
}

// GetAccountHoldings retrieves all holdings for a specific account
func (s *Service) GetAccountHoldings(ctx context.Context, accountID string) (*ListHoldingsResponse, error) {
	// TODO: Verify user owns the account

	rows, err := s.db.QueryContext(ctx, `
		SELECT
			id, account_id, type, symbol, quantity, cost_basis,
			currency, amount, purchase_date, notes, created_at, updated_at
		FROM holdings
		WHERE account_id = $1
		ORDER BY created_at DESC
	`, accountID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var holdings []*Holding
	for rows.Next() {
		holding := &Holding{}
		err := rows.Scan(
			&holding.ID,
			&holding.AccountID,
			&holding.Type,
			&holding.Symbol,
			&holding.Quantity,
			&holding.CostBasis,
			&holding.Currency,
			&holding.Amount,
			&holding.PurchaseDate,
			&holding.Notes,
			&holding.CreatedAt,
			&holding.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		holdings = append(holdings, holding)
	}

	return &ListHoldingsResponse{Holdings: holdings}, nil
}

// Get retrieves a single holding by ID
func (s *Service) Get(ctx context.Context, id string) (*Holding, error) {
	// TODO: Verify user owns the account associated with this holding

	holding := &Holding{}
	err := s.db.QueryRowContext(ctx, `
		SELECT
			id, account_id, type, symbol, quantity, cost_basis,
			currency, amount, purchase_date, notes, created_at, updated_at
		FROM holdings
		WHERE id = $1
	`, id).Scan(
		&holding.ID,
		&holding.AccountID,
		&holding.Type,
		&holding.Symbol,
		&holding.Quantity,
		&holding.CostBasis,
		&holding.Currency,
		&holding.Amount,
		&holding.PurchaseDate,
		&holding.Notes,
		&holding.CreatedAt,
		&holding.UpdatedAt,
	)

	if err != nil {
		return nil, err
	}

	return holding, nil
}

// Update updates an existing holding
func (s *Service) Update(ctx context.Context, id string, req *UpdateHoldingRequest) (*Holding, error) {
	// TODO: Verify user owns the account associated with this holding

	// Get current holding
	holding, err := s.Get(ctx, id)
	if err != nil {
		return nil, err
	}

	// Update fields
	if req.Quantity != nil {
		holding.Quantity = req.Quantity
	}
	if req.CostBasis != nil {
		holding.CostBasis = req.CostBasis
	}
	if req.Amount != nil {
		holding.Amount = req.Amount
	}
	if req.Notes != nil {
		holding.Notes = *req.Notes
	}
	holding.UpdatedAt = time.Now()

	_, err = s.db.ExecContext(ctx, `
		UPDATE holdings
		SET quantity = $1, cost_basis = $2, amount = $3, notes = $4, updated_at = $5
		WHERE id = $6
	`, holding.Quantity, holding.CostBasis, holding.Amount, holding.Notes,
		holding.UpdatedAt, id)

	if err != nil {
		return nil, err
	}

	return holding, nil
}

// Delete deletes a holding
func (s *Service) Delete(ctx context.Context, id string) (*DeleteHoldingResponse, error) {
	// TODO: Verify user owns the account associated with this holding

	_, err := s.db.ExecContext(ctx, `
		DELETE FROM holdings
		WHERE id = $1
	`, id)

	if err != nil {
		return nil, err
	}

	return &DeleteHoldingResponse{Success: true}, nil
}
