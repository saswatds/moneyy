package data

import (
	"context"
	"database/sql"
	"embed"
	"encoding/csv"
	"fmt"
	"io"
	"log"
	"strconv"
	"strings"
	"time"
)

//go:embed demo_data/*.csv
var demoDataFS embed.FS

// DemoService handles demo data operations
type DemoService struct {
	db *sql.DB
}

// NewDemoService creates a new demo service
func NewDemoService(db *sql.DB) *DemoService {
	return &DemoService{db: db}
}

// HasDemoData checks if demo data exists for the given user
func (s *DemoService) HasDemoData(ctx context.Context, userID string) (bool, error) {
	var count int
	query := "SELECT COUNT(*) FROM accounts WHERE user_id = $1"
	err := s.db.QueryRowContext(ctx, query, userID).Scan(&count)
	if err != nil {
		return false, fmt.Errorf("failed to check demo data: %w", err)
	}
	return count > 0, nil
}

// SeedDemoData imports demo data for the given user
func (s *DemoService) SeedDemoData(ctx context.Context, userID string) error {
	hasData, err := s.HasDemoData(ctx, userID)
	if err != nil {
		return err
	}
	if hasData {
		log.Printf("Demo data already exists for user %s, skipping seed", userID)
		return nil
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback()

	// Import tables in dependency order
	if err := s.importAccounts(ctx, tx, userID); err != nil {
		return fmt.Errorf("accounts: %w", err)
	}
	if err := s.importBalances(ctx, tx); err != nil {
		return fmt.Errorf("balances: %w", err)
	}
	if err := s.importHoldings(ctx, tx); err != nil {
		return fmt.Errorf("holdings: %w", err)
	}
	if err := s.importHoldingTransactions(ctx, tx); err != nil {
		return fmt.Errorf("holding_transactions: %w", err)
	}
	if err := s.importMortgageDetails(ctx, tx); err != nil {
		return fmt.Errorf("mortgage_details: %w", err)
	}
	if err := s.importMortgagePayments(ctx, tx); err != nil {
		return fmt.Errorf("mortgage_payments: %w", err)
	}
	if err := s.importLoanDetails(ctx, tx); err != nil {
		return fmt.Errorf("loan_details: %w", err)
	}
	if err := s.importLoanPayments(ctx, tx); err != nil {
		return fmt.Errorf("loan_payments: %w", err)
	}
	if err := s.importAssetDetails(ctx, tx); err != nil {
		return fmt.Errorf("asset_details: %w", err)
	}
	if err := s.importAssetDepreciationEntries(ctx, tx); err != nil {
		return fmt.Errorf("asset_depreciation_entries: %w", err)
	}
	if err := s.importRecurringExpenses(ctx, tx, userID); err != nil {
		return fmt.Errorf("recurring_expenses: %w", err)
	}
	if err := s.importProjectionScenarios(ctx, tx, userID); err != nil {
		return fmt.Errorf("projection_scenarios: %w", err)
	}
	if err := s.importEquityGrants(ctx, tx); err != nil {
		return fmt.Errorf("equity_grants: %w", err)
	}
	if err := s.importVestingSchedules(ctx, tx); err != nil {
		return fmt.Errorf("vesting_schedules: %w", err)
	}
	if err := s.importFMVHistory(ctx, tx); err != nil {
		return fmt.Errorf("fmv_history: %w", err)
	}
	if err := s.importEquityExercises(ctx, tx); err != nil {
		return fmt.Errorf("equity_exercises: %w", err)
	}
	if err := s.importEquitySales(ctx, tx); err != nil {
		return fmt.Errorf("equity_sales: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit: %w", err)
	}

	log.Printf("Demo data seeded successfully for user %s", userID)
	return nil
}

// ResetDemoData deletes all data for the user and re-imports demo data
func (s *DemoService) ResetDemoData(ctx context.Context, userID string) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback()

	// Delete in dependency order
	deletes := []string{
		"DELETE FROM equity_sales WHERE account_id IN (SELECT id FROM accounts WHERE user_id = $1)",
		"DELETE FROM equity_exercises WHERE grant_id IN (SELECT id FROM equity_grants WHERE account_id IN (SELECT id FROM accounts WHERE user_id = $1))",
		"DELETE FROM vesting_schedules WHERE grant_id IN (SELECT id FROM equity_grants WHERE account_id IN (SELECT id FROM accounts WHERE user_id = $1))",
		"DELETE FROM fmv_history WHERE account_id IN (SELECT id FROM accounts WHERE user_id = $1)",
		"DELETE FROM equity_grants WHERE account_id IN (SELECT id FROM accounts WHERE user_id = $1)",
		"DELETE FROM asset_depreciation_entries WHERE account_id IN (SELECT id FROM accounts WHERE user_id = $1)",
		"DELETE FROM asset_details WHERE account_id IN (SELECT id FROM accounts WHERE user_id = $1)",
		"DELETE FROM loan_payments WHERE account_id IN (SELECT id FROM accounts WHERE user_id = $1)",
		"DELETE FROM loan_details WHERE account_id IN (SELECT id FROM accounts WHERE user_id = $1)",
		"DELETE FROM mortgage_payments WHERE account_id IN (SELECT id FROM accounts WHERE user_id = $1)",
		"DELETE FROM mortgage_details WHERE account_id IN (SELECT id FROM accounts WHERE user_id = $1)",
		"DELETE FROM holding_transactions WHERE holding_id IN (SELECT id FROM holdings WHERE account_id IN (SELECT id FROM accounts WHERE user_id = $1))",
		"DELETE FROM holdings WHERE account_id IN (SELECT id FROM accounts WHERE user_id = $1)",
		"DELETE FROM synced_accounts WHERE credential_id IN (SELECT id FROM sync_credentials WHERE user_id = $1)",
		"DELETE FROM sync_credentials WHERE user_id = $1",
		"DELETE FROM balances WHERE account_id IN (SELECT id FROM accounts WHERE user_id = $1)",
		"DELETE FROM accounts WHERE user_id = $1",
		"DELETE FROM projection_scenarios WHERE user_id = $1",
		"DELETE FROM recurring_expenses WHERE user_id = $1",
	}

	for _, query := range deletes {
		if _, err := tx.ExecContext(ctx, query, userID); err != nil {
			return fmt.Errorf("delete failed: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit deletes: %w", err)
	}

	log.Printf("Deleted all data for user %s", userID)
	return s.SeedDemoData(ctx, userID)
}

// CSV reading helpers
func (s *DemoService) readCSV(filename string) ([][]string, error) {
	f, err := demoDataFS.Open("demo_data/" + filename)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	r := csv.NewReader(f.(io.Reader))
	records, err := r.ReadAll()
	if err != nil {
		return nil, err
	}
	if len(records) <= 1 {
		return nil, nil // Empty or header only
	}
	return records[1:], nil // Skip header
}

func parseTime(s string) time.Time {
	if s == "" {
		return time.Time{}
	}
	// Try full timestamp first
	t, err := time.Parse(time.RFC3339, s)
	if err == nil {
		return t
	}
	// Try date only
	t, err = time.Parse("2006-01-02", s)
	if err == nil {
		return t
	}
	return time.Time{}
}

func parseBool(s string) bool {
	return s == "true" || s == "1"
}

func parseFloat(s string) float64 {
	if s == "" {
		return 0
	}
	f, _ := strconv.ParseFloat(s, 64)
	return f
}

func parseInt(s string) int {
	if s == "" {
		return 0
	}
	i, _ := strconv.Atoi(s)
	return i
}

func nullStr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func nullInt(s string) *int {
	if s == "" {
		return nil
	}
	i := parseInt(s)
	return &i
}

func nullFloat(s string) *float64 {
	if s == "" {
		return nil
	}
	f := parseFloat(s)
	return &f
}

// Import functions
func (s *DemoService) importAccounts(ctx context.Context, tx *sql.Tx, userID string) error {
	rows, err := s.readCSV("accounts.csv")
	if err != nil || rows == nil {
		return err
	}
	for _, r := range rows {
		_, err := tx.ExecContext(ctx, `
			INSERT INTO accounts (id, user_id, name, type, currency, institution, is_asset, is_active, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
			r[0], userID, r[1], r[2], r[3], nullStr(r[4]), parseBool(r[5]), parseBool(r[6]), parseTime(r[7]), parseTime(r[8]))
		if err != nil {
			return fmt.Errorf("row %v: %w", r[0], err)
		}
	}
	return nil
}

func (s *DemoService) importBalances(ctx context.Context, tx *sql.Tx) error {
	rows, err := s.readCSV("balances.csv")
	if err != nil || rows == nil {
		return err
	}
	for _, r := range rows {
		_, err := tx.ExecContext(ctx, `
			INSERT INTO balances (id, account_id, amount, date, notes, created_at)
			VALUES ($1, $2, $3, $4, $5, $6)`,
			r[0], r[1], parseFloat(r[2]), parseTime(r[3]), nullStr(r[4]), parseTime(r[5]))
		if err != nil {
			return fmt.Errorf("row %v: %w", r[0], err)
		}
	}
	return nil
}

func (s *DemoService) importHoldings(ctx context.Context, tx *sql.Tx) error {
	rows, err := s.readCSV("holdings.csv")
	if err != nil || rows == nil {
		return err
	}
	for _, r := range rows {
		_, err := tx.ExecContext(ctx, `
			INSERT INTO holdings (id, account_id, type, symbol, quantity, cost_basis, currency, amount, purchase_date, notes, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
			r[0], r[1], r[2], nullStr(r[3]), nullFloat(r[4]), nullFloat(r[5]), nullStr(r[6]), nullFloat(r[7]), nullStr(r[8]), nullStr(r[9]), parseTime(r[10]), parseTime(r[11]))
		if err != nil {
			return fmt.Errorf("row %v: %w", r[0], err)
		}
	}
	return nil
}

func (s *DemoService) importHoldingTransactions(ctx context.Context, tx *sql.Tx) error {
	rows, err := s.readCSV("holding_transactions.csv")
	if err != nil || rows == nil {
		return err
	}
	for _, r := range rows {
		_, err := tx.ExecContext(ctx, `
			INSERT INTO holding_transactions (id, holding_id, type, quantity, price, total_amount, transaction_date, notes, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
			r[0], r[1], r[2], nullFloat(r[3]), nullFloat(r[4]), nullFloat(r[5]), parseTime(r[6]), nullStr(r[7]), parseTime(r[8]))
		if err != nil {
			return fmt.Errorf("row %v: %w", r[0], err)
		}
	}
	return nil
}

func (s *DemoService) importMortgageDetails(ctx context.Context, tx *sql.Tx) error {
	rows, err := s.readCSV("mortgage_details.csv")
	if err != nil || rows == nil {
		return err
	}
	for _, r := range rows {
		_, err := tx.ExecContext(ctx, `
			INSERT INTO mortgage_details (id, account_id, original_amount, interest_rate, rate_type, start_date, term_months, amortization_months, payment_amount, payment_frequency, payment_day, property_address, property_city, property_province, property_postal_code, property_value, renewal_date, maturity_date, lender, mortgage_number, notes, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)`,
			r[0], r[1], parseFloat(r[2]), parseFloat(r[3]), r[4], parseTime(r[5]), parseInt(r[6]), parseInt(r[7]), parseFloat(r[8]), r[9], nullInt(r[10]), nullStr(r[11]), nullStr(r[12]), nullStr(r[13]), nullStr(r[14]), nullFloat(r[15]), nullStr(r[16]), parseTime(r[17]), nullStr(r[18]), nullStr(r[19]), nullStr(r[20]), parseTime(r[21]), parseTime(r[22]))
		if err != nil {
			return fmt.Errorf("row %v: %w", r[0], err)
		}
	}
	return nil
}

func (s *DemoService) importMortgagePayments(ctx context.Context, tx *sql.Tx) error {
	rows, err := s.readCSV("mortgage_payments.csv")
	if err != nil || rows == nil {
		return err
	}
	for _, r := range rows {
		_, err := tx.ExecContext(ctx, `
			INSERT INTO mortgage_payments (id, account_id, payment_date, payment_amount, principal_amount, interest_amount, extra_payment, balance_after, notes, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
			r[0], r[1], parseTime(r[2]), parseFloat(r[3]), parseFloat(r[4]), parseFloat(r[5]), nullFloat(r[6]), parseFloat(r[7]), nullStr(r[8]), parseTime(r[9]))
		if err != nil {
			return fmt.Errorf("row %v: %w", r[0], err)
		}
	}
	return nil
}

func (s *DemoService) importLoanDetails(ctx context.Context, tx *sql.Tx) error {
	rows, err := s.readCSV("loan_details.csv")
	if err != nil || rows == nil {
		return err
	}
	for _, r := range rows {
		_, err := tx.ExecContext(ctx, `
			INSERT INTO loan_details (id, account_id, original_amount, interest_rate, rate_type, start_date, term_months, payment_amount, payment_frequency, payment_day, loan_type, lender, loan_number, purpose, maturity_date, notes, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
			r[0], r[1], parseFloat(r[2]), parseFloat(r[3]), r[4], parseTime(r[5]), parseInt(r[6]), parseFloat(r[7]), r[8], nullInt(r[9]), nullStr(r[10]), nullStr(r[11]), nullStr(r[12]), nullStr(r[13]), parseTime(r[14]), nullStr(r[15]), parseTime(r[16]), parseTime(r[17]))
		if err != nil {
			return fmt.Errorf("row %v: %w", r[0], err)
		}
	}
	return nil
}

func (s *DemoService) importLoanPayments(ctx context.Context, tx *sql.Tx) error {
	rows, err := s.readCSV("loan_payments.csv")
	if err != nil || rows == nil {
		return err
	}
	for _, r := range rows {
		_, err := tx.ExecContext(ctx, `
			INSERT INTO loan_payments (id, account_id, payment_date, payment_amount, principal_amount, interest_amount, extra_payment, balance_after, notes, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
			r[0], r[1], parseTime(r[2]), parseFloat(r[3]), parseFloat(r[4]), parseFloat(r[5]), nullFloat(r[6]), parseFloat(r[7]), nullStr(r[8]), parseTime(r[9]))
		if err != nil {
			return fmt.Errorf("row %v: %w", r[0], err)
		}
	}
	return nil
}

func (s *DemoService) importAssetDetails(ctx context.Context, tx *sql.Tx) error {
	rows, err := s.readCSV("asset_details.csv")
	if err != nil || rows == nil {
		return err
	}
	for _, r := range rows {
		_, err := tx.ExecContext(ctx, `
			INSERT INTO asset_details (id, account_id, asset_type, purchase_price, purchase_date, depreciation_method, useful_life_years, salvage_value, depreciation_rate, type_specific_data, notes, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
			r[0], r[1], r[2], parseFloat(r[3]), parseTime(r[4]), r[5], nullInt(r[6]), nullFloat(r[7]), nullFloat(r[8]), nullStr(r[9]), nullStr(r[10]), parseTime(r[11]), parseTime(r[12]))
		if err != nil {
			return fmt.Errorf("row %v: %w", r[0], err)
		}
	}
	return nil
}

func (s *DemoService) importAssetDepreciationEntries(ctx context.Context, tx *sql.Tx) error {
	rows, err := s.readCSV("asset_depreciation_entries.csv")
	if err != nil || rows == nil {
		return err
	}
	for _, r := range rows {
		_, err := tx.ExecContext(ctx, `
			INSERT INTO asset_depreciation_entries (id, account_id, entry_date, current_value, accumulated_depreciation, notes, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7)`,
			r[0], r[1], parseTime(r[2]), parseFloat(r[3]), parseFloat(r[4]), nullStr(r[5]), parseTime(r[6]))
		if err != nil {
			return fmt.Errorf("row %v: %w", r[0], err)
		}
	}
	return nil
}

func (s *DemoService) importRecurringExpenses(ctx context.Context, tx *sql.Tx, userID string) error {
	rows, err := s.readCSV("recurring_expenses.csv")
	if err != nil || rows == nil {
		return err
	}
	for _, r := range rows {
		_, err := tx.ExecContext(ctx, `
			INSERT INTO recurring_expenses (id, user_id, name, amount, currency, frequency, category, description, is_active, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
			r[0], userID, r[1], parseFloat(r[2]), r[3], r[4], nullStr(r[5]), nullStr(r[6]), parseBool(r[7]), parseTime(r[8]), parseTime(r[9]))
		if err != nil {
			return fmt.Errorf("row %v: %w", r[0], err)
		}
	}
	return nil
}

func (s *DemoService) importProjectionScenarios(ctx context.Context, tx *sql.Tx, userID string) error {
	rows, err := s.readCSV("projection_scenarios.csv")
	if err != nil || rows == nil {
		return err
	}
	for _, r := range rows {
		config := r[3]
		// Unescape CSV-escaped quotes
		config = strings.ReplaceAll(config, `""`, `"`)
		_, err := tx.ExecContext(ctx, `
			INSERT INTO projection_scenarios (id, user_id, name, is_default, config, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7)`,
			r[0], userID, r[1], parseBool(r[2]), config, parseTime(r[4]), parseTime(r[5]))
		if err != nil {
			return fmt.Errorf("row %v: %w", r[0], err)
		}
	}
	return nil
}

func (s *DemoService) importEquityGrants(ctx context.Context, tx *sql.Tx) error {
	rows, err := s.readCSV("equity_grants.csv")
	if err != nil || rows == nil {
		return err
	}
	for _, r := range rows {
		_, err := tx.ExecContext(ctx, `
			INSERT INTO equity_grants (id, account_id, grant_type, grant_date, quantity, strike_price, fmv_at_grant, currency, expiration_date, company_name, grant_number, notes, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
			r[0], r[1], r[2], r[3], parseInt(r[4]), nullFloat(r[5]), parseFloat(r[6]), r[7], nullStr(r[8]), nullStr(r[9]), nullStr(r[10]), nullStr(r[11]), parseTime(r[12]), parseTime(r[13]))
		if err != nil {
			return fmt.Errorf("row %v: %w", r[0], err)
		}
	}
	return nil
}

func (s *DemoService) importVestingSchedules(ctx context.Context, tx *sql.Tx) error {
	rows, err := s.readCSV("vesting_schedules.csv")
	if err != nil || rows == nil {
		return err
	}
	for _, r := range rows {
		_, err := tx.ExecContext(ctx, `
			INSERT INTO vesting_schedules (id, grant_id, schedule_type, cliff_months, total_vesting_months, vesting_frequency, milestone_description, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
			r[0], r[1], r[2], nullInt(r[3]), nullInt(r[4]), nullStr(r[5]), nullStr(r[6]), parseTime(r[7]))
		if err != nil {
			return fmt.Errorf("row %v: %w", r[0], err)
		}
	}
	return nil
}

func (s *DemoService) importFMVHistory(ctx context.Context, tx *sql.Tx) error {
	rows, err := s.readCSV("fmv_history.csv")
	if err != nil || rows == nil {
		return err
	}
	for _, r := range rows {
		_, err := tx.ExecContext(ctx, `
			INSERT INTO fmv_history (id, account_id, currency, effective_date, fmv_per_share, notes, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7)`,
			r[0], r[1], r[2], r[3], parseFloat(r[4]), nullStr(r[5]), parseTime(r[6]))
		if err != nil {
			return fmt.Errorf("row %v: %w", r[0], err)
		}
	}
	return nil
}

func (s *DemoService) importEquityExercises(ctx context.Context, tx *sql.Tx) error {
	rows, err := s.readCSV("equity_exercises.csv")
	if err != nil || rows == nil {
		return err
	}
	for _, r := range rows {
		_, err := tx.ExecContext(ctx, `
			INSERT INTO equity_exercises (id, grant_id, exercise_date, quantity, strike_price, fmv_at_exercise, exercise_cost, taxable_benefit, exercise_method, notes, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
			r[0], r[1], r[2], parseInt(r[3]), parseFloat(r[4]), parseFloat(r[5]), parseFloat(r[6]), parseFloat(r[7]), nullStr(r[8]), nullStr(r[9]), parseTime(r[10]))
		if err != nil {
			return fmt.Errorf("row %v: %w", r[0], err)
		}
	}
	return nil
}

func (s *DemoService) importEquitySales(ctx context.Context, tx *sql.Tx) error {
	rows, err := s.readCSV("equity_sales.csv")
	if err != nil || rows == nil {
		return err
	}
	for _, r := range rows {
		_, err := tx.ExecContext(ctx, `
			INSERT INTO equity_sales (id, account_id, grant_id, exercise_id, sale_date, quantity, sale_price, total_proceeds, cost_basis, capital_gain, holding_period_days, is_qualified, notes, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
			r[0], r[1], nullStr(r[2]), nullStr(r[3]), r[4], parseInt(r[5]), parseFloat(r[6]), parseFloat(r[7]), parseFloat(r[8]), parseFloat(r[9]), nullInt(r[10]), nullInt(r[11]), nullStr(r[12]), parseTime(r[13]))
		if err != nil {
			return fmt.Errorf("row %v: %w", r[0], err)
		}
	}
	return nil
}
