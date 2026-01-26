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
	"io"
)

// ImportService handles data import operations
type ImportService struct {
	db *sql.DB
}

// NewImportService creates a new import service
func NewImportService(db *sql.DB) *ImportService {
	return &ImportService{db: db}
}

// ValidateArchive validates ZIP structure and data integrity
func (s *ImportService) ValidateArchive(archive []byte) (*ValidationResult, error) {
	result := &ValidationResult{
		Valid:    true,
		Errors:   []string{},
		Warnings: []string{},
	}

	// Open ZIP archive
	reader, err := zip.NewReader(bytes.NewReader(archive), int64(len(archive)))
	if err != nil {
		result.Valid = false
		result.Errors = append(result.Errors, "Invalid ZIP archive")
		return result, nil
	}

	// Check for manifest.json
	manifestFile := findFile(reader, "manifest.json")
	if manifestFile == nil {
		result.Valid = false
		result.Errors = append(result.Errors, "Missing manifest.json")
		return result, nil
	}

	// Read and parse manifest
	manifestData, err := readZipFile(manifestFile)
	if err != nil {
		result.Valid = false
		result.Errors = append(result.Errors, "Failed to read manifest.json")
		return result, nil
	}

	var manifest ExportManifest
	if err := json.Unmarshal(manifestData, &manifest); err != nil {
		result.Valid = false
		result.Errors = append(result.Errors, "Invalid manifest.json format")
		return result, nil
	}

	result.Manifest = &manifest

	// Validate version compatibility
	if manifest.Version != ExportVersion {
		result.Warnings = append(result.Warnings,
			fmt.Sprintf("Export version mismatch: expected %s, got %s", ExportVersion, manifest.Version))
	}

	// Validate each table file
	expectedTables := []string{
		"accounts", "balances", "holdings", "holding_transactions",
		"mortgage_details", "mortgage_payments", "loan_details", "loan_payments",
		"asset_details", "asset_depreciation_entries", "recurring_expenses",
		"projection_scenarios", "exchange_rates",
	}

	for _, tableName := range expectedTables {
		fileName := fmt.Sprintf("%s.json", tableName)
		file := findFile(reader, fileName)
		if file == nil {
			result.Valid = false
			result.Errors = append(result.Errors, fmt.Sprintf("Missing file: %s", fileName))
			continue
		}

		// Read and validate JSON
		data, err := readZipFile(file)
		if err != nil {
			result.Valid = false
			result.Errors = append(result.Errors, fmt.Sprintf("Failed to read %s", fileName))
			continue
		}

		// Validate JSON format
		var records []interface{}
		if err := json.Unmarshal(data, &records); err != nil {
			result.Valid = false
			result.Errors = append(result.Errors, fmt.Sprintf("Invalid JSON in %s", fileName))
			continue
		}

		// Verify checksum if in manifest
		if metadata, ok := manifest.Tables[tableName]; ok {
			hash := sha256.Sum256(data)
			checksum := hex.EncodeToString(hash[:])
			if checksum != metadata.Checksum {
				result.Warnings = append(result.Warnings,
					fmt.Sprintf("Checksum mismatch for %s", tableName))
			}

			// Verify record count
			if len(records) != metadata.Count {
				result.Warnings = append(result.Warnings,
					fmt.Sprintf("Record count mismatch for %s: expected %d, got %d",
						tableName, metadata.Count, len(records)))
			}
		}
	}

	return result, nil
}

// ImportData imports data from archive with specified options
func (s *ImportService) ImportData(ctx context.Context, userID string, archive []byte, opts ImportOptions) (*ImportResult, error) {
	// Validate archive first
	validation, err := s.ValidateArchive(archive)
	if err != nil {
		return nil, fmt.Errorf("validation failed: %w", err)
	}

	if !validation.Valid {
		return &ImportResult{
			Success: false,
			Errors: []ImportError{
				{Message: fmt.Sprintf("Validation failed: %v", validation.Errors)},
			},
		}, nil
	}

	// If validate only mode, return early
	if opts.ValidateOnly {
		return &ImportResult{
			Success:  true,
			Warnings: validation.Warnings,
		}, nil
	}

	// Extract all data from archive
	data, err := s.extractArchiveData(archive)
	if err != nil {
		return nil, fmt.Errorf("failed to extract archive data: %w", err)
	}

	// Perform import in transaction
	result, err := s.importInTransaction(ctx, userID, data, opts)
	if err != nil {
		return nil, fmt.Errorf("import failed: %w", err)
	}

	result.Warnings = validation.Warnings
	return result, nil
}

// extractArchiveData extracts all data from the ZIP archive
func (s *ImportService) extractArchiveData(archive []byte) (map[string][]byte, error) {
	reader, err := zip.NewReader(bytes.NewReader(archive), int64(len(archive)))
	if err != nil {
		return nil, err
	}

	data := make(map[string][]byte)
	tables := []string{
		"accounts", "balances", "holdings", "holding_transactions",
		"mortgage_details", "mortgage_payments", "loan_details", "loan_payments",
		"asset_details", "asset_depreciation_entries", "recurring_expenses",
		"projection_scenarios", "exchange_rates", "connections", "synced_accounts",
	}

	for _, tableName := range tables {
		fileName := fmt.Sprintf("%s.json", tableName)
		file := findFile(reader, fileName)
		if file != nil {
			fileData, err := readZipFile(file)
			if err != nil {
				return nil, fmt.Errorf("failed to read %s: %w", fileName, err)
			}
			data[tableName] = fileData
		}
	}

	return data, nil
}

// importInTransaction executes import in a database transaction
func (s *ImportService) importInTransaction(ctx context.Context, userID string, data map[string][]byte, opts ImportOptions) (*ImportResult, error) {
	result := &ImportResult{
		Success: true,
		Summary: make(map[string]ImportTableSummary),
		Errors:  []ImportError{},
	}

	// Start transaction
	tx, err := s.db.BeginTx(ctx, &sql.TxOptions{
		Isolation: sql.LevelSerializable,
	})
	if err != nil {
		return nil, err
	}

	defer func() {
		if result.Success {
			tx.Commit()
		} else {
			tx.Rollback()
		}
	}()

	// Import tables in dependency order
	tables := []struct {
		name       string
		importFunc func(context.Context, *sql.Tx, string, []byte, string) (ImportTableSummary, error)
	}{
		{"connections", s.importConnections},        // First: no dependencies
		{"accounts", s.importAccounts},              // Second: may reference synced_accounts
		{"synced_accounts", s.importSyncedAccounts}, // Third: needs connections and accounts
		{"balances", s.importBalances},
		{"holdings", s.importHoldings},
		{"holding_transactions", s.importHoldingTransactions},
		{"mortgage_details", s.importMortgageDetails},
		{"mortgage_payments", s.importMortgagePayments},
		{"loan_details", s.importLoanDetails},
		{"loan_payments", s.importLoanPayments},
		{"asset_details", s.importAssetDetails},
		{"asset_depreciation_entries", s.importAssetDepreciation},
		{"recurring_expenses", s.importRecurringExpenses},
		{"projection_scenarios", s.importProjections},
		{"exchange_rates", s.importExchangeRates},
	}

	for _, table := range tables {
		if tableData, ok := data[table.name]; ok {
			summary, err := table.importFunc(ctx, tx, userID, tableData, opts.Mode)
			if err != nil {
				result.Success = false
				result.Errors = append(result.Errors, ImportError{
					Table:   table.name,
					Message: err.Error(),
				})
				return result, nil
			}
			result.Summary[table.name] = summary
		}
	}

	return result, nil
}

// importAccounts imports account records
func (s *ImportService) importAccounts(ctx context.Context, tx *sql.Tx, userID string, data []byte, mode string) (ImportTableSummary, error) {
	var accounts []Account
	if err := json.Unmarshal(data, &accounts); err != nil {
		return ImportTableSummary{}, err
	}

	summary := ImportTableSummary{}

	for _, acc := range accounts {
		// Override user_id with current user
		acc.UserID = userID

		query := `
			INSERT INTO accounts (id, user_id, name, type, currency, institution, is_asset, is_active, synced_account_id, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
			ON CONFLICT (id) DO UPDATE SET
				name = EXCLUDED.name,
				type = EXCLUDED.type,
				currency = EXCLUDED.currency,
				institution = EXCLUDED.institution,
				is_asset = EXCLUDED.is_asset,
				is_active = EXCLUDED.is_active,
				updated_at = EXCLUDED.updated_at
		`

		result, err := tx.ExecContext(ctx, query,
			acc.ID, acc.UserID, acc.Name, acc.Type, acc.Currency,
			acc.Institution, acc.IsAsset, acc.IsActive, acc.SyncedAccountID,
			acc.CreatedAt, acc.UpdatedAt,
		)
		if err != nil {
			summary.Errors++
			continue
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 1 {
			summary.Created++
		} else {
			summary.Updated++
		}
	}

	return summary, nil
}

// importBalances imports balance records
func (s *ImportService) importBalances(ctx context.Context, tx *sql.Tx, userID string, data []byte, mode string) (ImportTableSummary, error) {
	var balances []Balance
	if err := json.Unmarshal(data, &balances); err != nil {
		return ImportTableSummary{}, err
	}

	summary := ImportTableSummary{}

	for _, bal := range balances {
		query := `
			INSERT INTO balances (id, account_id, amount, date, notes, created_at)
			VALUES ($1, $2, $3, $4, $5, $6)
			ON CONFLICT (id) DO UPDATE SET
				amount = EXCLUDED.amount,
				date = EXCLUDED.date,
				notes = EXCLUDED.notes
		`

		result, err := tx.ExecContext(ctx, query,
			bal.ID, bal.AccountID, bal.Amount, bal.Date, bal.Notes, bal.CreatedAt,
		)
		if err != nil {
			summary.Errors++
			continue
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 1 {
			summary.Created++
		} else {
			summary.Updated++
		}
	}

	return summary, nil
}

// importHoldings imports holding records
func (s *ImportService) importHoldings(ctx context.Context, tx *sql.Tx, userID string, data []byte, mode string) (ImportTableSummary, error) {
	var holdings []Holding
	if err := json.Unmarshal(data, &holdings); err != nil {
		return ImportTableSummary{}, err
	}

	summary := ImportTableSummary{}

	for _, h := range holdings {
		query := `
			INSERT INTO holdings (id, account_id, type, symbol, quantity, cost_basis, currency, amount, purchase_date, notes, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
			ON CONFLICT (id) DO UPDATE SET
				type = EXCLUDED.type,
				symbol = EXCLUDED.symbol,
				quantity = EXCLUDED.quantity,
				cost_basis = EXCLUDED.cost_basis,
				currency = EXCLUDED.currency,
				amount = EXCLUDED.amount,
				purchase_date = EXCLUDED.purchase_date,
				notes = EXCLUDED.notes,
				updated_at = EXCLUDED.updated_at
		`

		result, err := tx.ExecContext(ctx, query,
			h.ID, h.AccountID, h.Type, h.Symbol, h.Quantity, h.CostBasis,
			h.Currency, h.Amount, h.PurchaseDate, h.Notes,
			h.CreatedAt, h.UpdatedAt,
		)
		if err != nil {
			summary.Errors++
			continue
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 1 {
			summary.Created++
		} else {
			summary.Updated++
		}
	}

	return summary, nil
}

// importHoldingTransactions imports holding transaction records
func (s *ImportService) importHoldingTransactions(ctx context.Context, tx *sql.Tx, userID string, data []byte, mode string) (ImportTableSummary, error) {
	var transactions []HoldingTransaction
	if err := json.Unmarshal(data, &transactions); err != nil {
		return ImportTableSummary{}, err
	}

	summary := ImportTableSummary{}

	for _, ht := range transactions {
		query := `
			INSERT INTO holding_transactions (id, holding_id, type, quantity, price, total_amount, transaction_date, notes, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
			ON CONFLICT (id) DO UPDATE SET
				type = EXCLUDED.type,
				quantity = EXCLUDED.quantity,
				price = EXCLUDED.price,
				total_amount = EXCLUDED.total_amount,
				transaction_date = EXCLUDED.transaction_date,
				notes = EXCLUDED.notes
		`

		result, err := tx.ExecContext(ctx, query,
			ht.ID, ht.HoldingID, ht.Type, ht.Quantity, ht.Price,
			ht.TotalAmount, ht.TransactionDate, ht.Notes, ht.CreatedAt,
		)
		if err != nil {
			summary.Errors++
			continue
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 1 {
			summary.Created++
		} else {
			summary.Updated++
		}
	}

	return summary, nil
}

// importMortgageDetails imports mortgage details records
func (s *ImportService) importMortgageDetails(ctx context.Context, tx *sql.Tx, userID string, data []byte, mode string) (ImportTableSummary, error) {
	var details []MortgageDetails
	if err := json.Unmarshal(data, &details); err != nil {
		return ImportTableSummary{}, err
	}

	summary := ImportTableSummary{}

	for _, md := range details {
		query := `
			INSERT INTO mortgage_details (id, account_id, principal_amount, interest_rate, payment_frequency, amortization_years, start_date, first_payment_date, property_value, down_payment_percentage, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
			ON CONFLICT (id) DO UPDATE SET
				principal_amount = EXCLUDED.principal_amount,
				interest_rate = EXCLUDED.interest_rate,
				payment_frequency = EXCLUDED.payment_frequency,
				amortization_years = EXCLUDED.amortization_years,
				start_date = EXCLUDED.start_date,
				first_payment_date = EXCLUDED.first_payment_date,
				property_value = EXCLUDED.property_value,
				down_payment_percentage = EXCLUDED.down_payment_percentage,
				updated_at = EXCLUDED.updated_at
		`

		result, err := tx.ExecContext(ctx, query,
			md.ID, md.AccountID, md.PrincipalAmount, md.InterestRate,
			md.PaymentFrequency, md.AmortizationYears, md.StartDate,
			md.FirstPaymentDate, md.PropertyValue, md.DownPaymentPercentage,
			md.CreatedAt, md.UpdatedAt,
		)
		if err != nil {
			summary.Errors++
			continue
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 1 {
			summary.Created++
		} else {
			summary.Updated++
		}
	}

	return summary, nil
}

// importMortgagePayments imports mortgage payment records
func (s *ImportService) importMortgagePayments(ctx context.Context, tx *sql.Tx, userID string, data []byte, mode string) (ImportTableSummary, error) {
	var payments []MortgagePayment
	if err := json.Unmarshal(data, &payments); err != nil {
		return ImportTableSummary{}, err
	}

	summary := ImportTableSummary{}

	for _, mp := range payments {
		query := `
			INSERT INTO mortgage_payments (id, account_id, payment_date, amount, principal_paid, interest_paid, remaining_balance, notes, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
			ON CONFLICT (id) DO UPDATE SET
				payment_date = EXCLUDED.payment_date,
				amount = EXCLUDED.amount,
				principal_paid = EXCLUDED.principal_paid,
				interest_paid = EXCLUDED.interest_paid,
				remaining_balance = EXCLUDED.remaining_balance,
				notes = EXCLUDED.notes
		`

		result, err := tx.ExecContext(ctx, query,
			mp.ID, mp.AccountID, mp.PaymentDate, mp.Amount,
			mp.PrincipalPaid, mp.InterestPaid, mp.RemainingBalance,
			mp.Notes, mp.CreatedAt,
		)
		if err != nil {
			summary.Errors++
			continue
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 1 {
			summary.Created++
		} else {
			summary.Updated++
		}
	}

	return summary, nil
}

// importLoanDetails imports loan details records
func (s *ImportService) importLoanDetails(ctx context.Context, tx *sql.Tx, userID string, data []byte, mode string) (ImportTableSummary, error) {
	var details []LoanDetails
	if err := json.Unmarshal(data, &details); err != nil {
		return ImportTableSummary{}, err
	}

	summary := ImportTableSummary{}

	for _, ld := range details {
		query := `
			INSERT INTO loan_details (id, account_id, principal_amount, interest_rate, payment_frequency, term_years, start_date, first_payment_date, loan_type, lender, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
			ON CONFLICT (id) DO UPDATE SET
				principal_amount = EXCLUDED.principal_amount,
				interest_rate = EXCLUDED.interest_rate,
				payment_frequency = EXCLUDED.payment_frequency,
				term_years = EXCLUDED.term_years,
				start_date = EXCLUDED.start_date,
				first_payment_date = EXCLUDED.first_payment_date,
				loan_type = EXCLUDED.loan_type,
				lender = EXCLUDED.lender,
				updated_at = EXCLUDED.updated_at
		`

		result, err := tx.ExecContext(ctx, query,
			ld.ID, ld.AccountID, ld.PrincipalAmount, ld.InterestRate,
			ld.PaymentFrequency, ld.TermYears, ld.StartDate,
			ld.FirstPaymentDate, ld.LoanType, ld.Lender,
			ld.CreatedAt, ld.UpdatedAt,
		)
		if err != nil {
			summary.Errors++
			continue
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 1 {
			summary.Created++
		} else {
			summary.Updated++
		}
	}

	return summary, nil
}

// importLoanPayments imports loan payment records
func (s *ImportService) importLoanPayments(ctx context.Context, tx *sql.Tx, userID string, data []byte, mode string) (ImportTableSummary, error) {
	var payments []LoanPayment
	if err := json.Unmarshal(data, &payments); err != nil {
		return ImportTableSummary{}, err
	}

	summary := ImportTableSummary{}

	for _, lp := range payments {
		query := `
			INSERT INTO loan_payments (id, account_id, payment_date, amount, principal_paid, interest_paid, remaining_balance, notes, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
			ON CONFLICT (id) DO UPDATE SET
				payment_date = EXCLUDED.payment_date,
				amount = EXCLUDED.amount,
				principal_paid = EXCLUDED.principal_paid,
				interest_paid = EXCLUDED.interest_paid,
				remaining_balance = EXCLUDED.remaining_balance,
				notes = EXCLUDED.notes
		`

		result, err := tx.ExecContext(ctx, query,
			lp.ID, lp.AccountID, lp.PaymentDate, lp.Amount,
			lp.PrincipalPaid, lp.InterestPaid, lp.RemainingBalance,
			lp.Notes, lp.CreatedAt,
		)
		if err != nil {
			summary.Errors++
			continue
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 1 {
			summary.Created++
		} else {
			summary.Updated++
		}
	}

	return summary, nil
}

// importAssetDetails imports asset details records
func (s *ImportService) importAssetDetails(ctx context.Context, tx *sql.Tx, userID string, data []byte, mode string) (ImportTableSummary, error) {
	var details []AssetDetails
	if err := json.Unmarshal(data, &details); err != nil {
		return ImportTableSummary{}, err
	}

	summary := ImportTableSummary{}

	for _, ad := range details {
		query := `
			INSERT INTO asset_details (id, account_id, asset_type, purchase_price, purchase_date, current_value, depreciation_method, useful_life_years, salvage_value, description, last_valuation_date, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
			ON CONFLICT (id) DO UPDATE SET
				asset_type = EXCLUDED.asset_type,
				purchase_price = EXCLUDED.purchase_price,
				purchase_date = EXCLUDED.purchase_date,
				current_value = EXCLUDED.current_value,
				depreciation_method = EXCLUDED.depreciation_method,
				useful_life_years = EXCLUDED.useful_life_years,
				salvage_value = EXCLUDED.salvage_value,
				description = EXCLUDED.description,
				last_valuation_date = EXCLUDED.last_valuation_date,
				updated_at = EXCLUDED.updated_at
		`

		result, err := tx.ExecContext(ctx, query,
			ad.ID, ad.AccountID, ad.AssetType, ad.PurchasePrice,
			ad.PurchaseDate, ad.CurrentValue, ad.DepreciationMethod,
			ad.UsefulLifeYears, ad.SalvageValue, ad.Description,
			ad.LastValuationDate, ad.CreatedAt, ad.UpdatedAt,
		)
		if err != nil {
			summary.Errors++
			continue
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 1 {
			summary.Created++
		} else {
			summary.Updated++
		}
	}

	return summary, nil
}

// importAssetDepreciation imports asset depreciation entry records
func (s *ImportService) importAssetDepreciation(ctx context.Context, tx *sql.Tx, userID string, data []byte, mode string) (ImportTableSummary, error) {
	var entries []AssetDepreciationEntry
	if err := json.Unmarshal(data, &entries); err != nil {
		return ImportTableSummary{}, err
	}

	summary := ImportTableSummary{}

	for _, ade := range entries {
		query := `
			INSERT INTO asset_depreciation_entries (id, account_id, entry_date, depreciation_amount, book_value, method, notes, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			ON CONFLICT (id) DO UPDATE SET
				entry_date = EXCLUDED.entry_date,
				depreciation_amount = EXCLUDED.depreciation_amount,
				book_value = EXCLUDED.book_value,
				method = EXCLUDED.method,
				notes = EXCLUDED.notes
		`

		result, err := tx.ExecContext(ctx, query,
			ade.ID, ade.AccountID, ade.EntryDate, ade.DepreciationAmount,
			ade.BookValue, ade.Method, ade.Notes, ade.CreatedAt,
		)
		if err != nil {
			summary.Errors++
			continue
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 1 {
			summary.Created++
		} else {
			summary.Updated++
		}
	}

	return summary, nil
}

// importRecurringExpenses imports recurring expense records
func (s *ImportService) importRecurringExpenses(ctx context.Context, tx *sql.Tx, userID string, data []byte, mode string) (ImportTableSummary, error) {
	var expenses []RecurringExpense
	if err := json.Unmarshal(data, &expenses); err != nil {
		return ImportTableSummary{}, err
	}

	summary := ImportTableSummary{}

	for _, re := range expenses {
		// Override user_id with current user
		re.UserID = userID

		query := `
			INSERT INTO recurring_expenses (id, user_id, name, amount, currency, frequency, category, description, is_active, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
			ON CONFLICT (id) DO UPDATE SET
				name = EXCLUDED.name,
				amount = EXCLUDED.amount,
				currency = EXCLUDED.currency,
				frequency = EXCLUDED.frequency,
				category = EXCLUDED.category,
				description = EXCLUDED.description,
				is_active = EXCLUDED.is_active,
				updated_at = EXCLUDED.updated_at
		`

		result, err := tx.ExecContext(ctx, query,
			re.ID, re.UserID, re.Name, re.Amount, re.Currency,
			re.Frequency, re.Category, re.Description, re.IsActive,
			re.CreatedAt, re.UpdatedAt,
		)
		if err != nil {
			summary.Errors++
			continue
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 1 {
			summary.Created++
		} else {
			summary.Updated++
		}
	}

	return summary, nil
}

// importProjections imports projection scenario records
func (s *ImportService) importProjections(ctx context.Context, tx *sql.Tx, userID string, data []byte, mode string) (ImportTableSummary, error) {
	var scenarios []ProjectionScenario
	if err := json.Unmarshal(data, &scenarios); err != nil {
		return ImportTableSummary{}, err
	}

	summary := ImportTableSummary{}

	for _, ps := range scenarios {
		// Override user_id with current user
		ps.UserID = userID

		query := `
			INSERT INTO projection_scenarios (id, user_id, name, description, config, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
			ON CONFLICT (id) DO UPDATE SET
				name = EXCLUDED.name,
				description = EXCLUDED.description,
				config = EXCLUDED.config,
				updated_at = EXCLUDED.updated_at
		`

		result, err := tx.ExecContext(ctx, query,
			ps.ID, ps.UserID, ps.Name, ps.Description,
			ps.Config, ps.CreatedAt, ps.UpdatedAt,
		)
		if err != nil {
			summary.Errors++
			continue
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 1 {
			summary.Created++
		} else {
			summary.Updated++
		}
	}

	return summary, nil
}

// importExchangeRates imports exchange rate records
func (s *ImportService) importExchangeRates(ctx context.Context, tx *sql.Tx, userID string, data []byte, mode string) (ImportTableSummary, error) {
	var rates []ExchangeRate
	if err := json.Unmarshal(data, &rates); err != nil {
		return ImportTableSummary{}, err
	}

	summary := ImportTableSummary{}

	for _, er := range rates {
		query := `
			INSERT INTO exchange_rates (id, from_currency, to_currency, rate, date, created_at)
			VALUES ($1, $2, $3, $4, $5, $6)
			ON CONFLICT (id) DO UPDATE SET
				rate = EXCLUDED.rate,
				date = EXCLUDED.date
		`

		result, err := tx.ExecContext(ctx, query,
			er.ID, er.FromCurrency, er.ToCurrency,
			er.Rate, er.Date, er.CreatedAt,
		)
		if err != nil {
			summary.Errors++
			continue
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 1 {
			summary.Created++
		} else {
			summary.Updated++
		}
	}

	return summary, nil
}

// Helper functions

func findFile(reader *zip.Reader, name string) *zip.File {
	for _, file := range reader.File {
		if file.Name == name {
			return file
		}
	}
	return nil
}

func readZipFile(file *zip.File) ([]byte, error) {
	rc, err := file.Open()
	if err != nil {
		return nil, err
	}
	defer rc.Close()

	return io.ReadAll(rc)
}

// importConnections imports connection records (forced to 'disconnected' status since no credentials)
func (s *ImportService) importConnections(ctx context.Context, tx *sql.Tx, userID string, data []byte, mode string) (ImportTableSummary, error) {
	var connections []Connection
	if err := json.Unmarshal(data, &connections); err != nil {
		return ImportTableSummary{}, err
	}

	summary := ImportTableSummary{}

	for _, conn := range connections {
		// Override user_id with current user
		conn.UserID = userID

		// Force status to 'disconnected' since we don't have credentials
		// User will need to reconnect to activate
		conn.Status = "disconnected"

		query := `
			INSERT INTO connections (id, user_id, provider, name, status, last_sync_at,
			                         last_sync_error, sync_frequency, account_count, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
			ON CONFLICT (id) DO UPDATE SET
				provider = EXCLUDED.provider,
				name = EXCLUDED.name,
				status = EXCLUDED.status,
				last_sync_at = EXCLUDED.last_sync_at,
				last_sync_error = EXCLUDED.last_sync_error,
				sync_frequency = EXCLUDED.sync_frequency,
				account_count = EXCLUDED.account_count,
				updated_at = EXCLUDED.updated_at
		`

		result, err := tx.ExecContext(ctx, query,
			conn.ID,
			conn.UserID,
			conn.Provider,
			conn.Name,
			conn.Status, // Always 'disconnected' on import
			conn.LastSyncAt,
			conn.LastSyncError,
			conn.SyncFrequency,
			conn.AccountCount,
			conn.CreatedAt,
			conn.UpdatedAt,
		)

		if err != nil {
			summary.Errors++
			continue
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 1 {
			summary.Created++
		} else {
			summary.Updated++
		}
	}

	return summary, nil
}

// importSyncedAccounts imports synced account records (mapping between local and provider accounts)
func (s *ImportService) importSyncedAccounts(ctx context.Context, tx *sql.Tx, userID string, data []byte, mode string) (ImportTableSummary, error) {
	var syncedAccounts []SyncedAccount
	if err := json.Unmarshal(data, &syncedAccounts); err != nil {
		return ImportTableSummary{}, err
	}

	summary := ImportTableSummary{}

	for _, sa := range syncedAccounts {
		// Verify connection exists (should have been imported already)
		var connExists bool
		checkQuery := `SELECT EXISTS(SELECT 1 FROM connections WHERE id = $1 AND user_id = $2)`
		err := tx.QueryRowContext(ctx, checkQuery, sa.ConnectionID, userID).Scan(&connExists)
		if err != nil || !connExists {
			summary.Skipped++
			continue
		}

		// Verify local account exists
		var accountExists bool
		checkAccQuery := `SELECT EXISTS(SELECT 1 FROM accounts WHERE id = $1 AND user_id = $2)`
		err = tx.QueryRowContext(ctx, checkAccQuery, sa.LocalAccountID, userID).Scan(&accountExists)
		if err != nil || !accountExists {
			summary.Skipped++
			continue
		}

		query := `
			INSERT INTO synced_accounts (id, connection_id, local_account_id, provider_account_id,
			                             last_sync_at, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
			ON CONFLICT (id) DO UPDATE SET
				connection_id = EXCLUDED.connection_id,
				local_account_id = EXCLUDED.local_account_id,
				provider_account_id = EXCLUDED.provider_account_id,
				last_sync_at = EXCLUDED.last_sync_at,
				updated_at = EXCLUDED.updated_at
		`

		result, err := tx.ExecContext(ctx, query,
			sa.ID,
			sa.ConnectionID,
			sa.LocalAccountID,
			sa.ProviderAccountID,
			sa.LastSyncAt,
			sa.CreatedAt,
			sa.UpdatedAt,
		)

		if err != nil {
			summary.Errors++
			continue
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 1 {
			summary.Created++
		} else {
			summary.Updated++
		}
	}

	return summary, nil
}
