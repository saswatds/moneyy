package data

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"
)

const (
	ExportVersion = "1.0"
	AppVersion    = "1.0.0"
)

// ExportService handles data export operations
type ExportService struct {
	db *sql.DB
}

// NewExportService creates a new export service
func NewExportService(db *sql.DB) *ExportService {
	return &ExportService{db: db}
}

// ExportData creates a ZIP archive with all user data
func (s *ExportService) ExportData(ctx context.Context, userID string) ([]byte, error) {
	// Export all tables
	accounts, err := s.exportAccounts(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to export accounts: %w", err)
	}

	balances, err := s.exportBalances(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to export balances: %w", err)
	}

	holdings, err := s.exportHoldings(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to export holdings: %w", err)
	}

	holdingTransactions, err := s.exportHoldingTransactions(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to export holding transactions: %w", err)
	}

	mortgageDetails, err := s.exportMortgageDetails(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to export mortgage details: %w", err)
	}

	mortgagePayments, err := s.exportMortgagePayments(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to export mortgage payments: %w", err)
	}

	loanDetails, err := s.exportLoanDetails(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to export loan details: %w", err)
	}

	loanPayments, err := s.exportLoanPayments(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to export loan payments: %w", err)
	}

	assetDetails, err := s.exportAssetDetails(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to export asset details: %w", err)
	}

	assetDepreciation, err := s.exportAssetDepreciation(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to export asset depreciation: %w", err)
	}

	recurringExpenses, err := s.exportRecurringExpenses(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to export recurring expenses: %w", err)
	}

	projections, err := s.exportProjections(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to export projections: %w", err)
	}

	exchangeRates, err := s.exportExchangeRates(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to export exchange rates: %w", err)
	}

	// Create manifest
	tables := map[string][]byte{
		"accounts":                  accounts,
		"balances":                  balances,
		"holdings":                  holdings,
		"holding_transactions":      holdingTransactions,
		"mortgage_details":          mortgageDetails,
		"mortgage_payments":         mortgagePayments,
		"loan_details":              loanDetails,
		"loan_payments":             loanPayments,
		"asset_details":             assetDetails,
		"asset_depreciation_entries": assetDepreciation,
		"recurring_expenses":        recurringExpenses,
		"projection_scenarios":      projections,
		"exchange_rates":            exchangeRates,
	}

	manifest := s.createManifest(userID, tables)
	manifestData, err := json.MarshalIndent(manifest, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("failed to marshal manifest: %w", err)
	}

	// Create ZIP archive
	return s.createZipArchive(manifestData, tables)
}

// exportAccounts exports all accounts for a user
func (s *ExportService) exportAccounts(ctx context.Context, userID string) ([]byte, error) {
	query := `
		SELECT id, user_id, name, type, currency, institution, is_asset, is_active,
		       synced_account_id, created_at, updated_at
		FROM accounts
		WHERE user_id = $1
		ORDER BY created_at
	`

	rows, err := s.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var accounts []Account
	for rows.Next() {
		var acc Account
		err := rows.Scan(
			&acc.ID, &acc.UserID, &acc.Name, &acc.Type, &acc.Currency,
			&acc.Institution, &acc.IsAsset, &acc.IsActive, &acc.SyncedAccountID,
			&acc.CreatedAt, &acc.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		accounts = append(accounts, acc)
	}

	return json.Marshal(accounts)
}

// exportBalances exports all balances for user's accounts
func (s *ExportService) exportBalances(ctx context.Context, userID string) ([]byte, error) {
	query := `
		SELECT b.id, b.account_id, b.amount, b.date, b.notes, b.created_at
		FROM balances b
		JOIN accounts a ON b.account_id = a.id
		WHERE a.user_id = $1
		ORDER BY b.date, b.created_at
	`

	rows, err := s.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var balances []Balance
	for rows.Next() {
		var bal Balance
		err := rows.Scan(
			&bal.ID, &bal.AccountID, &bal.Amount, &bal.Date,
			&bal.Notes, &bal.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		balances = append(balances, bal)
	}

	return json.Marshal(balances)
}

// exportHoldings exports all holdings for user's accounts
func (s *ExportService) exportHoldings(ctx context.Context, userID string) ([]byte, error) {
	query := `
		SELECT h.id, h.account_id, h.type, h.symbol, h.quantity, h.cost_basis,
		       h.currency, h.amount, h.purchase_date, h.notes, h.created_at, h.updated_at
		FROM holdings h
		JOIN accounts a ON h.account_id = a.id
		WHERE a.user_id = $1
		ORDER BY h.created_at
	`

	rows, err := s.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var holdings []Holding
	for rows.Next() {
		var h Holding
		err := rows.Scan(
			&h.ID, &h.AccountID, &h.Type, &h.Symbol, &h.Quantity, &h.CostBasis,
			&h.Currency, &h.Amount, &h.PurchaseDate, &h.Notes,
			&h.CreatedAt, &h.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		holdings = append(holdings, h)
	}

	return json.Marshal(holdings)
}

// exportHoldingTransactions exports all holding transactions for user's holdings
func (s *ExportService) exportHoldingTransactions(ctx context.Context, userID string) ([]byte, error) {
	query := `
		SELECT ht.id, ht.holding_id, ht.type, ht.quantity, ht.price, ht.total_amount,
		       ht.transaction_date, ht.notes, ht.created_at
		FROM holding_transactions ht
		JOIN holdings h ON ht.holding_id = h.id
		JOIN accounts a ON h.account_id = a.id
		WHERE a.user_id = $1
		ORDER BY ht.transaction_date, ht.created_at
	`

	rows, err := s.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var transactions []HoldingTransaction
	for rows.Next() {
		var tx HoldingTransaction
		err := rows.Scan(
			&tx.ID, &tx.HoldingID, &tx.Type, &tx.Quantity, &tx.Price, &tx.TotalAmount,
			&tx.TransactionDate, &tx.Notes, &tx.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		transactions = append(transactions, tx)
	}

	return json.Marshal(transactions)
}

// exportMortgageDetails exports all mortgage details for user's accounts
func (s *ExportService) exportMortgageDetails(ctx context.Context, userID string) ([]byte, error) {
	query := `
		SELECT md.id, md.account_id, md.principal_amount, md.interest_rate,
		       md.payment_frequency, md.amortization_years, md.start_date,
		       md.first_payment_date, md.property_value, md.down_payment_percentage,
		       md.created_at, md.updated_at
		FROM mortgage_details md
		JOIN accounts a ON md.account_id = a.id
		WHERE a.user_id = $1
		ORDER BY md.created_at
	`

	rows, err := s.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var details []MortgageDetails
	for rows.Next() {
		var md MortgageDetails
		err := rows.Scan(
			&md.ID, &md.AccountID, &md.PrincipalAmount, &md.InterestRate,
			&md.PaymentFrequency, &md.AmortizationYears, &md.StartDate,
			&md.FirstPaymentDate, &md.PropertyValue, &md.DownPaymentPercentage,
			&md.CreatedAt, &md.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		details = append(details, md)
	}

	return json.Marshal(details)
}

// exportMortgagePayments exports all mortgage payments for user's accounts
func (s *ExportService) exportMortgagePayments(ctx context.Context, userID string) ([]byte, error) {
	query := `
		SELECT mp.id, mp.account_id, mp.payment_date, mp.amount,
		       mp.principal_paid, mp.interest_paid, mp.remaining_balance,
		       mp.notes, mp.created_at
		FROM mortgage_payments mp
		JOIN accounts a ON mp.account_id = a.id
		WHERE a.user_id = $1
		ORDER BY mp.payment_date, mp.created_at
	`

	rows, err := s.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var payments []MortgagePayment
	for rows.Next() {
		var mp MortgagePayment
		err := rows.Scan(
			&mp.ID, &mp.AccountID, &mp.PaymentDate, &mp.Amount,
			&mp.PrincipalPaid, &mp.InterestPaid, &mp.RemainingBalance,
			&mp.Notes, &mp.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		payments = append(payments, mp)
	}

	return json.Marshal(payments)
}

// exportLoanDetails exports all loan details for user's accounts
func (s *ExportService) exportLoanDetails(ctx context.Context, userID string) ([]byte, error) {
	query := `
		SELECT ld.id, ld.account_id, ld.principal_amount, ld.interest_rate,
		       ld.payment_frequency, ld.term_years, ld.start_date,
		       ld.first_payment_date, ld.loan_type, ld.lender,
		       ld.created_at, ld.updated_at
		FROM loan_details ld
		JOIN accounts a ON ld.account_id = a.id
		WHERE a.user_id = $1
		ORDER BY ld.created_at
	`

	rows, err := s.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var details []LoanDetails
	for rows.Next() {
		var ld LoanDetails
		err := rows.Scan(
			&ld.ID, &ld.AccountID, &ld.PrincipalAmount, &ld.InterestRate,
			&ld.PaymentFrequency, &ld.TermYears, &ld.StartDate,
			&ld.FirstPaymentDate, &ld.LoanType, &ld.Lender,
			&ld.CreatedAt, &ld.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		details = append(details, ld)
	}

	return json.Marshal(details)
}

// exportLoanPayments exports all loan payments for user's accounts
func (s *ExportService) exportLoanPayments(ctx context.Context, userID string) ([]byte, error) {
	query := `
		SELECT lp.id, lp.account_id, lp.payment_date, lp.amount,
		       lp.principal_paid, lp.interest_paid, lp.remaining_balance,
		       lp.notes, lp.created_at
		FROM loan_payments lp
		JOIN accounts a ON lp.account_id = a.id
		WHERE a.user_id = $1
		ORDER BY lp.payment_date, lp.created_at
	`

	rows, err := s.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var payments []LoanPayment
	for rows.Next() {
		var lp LoanPayment
		err := rows.Scan(
			&lp.ID, &lp.AccountID, &lp.PaymentDate, &lp.Amount,
			&lp.PrincipalPaid, &lp.InterestPaid, &lp.RemainingBalance,
			&lp.Notes, &lp.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		payments = append(payments, lp)
	}

	return json.Marshal(payments)
}

// exportAssetDetails exports all asset details for user's accounts
func (s *ExportService) exportAssetDetails(ctx context.Context, userID string) ([]byte, error) {
	query := `
		SELECT ad.id, ad.account_id, ad.asset_type, ad.purchase_price,
		       ad.purchase_date, ad.current_value, ad.depreciation_method,
		       ad.useful_life_years, ad.salvage_value, ad.description,
		       ad.last_valuation_date, ad.created_at, ad.updated_at
		FROM asset_details ad
		JOIN accounts a ON ad.account_id = a.id
		WHERE a.user_id = $1
		ORDER BY ad.created_at
	`

	rows, err := s.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var details []AssetDetails
	for rows.Next() {
		var ad AssetDetails
		err := rows.Scan(
			&ad.ID, &ad.AccountID, &ad.AssetType, &ad.PurchasePrice,
			&ad.PurchaseDate, &ad.CurrentValue, &ad.DepreciationMethod,
			&ad.UsefulLifeYears, &ad.SalvageValue, &ad.Description,
			&ad.LastValuationDate, &ad.CreatedAt, &ad.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		details = append(details, ad)
	}

	return json.Marshal(details)
}

// exportAssetDepreciation exports all asset depreciation entries for user's accounts
func (s *ExportService) exportAssetDepreciation(ctx context.Context, userID string) ([]byte, error) {
	query := `
		SELECT ade.id, ade.account_id, ade.entry_date, ade.depreciation_amount,
		       ade.book_value, ade.method, ade.notes, ade.created_at
		FROM asset_depreciation_entries ade
		JOIN accounts a ON ade.account_id = a.id
		WHERE a.user_id = $1
		ORDER BY ade.entry_date, ade.created_at
	`

	rows, err := s.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []AssetDepreciationEntry
	for rows.Next() {
		var ade AssetDepreciationEntry
		err := rows.Scan(
			&ade.ID, &ade.AccountID, &ade.EntryDate, &ade.DepreciationAmount,
			&ade.BookValue, &ade.Method, &ade.Notes, &ade.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		entries = append(entries, ade)
	}

	return json.Marshal(entries)
}

// exportRecurringExpenses exports all recurring expenses for a user
func (s *ExportService) exportRecurringExpenses(ctx context.Context, userID string) ([]byte, error) {
	query := `
		SELECT id, user_id, name, amount, currency, frequency,
		       category, description, is_active, created_at, updated_at
		FROM recurring_expenses
		WHERE user_id = $1
		ORDER BY created_at
	`

	rows, err := s.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var expenses []RecurringExpense
	for rows.Next() {
		var re RecurringExpense
		err := rows.Scan(
			&re.ID, &re.UserID, &re.Name, &re.Amount, &re.Currency,
			&re.Frequency, &re.Category, &re.Description, &re.IsActive,
			&re.CreatedAt, &re.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		expenses = append(expenses, re)
	}

	return json.Marshal(expenses)
}

// exportProjections exports all projection scenarios for a user
func (s *ExportService) exportProjections(ctx context.Context, userID string) ([]byte, error) {
	query := `
		SELECT id, user_id, name, description, config, created_at, updated_at
		FROM projection_scenarios
		WHERE user_id = $1
		ORDER BY created_at
	`

	rows, err := s.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var scenarios []ProjectionScenario
	for rows.Next() {
		var ps ProjectionScenario
		err := rows.Scan(
			&ps.ID, &ps.UserID, &ps.Name, &ps.Description,
			&ps.Config, &ps.CreatedAt, &ps.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		scenarios = append(scenarios, ps)
	}

	return json.Marshal(scenarios)
}

// exportExchangeRates exports all exchange rates (not user-specific)
func (s *ExportService) exportExchangeRates(ctx context.Context) ([]byte, error) {
	query := `
		SELECT id, from_currency, to_currency, rate, date, created_at
		FROM exchange_rates
		ORDER BY date DESC, created_at
	`

	rows, err := s.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rates []ExchangeRate
	for rows.Next() {
		var er ExchangeRate
		err := rows.Scan(
			&er.ID, &er.FromCurrency, &er.ToCurrency,
			&er.Rate, &er.Date, &er.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		rates = append(rates, er)
	}

	return json.Marshal(rates)
}

// createManifest creates the export manifest with metadata
func (s *ExportService) createManifest(userID string, tables map[string][]byte) ExportManifest {
	tableMetadata := make(map[string]TableMetadata)

	for tableName, data := range tables {
		// Count records in JSON array
		var records []interface{}
		json.Unmarshal(data, &records)

		// Calculate checksum
		hash := sha256.Sum256(data)
		checksum := hex.EncodeToString(hash[:])

		tableMetadata[tableName] = TableMetadata{
			Count:    len(records),
			Checksum: checksum,
		}
	}

	return ExportManifest{
		Version:    ExportVersion,
		AppVersion: AppVersion,
		ExportedAt: time.Now(),
		UserID:     userID,
		Tables:     tableMetadata,
	}
}

// createZipArchive creates a ZIP archive with all data files
func (s *ExportService) createZipArchive(manifest []byte, tables map[string][]byte) ([]byte, error) {
	buf := new(bytes.Buffer)
	zipWriter := zip.NewWriter(buf)

	// Add manifest.json
	manifestFile, err := zipWriter.Create("manifest.json")
	if err != nil {
		return nil, fmt.Errorf("failed to create manifest file: %w", err)
	}
	if _, err := manifestFile.Write(manifest); err != nil {
		return nil, fmt.Errorf("failed to write manifest: %w", err)
	}

	// Add each table's JSON file
	for tableName, data := range tables {
		fileName := fmt.Sprintf("%s.json", tableName)
		file, err := zipWriter.Create(fileName)
		if err != nil {
			return nil, fmt.Errorf("failed to create file %s: %w", fileName, err)
		}
		if _, err := file.Write(data); err != nil {
			return nil, fmt.Errorf("failed to write file %s: %w", fileName, err)
		}
	}

	if err := zipWriter.Close(); err != nil {
		return nil, fmt.Errorf("failed to close zip writer: %w", err)
	}

	return buf.Bytes(), nil
}
