package account

import (
	"context"
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"math"
	"time"

	balancesvc "encore.app/balance"
	"github.com/google/uuid"
)

// Date represents a date without time, accepting YYYY-MM-DD format
type Date struct {
	time.Time
}

// UnmarshalJSON parses date from YYYY-MM-DD format
func (d *Date) UnmarshalJSON(b []byte) error {
	s := string(b)
	// Remove quotes
	if len(s) >= 2 && s[0] == '"' && s[len(s)-1] == '"' {
		s = s[1 : len(s)-1]
	}
	if s == "" || s == "null" {
		return nil
	}
	t, err := time.Parse("2006-01-02", s)
	if err != nil {
		return err
	}
	d.Time = t
	return nil
}

// MarshalJSON formats date as YYYY-MM-DD
func (d Date) MarshalJSON() ([]byte, error) {
	if d.Time.IsZero() {
		return []byte("null"), nil
	}
	return json.Marshal(d.Time.Format("2006-01-02"))
}

// Value implements driver.Valuer for database storage
func (d Date) Value() (driver.Value, error) {
	if d.Time.IsZero() {
		return nil, nil
	}
	return d.Time, nil
}

// Scan implements sql.Scanner for database retrieval
func (d *Date) Scan(value interface{}) error {
	if value == nil {
		d.Time = time.Time{}
		return nil
	}
	switch v := value.(type) {
	case time.Time:
		d.Time = v
		return nil
	case []byte:
		t, err := time.Parse("2006-01-02", string(v))
		if err != nil {
			return err
		}
		d.Time = t
		return nil
	case string:
		t, err := time.Parse("2006-01-02", v)
		if err != nil {
			return err
		}
		d.Time = t
		return nil
	default:
		return fmt.Errorf("cannot scan %T into Date", value)
	}
}

// MortgageDetails represents detailed mortgage information
type MortgageDetails struct {
	ID                   string    `json:"id"`
	AccountID            string    `json:"account_id"`
	OriginalAmount       float64   `json:"original_amount"`
	InterestRate         float64   `json:"interest_rate"`
	RateType             string    `json:"rate_type"` // fixed, variable
	StartDate            Date      `json:"start_date"`
	TermMonths           int       `json:"term_months"`
	AmortizationMonths   int       `json:"amortization_months"`
	PaymentAmount        float64   `json:"payment_amount"`
	PaymentFrequency     string    `json:"payment_frequency"` // weekly, bi-weekly, semi-monthly, monthly
	PaymentDay           *int      `json:"payment_day,omitempty"`
	PropertyAddress      string    `json:"property_address,omitempty"`
	PropertyCity         string    `json:"property_city,omitempty"`
	PropertyProvince     string    `json:"property_province,omitempty"`
	PropertyPostalCode   string    `json:"property_postal_code,omitempty"`
	PropertyValue        *float64  `json:"property_value,omitempty"`
	RenewalDate          *Date     `json:"renewal_date,omitempty"`
	MaturityDate         Date      `json:"maturity_date"`
	Lender               string    `json:"lender,omitempty"`
	MortgageNumber       string    `json:"mortgage_number,omitempty"`
	Notes                string    `json:"notes,omitempty"`
	CreatedAt            time.Time `json:"created_at"`
	UpdatedAt            time.Time `json:"updated_at"`
}

// MortgagePayment represents an actual mortgage payment
type MortgagePayment struct {
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

// AmortizationEntry represents a single entry in the amortization schedule
type AmortizationEntry struct {
	PaymentNumber   int       `json:"payment_number"`
	PaymentDate     time.Time `json:"payment_date"`
	PaymentAmount   float64   `json:"payment_amount"`
	PrincipalAmount float64   `json:"principal_amount"`
	InterestAmount  float64   `json:"interest_amount"`
	BalanceAfter    float64   `json:"balance_after"`
}

// CreateMortgageDetailsRequest represents the request to create mortgage details
type CreateMortgageDetailsRequest struct {
	AccountID          string   `json:"account_id"`
	OriginalAmount     float64  `json:"original_amount"`
	InterestRate       float64  `json:"interest_rate"`
	RateType           string   `json:"rate_type"`
	StartDate          Date     `json:"start_date"`
	TermMonths         int      `json:"term_months"`
	AmortizationMonths int      `json:"amortization_months"`
	PaymentAmount      float64  `json:"payment_amount"`
	PaymentFrequency   string   `json:"payment_frequency"`
	PaymentDay         *int     `json:"payment_day,omitempty"`
	PropertyAddress    string   `json:"property_address,omitempty"`
	PropertyCity       string   `json:"property_city,omitempty"`
	PropertyProvince   string   `json:"property_province,omitempty"`
	PropertyPostalCode string   `json:"property_postal_code,omitempty"`
	PropertyValue      *float64 `json:"property_value,omitempty"`
	RenewalDate        *Date    `json:"renewal_date,omitempty"`
	Lender             string   `json:"lender,omitempty"`
	MortgageNumber     string   `json:"mortgage_number,omitempty"`
	Notes              string   `json:"notes,omitempty"`
}

// CreateMortgagePaymentRequest represents the request to record a mortgage payment
type CreateMortgagePaymentRequest struct {
	AccountID       string  `json:"account_id"`
	PaymentDate     Date    `json:"payment_date"`
	PaymentAmount   float64 `json:"payment_amount"`
	PrincipalAmount float64 `json:"principal_amount"`
	InterestAmount  float64 `json:"interest_amount"`
	ExtraPayment    float64 `json:"extra_payment"`
	Notes           string  `json:"notes,omitempty"`
}

// AmortizationScheduleResponse represents the amortization schedule response
type AmortizationScheduleResponse struct {
	Schedule []AmortizationEntry `json:"schedule"`
}

// MortgagePaymentsResponse represents the mortgage payments list response
type MortgagePaymentsResponse struct {
	Payments []MortgagePayment `json:"payments"`
}

// CreateMortgageDetails creates mortgage details for an account
//
//encore:api public method=POST path=/accounts/:accountID/mortgage
func CreateMortgageDetails(ctx context.Context, accountID string, req *CreateMortgageDetailsRequest) (*MortgageDetails, error) {
	// Calculate maturity date
	maturityDate := Date{Time: req.StartDate.Time.AddDate(0, req.TermMonths, 0)}

	id := uuid.New().String()
	now := time.Now()

	err := db.QueryRow(ctx, `
		INSERT INTO mortgage_details (
			id, account_id, original_amount, interest_rate, rate_type,
			start_date, term_months, amortization_months,
			payment_amount, payment_frequency, payment_day,
			property_address, property_city, property_province, property_postal_code, property_value,
			renewal_date, maturity_date,
			lender, mortgage_number, notes,
			created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5,
			$6, $7, $8,
			$9, $10, $11,
			$12, $13, $14, $15, $16,
			$17, $18,
			$19, $20, $21,
			$22, $23
		)
		RETURNING id, account_id, original_amount, interest_rate, rate_type,
			start_date, term_months, amortization_months,
			payment_amount, payment_frequency, payment_day,
			property_address, property_city, property_province, property_postal_code, property_value,
			renewal_date, maturity_date,
			lender, mortgage_number, notes,
			created_at, updated_at
	`, id, accountID, req.OriginalAmount, req.InterestRate, req.RateType,
		req.StartDate, req.TermMonths, req.AmortizationMonths,
		req.PaymentAmount, req.PaymentFrequency, req.PaymentDay,
		req.PropertyAddress, req.PropertyCity, req.PropertyProvince, req.PropertyPostalCode, req.PropertyValue,
		req.RenewalDate, maturityDate,
		req.Lender, req.MortgageNumber, req.Notes,
		now, now).Scan(
		&id, &accountID, &req.OriginalAmount, &req.InterestRate, &req.RateType,
		&req.StartDate, &req.TermMonths, &req.AmortizationMonths,
		&req.PaymentAmount, &req.PaymentFrequency, &req.PaymentDay,
		&req.PropertyAddress, &req.PropertyCity, &req.PropertyProvince, &req.PropertyPostalCode, &req.PropertyValue,
		&req.RenewalDate, &maturityDate,
		&req.Lender, &req.MortgageNumber, &req.Notes,
		&now, &now,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to create mortgage details: %w", err)
	}

	// Create initial balance entry for the mortgage (as negative since it's a liability)
	_, err = balancesvc.Create(ctx, &balancesvc.CreateBalanceRequest{
		AccountID: accountID,
		Amount:    -req.OriginalAmount,
		Date:      req.StartDate.Time,
		Notes:     "Mortgage initiated",
	})
	if err != nil {
		// Log the error but don't fail the mortgage creation
		fmt.Printf("Warning: failed to create initial balance entry: %v\n", err)
	}

	return &MortgageDetails{
		ID:                 id,
		AccountID:          accountID,
		OriginalAmount:     req.OriginalAmount,
		InterestRate:       req.InterestRate,
		RateType:           req.RateType,
		StartDate:          req.StartDate,
		TermMonths:         req.TermMonths,
		AmortizationMonths: req.AmortizationMonths,
		PaymentAmount:      req.PaymentAmount,
		PaymentFrequency:   req.PaymentFrequency,
		PaymentDay:         req.PaymentDay,
		PropertyAddress:    req.PropertyAddress,
		PropertyCity:       req.PropertyCity,
		PropertyProvince:   req.PropertyProvince,
		PropertyPostalCode: req.PropertyPostalCode,
		PropertyValue:      req.PropertyValue,
		RenewalDate:        req.RenewalDate,
		MaturityDate:       maturityDate,
		Lender:             req.Lender,
		MortgageNumber:     req.MortgageNumber,
		Notes:              req.Notes,
		CreatedAt:          now,
		UpdatedAt:          now,
	}, nil
}

// GetMortgageDetails retrieves mortgage details for an account
//
//encore:api public method=GET path=/accounts/:accountID/mortgage
func GetMortgageDetails(ctx context.Context, accountID string) (*MortgageDetails, error) {
	var details MortgageDetails

	err := db.QueryRow(ctx, `
		SELECT id, account_id, original_amount, interest_rate, rate_type,
			start_date, term_months, amortization_months,
			payment_amount, payment_frequency, payment_day,
			property_address, property_city, property_province, property_postal_code, property_value,
			renewal_date, maturity_date,
			lender, mortgage_number, notes,
			created_at, updated_at
		FROM mortgage_details
		WHERE account_id = $1
	`, accountID).Scan(
		&details.ID, &details.AccountID, &details.OriginalAmount, &details.InterestRate, &details.RateType,
		&details.StartDate, &details.TermMonths, &details.AmortizationMonths,
		&details.PaymentAmount, &details.PaymentFrequency, &details.PaymentDay,
		&details.PropertyAddress, &details.PropertyCity, &details.PropertyProvince, &details.PropertyPostalCode, &details.PropertyValue,
		&details.RenewalDate, &details.MaturityDate,
		&details.Lender, &details.MortgageNumber, &details.Notes,
		&details.CreatedAt, &details.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to get mortgage details: %w", err)
	}

	return &details, nil
}

// GetAmortizationSchedule generates the full amortization schedule
//
//encore:api public method=GET path=/accounts/:accountID/mortgage/amortization
func GetAmortizationSchedule(ctx context.Context, accountID string) (*AmortizationScheduleResponse, error) {
	// Get mortgage details
	details, err := GetMortgageDetails(ctx, accountID)
	if err != nil {
		return nil, err
	}

	schedule := calculateAmortizationSchedule(details)

	return &AmortizationScheduleResponse{
		Schedule: schedule,
	}, nil
}

// calculateAmortizationSchedule generates the amortization schedule
func calculateAmortizationSchedule(details *MortgageDetails) []AmortizationEntry {
	schedule := make([]AmortizationEntry, 0)

	balance := details.OriginalAmount
	currentDate := details.StartDate.Time

	// Convert annual rate to period rate based on payment frequency
	periodsPerYear := getPeriodsPerYear(details.PaymentFrequency)
	periodRate := details.InterestRate / float64(periodsPerYear)

	// Calculate total number of payments
	totalPayments := int(math.Ceil(float64(details.AmortizationMonths) / (12.0 / float64(periodsPerYear))))

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

// getPeriodsPerYear returns the number of payment periods per year
func getPeriodsPerYear(frequency string) int {
	switch frequency {
	case "weekly":
		return 52
	case "bi-weekly":
		return 26
	case "semi-monthly":
		return 24
	case "monthly":
		return 12
	default:
		return 12
	}
}

// getNextPaymentDate calculates the next payment date based on frequency
func getNextPaymentDate(currentDate time.Time, frequency string) time.Time {
	switch frequency {
	case "weekly":
		return currentDate.AddDate(0, 0, 7)
	case "bi-weekly":
		return currentDate.AddDate(0, 0, 14)
	case "semi-monthly":
		return currentDate.AddDate(0, 0, 15)
	case "monthly":
		return currentDate.AddDate(0, 1, 0)
	default:
		return currentDate.AddDate(0, 1, 0)
	}
}

// RecordMortgagePayment records an actual mortgage payment
//
//encore:api public method=POST path=/accounts/:accountID/mortgage/payments
func RecordMortgagePayment(ctx context.Context, accountID string, req *CreateMortgagePaymentRequest) (*MortgagePayment, error) {
	// Get current balance from either the last payment or the original mortgage amount
	var currentBalance float64
	err := db.QueryRow(ctx, `
		SELECT COALESCE(
			(SELECT balance_after FROM mortgage_payments WHERE account_id = $1 ORDER BY payment_date DESC, created_at DESC LIMIT 1),
			-(SELECT original_amount FROM mortgage_details WHERE account_id = $1)
		)
	`, accountID).Scan(&currentBalance)

	if err != nil {
		return nil, fmt.Errorf("failed to get current balance: %w", err)
	}

	// Balance after = current balance + (principal + extra payment)
	// Note: mortgage balance is stored as negative, so we add the payment to reduce the debt
	balanceAfter := currentBalance + req.PrincipalAmount + req.ExtraPayment

	id := uuid.New().String()
	now := time.Now()

	var payment MortgagePayment
	err = db.QueryRow(ctx, `
		INSERT INTO mortgage_payments (
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

	// Also create a balance entry so the mortgage balance appears in the accounts list
	_, err = balancesvc.Create(ctx, &balancesvc.CreateBalanceRequest{
		AccountID: accountID,
		Amount:    balanceAfter,
		Date:      req.PaymentDate.Time,
		Notes:     "Mortgage payment",
	})
	if err != nil {
		// Log the error but don't fail the payment recording
		fmt.Printf("Warning: failed to create balance entry: %v\n", err)
	}

	return &payment, nil
}

// SyncMortgageBalance syncs the mortgage balance to the balance service
//
//encore:api public method=POST path=/accounts/:accountID/mortgage/sync-balance
func SyncMortgageBalance(ctx context.Context, accountID string) error {
	// Get mortgage details
	details, err := GetMortgageDetails(ctx, accountID)
	if err != nil {
		return fmt.Errorf("failed to get mortgage details: %w", err)
	}

	// Get the latest payment if any
	var latestBalance float64
	var latestDate time.Time

	err = db.QueryRow(ctx, `
		SELECT balance_after, payment_date
		FROM mortgage_payments
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
		Notes:     "Mortgage balance sync",
	})

	if err != nil {
		return fmt.Errorf("failed to sync balance: %w", err)
	}

	return nil
}

// GetMortgagePayments retrieves all payments for a mortgage account
//
//encore:api public method=GET path=/accounts/:accountID/mortgage/payments
func GetMortgagePayments(ctx context.Context, accountID string) (*MortgagePaymentsResponse, error) {
	rows, err := db.Query(ctx, `
		SELECT id, account_id, payment_date,
			payment_amount, principal_amount, interest_amount, extra_payment,
			balance_after, notes, created_at
		FROM mortgage_payments
		WHERE account_id = $1
		ORDER BY payment_date DESC
	`, accountID)

	if err != nil {
		return nil, fmt.Errorf("failed to get payments: %w", err)
	}
	defer rows.Close()

	payments := make([]MortgagePayment, 0)
	for rows.Next() {
		var payment MortgagePayment
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

	return &MortgagePaymentsResponse{
		Payments: payments,
	}, nil
}
