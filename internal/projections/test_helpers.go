package projections

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"money/internal/account"
	"money/internal/auth"
	"money/internal/transaction"
)

// SetupTestDB sets up a test database connection
func SetupTestDB(t *testing.T) *sql.DB {
	t.Helper()
	return account.SetupTestDB(t)
}

// CleanupTestDB cleans up test data after tests
func CleanupTestDB(t *testing.T, db *sql.DB) {
	t.Helper()

	// Clean projection scenarios
	_, err := db.Exec("DELETE FROM projection_scenarios WHERE user_id LIKE 'test-%'")
	if err != nil {
		t.Logf("Warning: failed to clean projection_scenarios: %v", err)
	}

	account.CleanupTestDB(t, db)
}

// SetupProjectionService sets up projection service for testing
func SetupProjectionService(t *testing.T, db *sql.DB) *Service {
	t.Helper()

	accountSvc := account.SetupAccountService(t, db)
	transactionSvc := transaction.NewService(db)

	return NewService(db, db, accountSvc, transactionSvc)
}

// CreateAuthContext creates a context with user ID for testing
func CreateAuthContext(userID string) context.Context {
	return context.WithValue(context.Background(), auth.UserIDKey, userID)
}

// CreateTestScenario creates a test projection scenario
func CreateTestScenario(t *testing.T, db *sql.DB, userID string, isDefault bool) string {
	t.Helper()

	scenarioID := fmt.Sprintf("test-scenario-%d", time.Now().UnixNano())
	config := DefaultTestConfig()

	configJSON, err := json.Marshal(config)
	if err != nil {
		t.Fatalf("Failed to marshal config: %v", err)
	}

	_, err = db.Exec(`
		INSERT INTO projection_scenarios (id, user_id, name, is_default, config, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, scenarioID, userID, "Test Scenario", isDefault, configJSON, time.Now(), time.Now())

	if err != nil {
		t.Fatalf("Failed to create test scenario: %v", err)
	}

	return scenarioID
}

// CreateTestAccountForProjection creates a test account with balance
func CreateTestAccountForProjection(t *testing.T, db *sql.DB, userID string, accountType account.AccountType, balance float64) string {
	t.Helper()

	accountID := account.CreateTestAccount(t, db, userID, accountType)
	account.CreateTestBalance(t, db, accountID, balance)

	return accountID
}

// CreateTestMortgageForProjection creates a mortgage for testing
func CreateTestMortgageForProjection(t *testing.T, db *sql.DB, userID string) string {
	t.Helper()

	accountID := CreateTestAccountForProjection(t, db, userID, account.AccountTypeMortgage, -400000.00)

	// Create mortgage details
	startDate := time.Now()
	maturityDate := startDate.AddDate(0, 300, 0) // Add amortization_months
	_, err := db.Exec(`
		INSERT INTO mortgage_details (
			id, account_id, original_amount, interest_rate, rate_type,
			start_date, maturity_date, term_months, amortization_months,
			payment_amount, payment_frequency, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
	`, fmt.Sprintf("test-mortgage-%d", time.Now().UnixNano()), accountID, 400000.00, 0.03, "fixed",
		startDate, maturityDate, 60, 300, 1896.00, "monthly", time.Now(), time.Now())

	if err != nil {
		t.Fatalf("Failed to create mortgage details: %v", err)
	}

	return accountID
}

// CreateTestLoanForProjection creates a loan for testing
func CreateTestLoanForProjection(t *testing.T, db *sql.DB, userID string) string {
	t.Helper()

	accountID := CreateTestAccountForProjection(t, db, userID, account.AccountTypeLoan, -10000.00)

	// Create loan details
	startDate := time.Now()
	maturityDate := startDate.AddDate(0, 36, 0) // Add term_months
	_, err := db.Exec(`
		INSERT INTO loan_details (
			id, account_id, original_amount, interest_rate, rate_type,
			start_date, maturity_date, term_months, payment_amount, payment_frequency,
			created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
	`, fmt.Sprintf("test-loan-%d", time.Now().UnixNano()), accountID, 10000.00, 0.05, "fixed",
		startDate, maturityDate, 36, 299.71, "monthly", time.Now(), time.Now())

	if err != nil {
		t.Fatalf("Failed to create loan details: %v", err)
	}

	return accountID
}

// CreateTestRecurringExpense creates a recurring expense for testing
func CreateTestRecurringExpense(t *testing.T, db *sql.DB, userID string, amount float64, frequency string) {
	t.Helper()

	_, err := db.Exec(`
		INSERT INTO recurring_expenses (
			id, user_id, name, amount, currency, frequency, category, is_active, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`, fmt.Sprintf("test-expense-%d", time.Now().UnixNano()), userID, "Test Expense",
		amount, "CAD", frequency, "test", true, time.Now(), time.Now())

	if err != nil {
		t.Fatalf("Failed to create recurring expense: %v", err)
	}
}

// DefaultTestConfig returns a default config for testing
func DefaultTestConfig() *Config {
	return &Config{
		TimeHorizonYears:   5,
		InflationRate:      0.02,
		AnnualSalary:       75000.00,
		AnnualSalaryGrowth: 0.03,
		FederalTaxBrackets: []TaxBracket{
			{UpToIncome: 50000, Rate: 0.15},
			{UpToIncome: 100000, Rate: 0.20},
			{UpToIncome: 0, Rate: 0.26},
		},
		ProvincialTaxBrackets: []TaxBracket{
			{UpToIncome: 45000, Rate: 0.0505},
			{UpToIncome: 90000, Rate: 0.0915},
			{UpToIncome: 0, Rate: 0.1116},
		},
		MonthlyExpenses:     3000.00,
		AnnualExpenseGrowth: 0.02,
		MonthlySavingsRate:  0.20,
		InvestmentReturns: map[string]float64{
			"tfsa":      0.07,
			"rrsp":      0.07,
			"brokerage": 0.06,
		},
		ExtraDebtPayments: map[string]float64{},
		AssetAppreciation: map[string]float64{
			"real_estate": 0.03,
			"vehicle":     -0.15,
		},
		SavingsAllocation: map[string]float64{
			"tfsa": 0.60,
			"rrsp": 0.40,
		},
		Events: []Event{},
	}
}
