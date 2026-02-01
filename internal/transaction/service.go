package transaction

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"money/internal/auth"

	"github.com/google/uuid"
)

// Common errors
var (
	ErrNotFound = errors.New("not found")
)

// Service provides transaction management functionality
type Service struct {
	db *sql.DB
}

// NewService creates a new transaction service
func NewService(db *sql.DB) *Service {
	return &Service{db: db}
}

func generateID() string {
	return uuid.New().String()
}

// RecurringExpense represents a recurring expense
type RecurringExpense struct {
	ID          string     `json:"id"`
	UserID      string     `json:"user_id"`
	Name        string     `json:"name"`
	Description string     `json:"description,omitempty"`
	Amount      float64    `json:"amount"`
	Currency    string     `json:"currency"` // CAD, USD, INR
	Category    string     `json:"category"`
	AccountID   *string    `json:"account_id,omitempty"`
	Frequency   string     `json:"frequency"` // weekly, bi-weekly, monthly, quarterly, annually
	DayOfMonth  *int       `json:"day_of_month,omitempty"`
	DayOfWeek   *int       `json:"day_of_week,omitempty"`
	IsActive    bool       `json:"is_active"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

// CreateRecurringExpenseRequest is the request for creating a recurring expense
type CreateRecurringExpenseRequest struct {
	Name        string  `json:"name"`
	Description string  `json:"description,omitempty"`
	Amount      float64 `json:"amount"`
	Currency    string  `json:"currency"` // CAD, USD, INR
	Category    string  `json:"category"`
	AccountID   *string `json:"account_id,omitempty"`
	Frequency   string  `json:"frequency"`
	DayOfMonth  *int    `json:"day_of_month,omitempty"`
	DayOfWeek   *int    `json:"day_of_week,omitempty"`
}

// UpdateRecurringExpenseRequest is the request for updating a recurring expense
type UpdateRecurringExpenseRequest struct {
	Name        *string  `json:"name,omitempty"`
	Description *string  `json:"description,omitempty"`
	Amount      *float64 `json:"amount,omitempty"`
	Currency    *string  `json:"currency,omitempty"` // CAD, USD, INR
	Category    *string  `json:"category,omitempty"`
	AccountID   *string  `json:"account_id,omitempty"`
	Frequency   *string  `json:"frequency,omitempty"`
	DayOfMonth  *int     `json:"day_of_month,omitempty"`
	DayOfWeek   *int     `json:"day_of_week,omitempty"`
	IsActive    *bool    `json:"is_active,omitempty"`
}

// ListRecurringExpensesResponse is the response for listing recurring expenses
type ListRecurringExpensesResponse struct {
	Expenses         []RecurringExpense  `json:"expenses"`
	InferredExpenses []InferredExpense   `json:"inferred_expenses"`
}

// InferredExpense represents an expense inferred from account details
type InferredExpense struct {
	AccountID      string  `json:"account_id"`
	AccountName    string  `json:"account_name"`
	Type           string  `json:"type"`           // "mortgage" or "loan"
	Amount         float64 `json:"amount"`
	Currency       string  `json:"currency"`
	Frequency      string  `json:"frequency"`
	InterestRate   float64 `json:"interest_rate"`
	RemainingTerm  *int    `json:"remaining_term,omitempty"`  // months remaining
	OriginalAmount float64 `json:"original_amount"`
}

// CreateRecurringExpense creates a new recurring expense
func (s *Service) CreateRecurringExpense(ctx context.Context, req *CreateRecurringExpenseRequest) (*RecurringExpense, error) {
	userID := auth.GetUserID(ctx)
	if userID == "" {
		return nil, fmt.Errorf("user not authenticated")
	}

	id := generateID()
	now := time.Now()

	_, err := s.db.ExecContext(ctx, `
		INSERT INTO recurring_expenses (
			id, user_id, name, description, amount, currency, category, account_id,
			frequency, day_of_month, day_of_week, is_active, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true, $12, $13)
	`, id, userID, req.Name, req.Description, req.Amount, req.Currency, req.Category, req.AccountID,
		req.Frequency, req.DayOfMonth, req.DayOfWeek, now, now)

	if err != nil {
		return nil, fmt.Errorf("failed to create recurring expense: %w", err)
	}

	return &RecurringExpense{
		ID:          id,
		UserID:      userID,
		Name:        req.Name,
		Description: req.Description,
		Amount:      req.Amount,
		Currency:    req.Currency,
		Category:    req.Category,
		AccountID:   req.AccountID,
		Frequency:   req.Frequency,
		DayOfMonth:  req.DayOfMonth,
		DayOfWeek:   req.DayOfWeek,
		IsActive:    true,
		CreatedAt:   now,
		UpdatedAt:   now,
	}, nil
}

// ListRecurringExpenses lists all recurring expenses for the authenticated user
func (s *Service) ListRecurringExpenses(ctx context.Context) (*ListRecurringExpensesResponse, error) {
	userID := auth.GetUserID(ctx)
	if userID == "" {
		return nil, fmt.Errorf("user not authenticated")
	}

	rows, err := s.db.QueryContext(ctx, `
		SELECT id, user_id, name, description, amount, currency, category, account_id,
		       frequency, day_of_month, day_of_week,
		       is_active, created_at, updated_at
		FROM recurring_expenses
		WHERE user_id = $1
		ORDER BY name ASC
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to list recurring expenses: %w", err)
	}
	defer rows.Close()

	var expenses []RecurringExpense
	for rows.Next() {
		var expense RecurringExpense
		err := rows.Scan(
			&expense.ID, &expense.UserID, &expense.Name, &expense.Description,
			&expense.Amount, &expense.Currency, &expense.Category, &expense.AccountID, &expense.Frequency,
			&expense.DayOfMonth, &expense.DayOfWeek,
			&expense.IsActive, &expense.CreatedAt, &expense.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan recurring expense: %w", err)
		}
		expenses = append(expenses, expense)
	}

	if expenses == nil {
		expenses = []RecurringExpense{}
	}

	// Fetch inferred expenses from mortgage and loan accounts
	inferredExpenses, err := s.getInferredExpenses(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get inferred expenses: %w", err)
	}

	return &ListRecurringExpensesResponse{
		Expenses:         expenses,
		InferredExpenses: inferredExpenses,
	}, nil
}

// getInferredExpenses fetches payment information from mortgage and loan accounts
func (s *Service) getInferredExpenses(ctx context.Context, userID string) ([]InferredExpense, error) {
	var inferredExpenses []InferredExpense

	// Get mortgage payments
	mortgageRows, err := s.db.QueryContext(ctx, `
		SELECT
			a.id,
			a.name,
			a.currency,
			md.payment_amount,
			md.payment_frequency,
			md.interest_rate,
			md.original_amount,
			md.term_months,
			md.start_date
		FROM accounts a
		JOIN mortgage_details md ON a.id = md.account_id
		WHERE a.user_id = $1 AND a.is_active = true
	`, userID)
	if err != nil {
		return nil, err
	}
	defer mortgageRows.Close()

	for mortgageRows.Next() {
		var accountID, accountName, currency, frequency string
		var amount, interestRate, originalAmount float64
		var termMonths int
		var startDate time.Time

		err := mortgageRows.Scan(
			&accountID, &accountName, &currency,
			&amount, &frequency, &interestRate, &originalAmount,
			&termMonths, &startDate,
		)
		if err != nil {
			continue
		}

		// Calculate remaining term
		monthsElapsed := int(time.Since(startDate).Hours() / 24 / 30)
		remainingTerm := termMonths - monthsElapsed
		if remainingTerm < 0 {
			remainingTerm = 0
		}

		inferredExpenses = append(inferredExpenses, InferredExpense{
			AccountID:      accountID,
			AccountName:    accountName,
			Type:           "mortgage",
			Amount:         amount,
			Currency:       currency,
			Frequency:      frequency,
			InterestRate:   interestRate,
			RemainingTerm:  &remainingTerm,
			OriginalAmount: originalAmount,
		})
	}

	// Get loan payments
	loanRows, err := s.db.QueryContext(ctx, `
		SELECT
			a.id,
			a.name,
			a.currency,
			ld.payment_amount,
			ld.payment_frequency,
			ld.interest_rate,
			ld.original_amount,
			ld.term_months,
			ld.start_date
		FROM accounts a
		JOIN loan_details ld ON a.id = ld.account_id
		WHERE a.user_id = $1 AND a.is_active = true
	`, userID)
	if err != nil {
		return inferredExpenses, nil // Return mortgages even if loans fail
	}
	defer loanRows.Close()

	for loanRows.Next() {
		var accountID, accountName, currency, frequency string
		var amount, interestRate, originalAmount float64
		var termMonths int
		var startDate time.Time

		err := loanRows.Scan(
			&accountID, &accountName, &currency,
			&amount, &frequency, &interestRate, &originalAmount,
			&termMonths, &startDate,
		)
		if err != nil {
			continue
		}

		// Calculate remaining term
		monthsElapsed := int(time.Since(startDate).Hours() / 24 / 30)
		remainingTerm := termMonths - monthsElapsed
		if remainingTerm < 0 {
			remainingTerm = 0
		}

		inferredExpenses = append(inferredExpenses, InferredExpense{
			AccountID:      accountID,
			AccountName:    accountName,
			Type:           "loan",
			Amount:         amount,
			Currency:       currency,
			Frequency:      frequency,
			InterestRate:   interestRate,
			RemainingTerm:  &remainingTerm,
			OriginalAmount: originalAmount,
		})
	}

	if inferredExpenses == nil {
		inferredExpenses = []InferredExpense{}
	}

	return inferredExpenses, nil
}

// GetRecurringExpense gets a single recurring expense by ID
func (s *Service) GetRecurringExpense(ctx context.Context, id string) (*RecurringExpense, error) {
	userID := auth.GetUserID(ctx)
	if userID == "" {
		return nil, fmt.Errorf("user not authenticated")
	}

	var expense RecurringExpense
	err := s.db.QueryRowContext(ctx, `
		SELECT id, user_id, name, description, amount, currency, category, account_id,
		       frequency, day_of_month, day_of_week,
		       is_active, created_at, updated_at
		FROM recurring_expenses
		WHERE id = $1 AND user_id = $2
	`, id, userID).Scan(
		&expense.ID, &expense.UserID, &expense.Name, &expense.Description,
		&expense.Amount, &expense.Currency, &expense.Category, &expense.AccountID, &expense.Frequency,
		&expense.DayOfMonth, &expense.DayOfWeek,
		&expense.IsActive, &expense.CreatedAt, &expense.UpdatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, err
	}

	return &expense, nil
}

// UpdateRecurringExpense updates a recurring expense
func (s *Service) UpdateRecurringExpense(ctx context.Context, id string, req *UpdateRecurringExpenseRequest) (*RecurringExpense, error) {
	userID := auth.GetUserID(ctx)
	if userID == "" {
		return nil, fmt.Errorf("user not authenticated")
	}

	now := time.Now()

	// Build dynamic update query
	query := `UPDATE recurring_expenses SET updated_at = $3`
	args := []any{id, userID, now}
	argIdx := 4

	if req.Name != nil {
		query += fmt.Sprintf(`, name = $%d`, argIdx)
		args = append(args, *req.Name)
		argIdx++
	}
	if req.Description != nil {
		query += fmt.Sprintf(`, description = $%d`, argIdx)
		args = append(args, *req.Description)
		argIdx++
	}
	if req.Amount != nil {
		query += fmt.Sprintf(`, amount = $%d`, argIdx)
		args = append(args, *req.Amount)
		argIdx++
	}
	if req.Currency != nil {
		query += fmt.Sprintf(`, currency = $%d`, argIdx)
		args = append(args, *req.Currency)
		argIdx++
	}
	if req.Category != nil {
		query += fmt.Sprintf(`, category = $%d`, argIdx)
		args = append(args, *req.Category)
		argIdx++
	}
	if req.AccountID != nil {
		query += fmt.Sprintf(`, account_id = $%d`, argIdx)
		args = append(args, *req.AccountID)
		argIdx++
	}
	if req.Frequency != nil {
		query += fmt.Sprintf(`, frequency = $%d`, argIdx)
		args = append(args, *req.Frequency)
		argIdx++
	}
	if req.DayOfMonth != nil {
		query += fmt.Sprintf(`, day_of_month = $%d`, argIdx)
		args = append(args, *req.DayOfMonth)
		argIdx++
	}
	if req.DayOfWeek != nil {
		query += fmt.Sprintf(`, day_of_week = $%d`, argIdx)
		args = append(args, *req.DayOfWeek)
		argIdx++
	}
	if req.IsActive != nil {
		query += fmt.Sprintf(`, is_active = $%d`, argIdx)
		args = append(args, *req.IsActive)
		argIdx++
	}

	query += ` WHERE id = $1 AND user_id = $2`

	_, err := s.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to update recurring expense: %w", err)
	}

	// Fetch and return the updated expense
	return s.GetRecurringExpense(ctx, id)
}

// DeleteRecurringExpense deletes a recurring expense
func (s *Service) DeleteRecurringExpense(ctx context.Context, id string) error {
	userID := auth.GetUserID(ctx)
	if userID == "" {
		return fmt.Errorf("user not authenticated")
	}

	result, err := s.db.ExecContext(ctx, `
		DELETE FROM recurring_expenses
		WHERE id = $1 AND user_id = $2
	`, id, userID)

	if err != nil {
		return fmt.Errorf("failed to delete recurring expense: %w", err)
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return ErrNotFound
	}

	return nil
}
