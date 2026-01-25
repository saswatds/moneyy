package account

import (
	"context"
	"fmt"
	"math"
	"time"

	balancesvc "encore.app/balance"
	"github.com/google/uuid"
)

// LoanDetails represents detailed loan information
type LoanDetails struct {
	ID               string    `json:"id"`
	AccountID        string    `json:"account_id"`
	OriginalAmount   float64   `json:"original_amount"`
	InterestRate     float64   `json:"interest_rate"`
	RateType         string    `json:"rate_type"` // fixed, variable
	StartDate        Date      `json:"start_date"`
	TermMonths       int       `json:"term_months"`
	PaymentAmount    float64   `json:"payment_amount"`
	PaymentFrequency string    `json:"payment_frequency"` // weekly, bi-weekly, semi-monthly, monthly
	PaymentDay       *int      `json:"payment_day,omitempty"`
	LoanType         string    `json:"loan_type,omitempty"`         // personal, auto, student, business
	Lender           string    `json:"lender,omitempty"`
	LoanNumber       string    `json:"loan_number,omitempty"`
	Purpose          string    `json:"purpose,omitempty"`
	MaturityDate     Date      `json:"maturity_date"`
	Notes            string    `json:"notes,omitempty"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

// LoanPayment represents an actual loan payment
type LoanPayment struct {
	ID              string    `json:"id"`
	AccountID       string    `json:"account_id"`
	PaymentDate     Date      `json:"payment_date"`
	PaymentAmount   float64   `json:"payment_amount"`
	PrincipalAmount float64   `json:"principal_amount"`
	InterestAmount  float64   `json:"interest_amount"`
	ExtraPayment    float64   `json:"extra_payment"`
	BalanceAfter    float64   `json:"balance_after"`
	Notes           string    `json:"notes,omitempty"`
	CreatedAt       time.Time `json:"created_at"`
}

// CreateLoanDetailsRequest represents the request to create loan details
type CreateLoanDetailsRequest struct {
	AccountID        string  `json:"account_id"`
	OriginalAmount   float64 `json:"original_amount"`
	InterestRate     float64 `json:"interest_rate"`
	RateType         string  `json:"rate_type"`
	StartDate        Date    `json:"start_date"`
	TermMonths       int     `json:"term_months"`
	PaymentAmount    float64 `json:"payment_amount"`
	PaymentFrequency string  `json:"payment_frequency"`
	PaymentDay       *int    `json:"payment_day,omitempty"`
	LoanType         string  `json:"loan_type,omitempty"`
	Lender           string  `json:"lender,omitempty"`
	LoanNumber       string  `json:"loan_number,omitempty"`
	Purpose          string  `json:"purpose,omitempty"`
	Notes            string  `json:"notes,omitempty"`
}

// CreateLoanPaymentRequest represents the request to record a loan payment
type CreateLoanPaymentRequest struct {
	AccountID       string  `json:"account_id"`
	PaymentDate     Date    `json:"payment_date"`
	PaymentAmount   float64 `json:"payment_amount"`
	PrincipalAmount float64 `json:"principal_amount"`
	InterestAmount  float64 `json:"interest_amount"`
	ExtraPayment    float64 `json:"extra_payment"`
	Notes           string  `json:"notes,omitempty"`
}

// LoanPaymentsResponse represents the loan payments list response
type LoanPaymentsResponse struct {
	Payments []LoanPayment `json:"payments"`
}

// CreateLoanDetails creates loan details for an account
//
//encore:api public method=POST path=/accounts/:accountID/loan
func CreateLoanDetails(ctx context.Context, accountID string, req *CreateLoanDetailsRequest) (*LoanDetails, error) {
	// Calculate maturity date
	maturityDate := Date{Time: req.StartDate.Time.AddDate(0, req.TermMonths, 0)}

	id := uuid.New().String()
	now := time.Now()

	err := db.QueryRow(ctx, `
		INSERT INTO loan_details (
			id, account_id, original_amount, interest_rate, rate_type,
			start_date, term_months,
			payment_amount, payment_frequency, payment_day,
			loan_type, lender, loan_number, purpose, maturity_date, notes,
			created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5,
			$6, $7,
			$8, $9, $10,
			$11, $12, $13, $14, $15, $16,
			$17, $18
		)
		RETURNING id, account_id, original_amount, interest_rate, rate_type,
			start_date, term_months,
			payment_amount, payment_frequency, payment_day,
			loan_type, lender, loan_number, purpose, maturity_date, notes,
			created_at, updated_at
	`, id, accountID, req.OriginalAmount, req.InterestRate, req.RateType,
		req.StartDate, req.TermMonths,
		req.PaymentAmount, req.PaymentFrequency, req.PaymentDay,
		req.LoanType, req.Lender, req.LoanNumber, req.Purpose, maturityDate, req.Notes,
		now, now).Scan(
		&id, &accountID, &req.OriginalAmount, &req.InterestRate, &req.RateType,
		&req.StartDate, &req.TermMonths,
		&req.PaymentAmount, &req.PaymentFrequency, &req.PaymentDay,
		&req.LoanType, &req.Lender, &req.LoanNumber, &req.Purpose, &maturityDate, &req.Notes,
		&now, &now,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to create loan details: %w", err)
	}

	// Create initial balance entry for the loan (as negative since it's a liability)
	_, err = balancesvc.Create(ctx, &balancesvc.CreateBalanceRequest{
		AccountID: accountID,
		Amount:    -req.OriginalAmount,
		Date:      req.StartDate.Time,
		Notes:     "Loan initiated",
	})
	if err != nil {
		// Log the error but don't fail the loan creation
		fmt.Printf("Warning: failed to create initial balance entry: %v\n", err)
	}

	return &LoanDetails{
		ID:               id,
		AccountID:        accountID,
		OriginalAmount:   req.OriginalAmount,
		InterestRate:     req.InterestRate,
		RateType:         req.RateType,
		StartDate:        req.StartDate,
		TermMonths:       req.TermMonths,
		PaymentAmount:    req.PaymentAmount,
		PaymentFrequency: req.PaymentFrequency,
		PaymentDay:       req.PaymentDay,
		LoanType:         req.LoanType,
		Lender:           req.Lender,
		LoanNumber:       req.LoanNumber,
		Purpose:          req.Purpose,
		MaturityDate:     maturityDate,
		Notes:            req.Notes,
		CreatedAt:        now,
		UpdatedAt:        now,
	}, nil
}

// GetLoanDetails retrieves loan details for an account
//
//encore:api public method=GET path=/accounts/:accountID/loan
func GetLoanDetails(ctx context.Context, accountID string) (*LoanDetails, error) {
	var details LoanDetails

	err := db.QueryRow(ctx, `
		SELECT id, account_id, original_amount, interest_rate, rate_type,
			start_date, term_months,
			payment_amount, payment_frequency, payment_day,
			loan_type, lender, loan_number, purpose, maturity_date, notes,
			created_at, updated_at
		FROM loan_details
		WHERE account_id = $1
	`, accountID).Scan(
		&details.ID, &details.AccountID, &details.OriginalAmount, &details.InterestRate, &details.RateType,
		&details.StartDate, &details.TermMonths,
		&details.PaymentAmount, &details.PaymentFrequency, &details.PaymentDay,
		&details.LoanType, &details.Lender, &details.LoanNumber, &details.Purpose, &details.MaturityDate, &details.Notes,
		&details.CreatedAt, &details.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to get loan details: %w", err)
	}

	return &details, nil
}

// GetLoanAmortizationSchedule generates the full amortization schedule
//
//encore:api public method=GET path=/accounts/:accountID/loan/amortization
func GetLoanAmortizationSchedule(ctx context.Context, accountID string) (*AmortizationScheduleResponse, error) {
	// Get loan details
	details, err := GetLoanDetails(ctx, accountID)
	if err != nil {
		return nil, err
	}

	schedule := calculateLoanAmortizationSchedule(details)

	return &AmortizationScheduleResponse{
		Schedule: schedule,
	}, nil
}

// calculateLoanAmortizationSchedule generates the amortization schedule for a loan
func calculateLoanAmortizationSchedule(details *LoanDetails) []AmortizationEntry {
	schedule := make([]AmortizationEntry, 0)

	balance := details.OriginalAmount
	currentDate := details.StartDate.Time

	// Convert annual rate to period rate based on payment frequency
	periodsPerYear := getPeriodsPerYear(details.PaymentFrequency)
	periodRate := details.InterestRate / float64(periodsPerYear)

	// Calculate total number of payments
	totalPayments := int(math.Ceil(float64(details.TermMonths) / (12.0 / float64(periodsPerYear))))

	for i := 1; i <= totalPayments && balance > 0.01; i++ {
		// Calculate interest for this period
		interestAmount := balance * periodRate
		principalAmount := details.PaymentAmount - interestAmount

		// Handle final payment
		if principalAmount > balance {
			principalAmount = balance
			details.PaymentAmount = principalAmount + interestAmount
		}

		balance -= principalAmount

		if balance < 0 {
			balance = 0
		}

		entry := AmortizationEntry{
			PaymentNumber:   i,
			PaymentDate:     currentDate,
			PaymentAmount:   details.PaymentAmount,
			PrincipalAmount: principalAmount,
			InterestAmount:  interestAmount,
			BalanceAfter:    balance,
		}

		schedule = append(schedule, entry)

		// Move to next payment date
		currentDate = getNextPaymentDate(currentDate, details.PaymentFrequency)
	}

	return schedule
}

// RecordLoanPayment records an actual loan payment
//
//encore:api public method=POST path=/accounts/:accountID/loan/payments
func RecordLoanPayment(ctx context.Context, accountID string, req *CreateLoanPaymentRequest) (*LoanPayment, error) {
	// Get current balance from either the last payment or the original loan amount
	var currentBalance float64
	err := db.QueryRow(ctx, `
		SELECT COALESCE(
			(SELECT balance_after FROM loan_payments WHERE account_id = $1 ORDER BY payment_date DESC, created_at DESC LIMIT 1),
			-(SELECT original_amount FROM loan_details WHERE account_id = $1)
		)
	`, accountID).Scan(&currentBalance)

	if err != nil {
		return nil, fmt.Errorf("failed to get current balance: %w", err)
	}

	// Balance after = current balance + (principal + extra payment)
	// Note: loan balance is stored as negative, so we add the payment to reduce the debt
	balanceAfter := currentBalance + req.PrincipalAmount + req.ExtraPayment

	id := uuid.New().String()
	now := time.Now()

	var payment LoanPayment
	err = db.QueryRow(ctx, `
		INSERT INTO loan_payments (
			id, account_id, payment_date,
			payment_amount, principal_amount, interest_amount, extra_payment,
			balance_after, notes, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id, account_id, payment_date,
			payment_amount, principal_amount, interest_amount, extra_payment,
			balance_after, notes, created_at
	`, id, accountID, req.PaymentDate,
		req.PaymentAmount, req.PrincipalAmount, req.InterestAmount, req.ExtraPayment,
		balanceAfter, req.Notes, now).Scan(
		&payment.ID, &payment.AccountID, &payment.PaymentDate,
		&payment.PaymentAmount, &payment.PrincipalAmount, &payment.InterestAmount, &payment.ExtraPayment,
		&payment.BalanceAfter, &payment.Notes, &payment.CreatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to record payment: %w", err)
	}

	// Also create a balance entry so the loan balance appears in the accounts list
	_, err = balancesvc.Create(ctx, &balancesvc.CreateBalanceRequest{
		AccountID: accountID,
		Amount:    balanceAfter,
		Date:      req.PaymentDate.Time,
		Notes:     "Loan payment",
	})
	if err != nil {
		// Log the error but don't fail the payment recording
		fmt.Printf("Warning: failed to create balance entry: %v\n", err)
	}

	return &payment, nil
}

// SyncLoanBalance syncs the loan balance to the balance service
//
//encore:api public method=POST path=/accounts/:accountID/loan/sync-balance
func SyncLoanBalance(ctx context.Context, accountID string) error {
	// Get loan details
	details, err := GetLoanDetails(ctx, accountID)
	if err != nil {
		return fmt.Errorf("failed to get loan details: %w", err)
	}

	// Get the latest payment if any
	var latestBalance float64
	var latestDate time.Time

	err = db.QueryRow(ctx, `
		SELECT balance_after, payment_date
		FROM loan_payments
		WHERE account_id = $1
		ORDER BY payment_date DESC, created_at DESC
		LIMIT 1
	`, accountID).Scan(&latestBalance, &latestDate)

	if err != nil {
		// No payments yet, use original amount
		latestBalance = -details.OriginalAmount
		latestDate = details.StartDate.Time
	}

	// Create or update the balance entry
	_, err = balancesvc.Create(ctx, &balancesvc.CreateBalanceRequest{
		AccountID: accountID,
		Amount:    latestBalance,
		Date:      latestDate,
		Notes:     "Loan balance sync",
	})

	if err != nil {
		return fmt.Errorf("failed to sync balance: %w", err)
	}

	return nil
}

// GetLoanPayments retrieves all payments for a loan account
//
//encore:api public method=GET path=/accounts/:accountID/loan/payments
func GetLoanPayments(ctx context.Context, accountID string) (*LoanPaymentsResponse, error) {
	rows, err := db.Query(ctx, `
		SELECT id, account_id, payment_date,
			payment_amount, principal_amount, interest_amount, extra_payment,
			balance_after, notes, created_at
		FROM loan_payments
		WHERE account_id = $1
		ORDER BY payment_date DESC
	`, accountID)

	if err != nil {
		return nil, fmt.Errorf("failed to get payments: %w", err)
	}
	defer rows.Close()

	payments := make([]LoanPayment, 0)
	for rows.Next() {
		var payment LoanPayment
		err := rows.Scan(
			&payment.ID, &payment.AccountID, &payment.PaymentDate,
			&payment.PaymentAmount, &payment.PrincipalAmount, &payment.InterestAmount, &payment.ExtraPayment,
			&payment.BalanceAfter, &payment.Notes, &payment.CreatedAt,
		)
		if err != nil {
			continue
		}
		payments = append(payments, payment)
	}

	return &LoanPaymentsResponse{
		Payments: payments,
	}, nil
}
