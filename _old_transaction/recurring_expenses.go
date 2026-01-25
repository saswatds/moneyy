package transaction

import (
	"context"
	"fmt"
	"time"

	"encore.dev/beta/errs"
	"encore.dev/storage/sqldb"
	"github.com/google/uuid"
)

// Default user ID for demo purposes (no auth system yet)
const defaultUserID = "demo-user"

var db = sqldb.Named("transaction")

func generateID() string {
	return uuid.New().String()
}

// RecurringExpense represents a recurring expense
type RecurringExpense struct {
	ID          string  `json:"id"`
	UserID      string  `json:"user_id"`
	Name        string  `json:"name"`
	Description string  `json:"description,omitempty"`
	Amount      float64 `json:"amount"`
	Currency    string  `json:"currency"` // CAD, USD, INR
	Category    string  `json:"category"`
	AccountID   *string `json:"account_id,omitempty"`
	Frequency   string  `json:"frequency"` // weekly, bi-weekly, monthly, quarterly, annually
	DayOfMonth  *int    `json:"day_of_month,omitempty"`
	DayOfWeek   *int    `json:"day_of_week,omitempty"`
	IsActive    bool    `json:"is_active"`
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
	Expenses []RecurringExpense `json:"expenses"`
}

// CreateRecurringExpense creates a new recurring expense
//
//encore:api public path=/recurring-expenses method=POST
func CreateRecurringExpense(ctx context.Context, req *CreateRecurringExpenseRequest) (*RecurringExpense, error) {
	uid := defaultUserID

	id := generateID()

	var expense RecurringExpense
	err := db.QueryRow(ctx, `
		INSERT INTO recurring_expenses (
			id, user_id, name, description, amount, currency, category, account_id,
			frequency, day_of_month, day_of_week, is_active
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
		RETURNING id, user_id, name, description, amount, currency, category, account_id,
		          frequency, day_of_month, day_of_week,
		          is_active, created_at, updated_at
	`, id, uid, req.Name, req.Description, req.Amount, req.Currency, req.Category, req.AccountID,
		req.Frequency, req.DayOfMonth, req.DayOfWeek,
	).Scan(
		&expense.ID, &expense.UserID, &expense.Name, &expense.Description,
		&expense.Amount, &expense.Currency, &expense.Category, &expense.AccountID, &expense.Frequency,
		&expense.DayOfMonth, &expense.DayOfWeek,
		&expense.IsActive, &expense.CreatedAt, &expense.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to create recurring expense: %w", err)
	}

	return &expense, nil
}

// ListRecurringExpenses lists all recurring expenses for the authenticated user
//
//encore:api public path=/recurring-expenses method=GET
func ListRecurringExpenses(ctx context.Context) (*ListRecurringExpensesResponse, error) {
	uid := defaultUserID

	rows, err := db.Query(ctx, `
		SELECT id, user_id, name, description, amount, currency, category, account_id,
		       frequency, day_of_month, day_of_week,
		       is_active, created_at, updated_at
		FROM recurring_expenses
		WHERE user_id = $1
		ORDER BY name ASC
	`, uid)
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

	return &ListRecurringExpensesResponse{Expenses: expenses}, nil
}

// GetRecurringExpense gets a single recurring expense by ID
//
//encore:api public path=/recurring-expenses/:id method=GET
func GetRecurringExpense(ctx context.Context, id string) (*RecurringExpense, error) {
	uid := defaultUserID

	var expense RecurringExpense
	err := db.QueryRow(ctx, `
		SELECT id, user_id, name, description, amount, currency, category, account_id,
		       frequency, day_of_month, day_of_week,
		       is_active, created_at, updated_at
		FROM recurring_expenses
		WHERE id = $1 AND user_id = $2
	`, id, uid).Scan(
		&expense.ID, &expense.UserID, &expense.Name, &expense.Description,
		&expense.Amount, &expense.Currency, &expense.Category, &expense.AccountID, &expense.Frequency,
		&expense.DayOfMonth, &expense.DayOfWeek,
		&expense.IsActive, &expense.CreatedAt, &expense.UpdatedAt,
	)

	if err != nil {
		return nil, &errs.Error{Code: errs.NotFound, Message: "recurring expense not found"}
	}

	return &expense, nil
}

// UpdateRecurringExpense updates a recurring expense
//
//encore:api public path=/recurring-expenses/:id method=PUT
func UpdateRecurringExpense(ctx context.Context, id string, req *UpdateRecurringExpenseRequest) (*RecurringExpense, error) {
	uid := defaultUserID

	// Build dynamic update query
	query := `UPDATE recurring_expenses SET updated_at = NOW()`
	args := []any{id, uid}
	argIdx := 3

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

	query += ` WHERE id = $1 AND user_id = $2
		RETURNING id, user_id, name, description, amount, currency, category, account_id,
		          frequency, day_of_month, day_of_week,
		          is_active, created_at, updated_at`

	var expense RecurringExpense
	err := db.QueryRow(ctx, query, args...).Scan(
		&expense.ID, &expense.UserID, &expense.Name, &expense.Description,
		&expense.Amount, &expense.Currency, &expense.Category, &expense.AccountID, &expense.Frequency,
		&expense.DayOfMonth, &expense.DayOfWeek,
		&expense.IsActive, &expense.CreatedAt, &expense.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to update recurring expense: %w", err)
	}

	return &expense, nil
}

// DeleteRecurringExpense deletes a recurring expense
//
//encore:api public path=/recurring-expenses/:id method=DELETE
func DeleteRecurringExpense(ctx context.Context, id string) error {
	uid := defaultUserID

	result, err := db.Exec(ctx, `
		DELETE FROM recurring_expenses
		WHERE id = $1 AND user_id = $2
	`, id, uid)

	if err != nil {
		return fmt.Errorf("failed to delete recurring expense: %w", err)
	}

	rowsAffected := result.RowsAffected()
	if rowsAffected == 0 {
		return &errs.Error{Code: errs.NotFound, Message: "recurring expense not found"}
	}

	return nil
}
