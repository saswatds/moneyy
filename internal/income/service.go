package income

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"math"
	"time"

	"github.com/google/uuid"
	"money/internal/auth"
)

// Service provides income management functionality
type Service struct {
	db *sql.DB
}

// NewService creates a new income service
func NewService(db *sql.DB) *Service {
	return &Service{db: db}
}

// Default Canadian federal tax brackets for 2024
var defaultFederalBrackets = []TaxBracket{
	{UpToIncome: 55867, Rate: 0.15},
	{UpToIncome: 111733, Rate: 0.205},
	{UpToIncome: 173205, Rate: 0.26},
	{UpToIncome: 246752, Rate: 0.29},
	{UpToIncome: 0, Rate: 0.33}, // 0 means unlimited
}

// Default Ontario provincial tax brackets for 2024
var defaultProvincialBrackets = []TaxBracket{
	{UpToIncome: 51446, Rate: 0.0505},
	{UpToIncome: 102894, Rate: 0.0915},
	{UpToIncome: 150000, Rate: 0.1116},
	{UpToIncome: 220000, Rate: 0.1216},
	{UpToIncome: 0, Rate: 0.1316}, // 0 means unlimited
}

// CreateIncomeRecord creates a new income record
func (s *Service) CreateIncomeRecord(ctx context.Context, req *CreateIncomeRecordRequest) (*IncomeRecord, error) {
	userID := auth.GetUserID(ctx)
	if userID == "" {
		return nil, fmt.Errorf("user not authenticated")
	}

	// Validate category
	if req.Category != CategoryEmployment && req.Category != CategoryInvestment &&
		req.Category != CategoryRental && req.Category != CategoryBusiness &&
		req.Category != CategoryOther {
		return nil, fmt.Errorf("invalid category: %s", req.Category)
	}

	// Validate frequency
	if req.Frequency != FrequencyOneTime && req.Frequency != FrequencyMonthly &&
		req.Frequency != FrequencyBiWeekly && req.Frequency != FrequencyAnnually {
		return nil, fmt.Errorf("invalid frequency: %s", req.Frequency)
	}

	// Validate currency
	if req.Currency != CurrencyCAD && req.Currency != CurrencyUSD && req.Currency != CurrencyINR {
		return nil, fmt.Errorf("invalid currency: %s", req.Currency)
	}

	isTaxable := true
	if req.IsTaxable != nil {
		isTaxable = *req.IsTaxable
	}

	id := uuid.New().String()
	now := time.Now()

	_, err := s.db.ExecContext(ctx, `
		INSERT INTO income_records (id, user_id, source, category, amount, currency, frequency, tax_year, date_received, description, is_taxable, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
	`, id, userID, req.Source, req.Category, req.Amount, req.Currency, req.Frequency, req.TaxYear, req.DateReceived, req.Description, isTaxable, now, now)

	if err != nil {
		return nil, fmt.Errorf("failed to create income record: %w", err)
	}

	return &IncomeRecord{
		ID:           id,
		UserID:       userID,
		Source:       req.Source,
		Category:     req.Category,
		Amount:       req.Amount,
		Currency:     req.Currency,
		Frequency:    req.Frequency,
		TaxYear:      req.TaxYear,
		DateReceived: req.DateReceived,
		Description:  req.Description,
		IsTaxable:    isTaxable,
		CreatedAt:    now,
		UpdatedAt:    now,
	}, nil
}

// GetIncomeRecord retrieves a single income record
func (s *Service) GetIncomeRecord(ctx context.Context, id string) (*IncomeRecord, error) {
	userID := auth.GetUserID(ctx)
	if userID == "" {
		return nil, fmt.Errorf("user not authenticated")
	}

	record := &IncomeRecord{}
	err := s.db.QueryRowContext(ctx, `
		SELECT id, user_id, source, category, amount, currency, frequency, tax_year, date_received, description, is_taxable, created_at, updated_at
		FROM income_records
		WHERE id = $1 AND user_id = $2
	`, id, userID).Scan(&record.ID, &record.UserID, &record.Source, &record.Category, &record.Amount, &record.Currency,
		&record.Frequency, &record.TaxYear, &record.DateReceived, &record.Description, &record.IsTaxable,
		&record.CreatedAt, &record.UpdatedAt)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("income record not found")
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get income record: %w", err)
	}

	return record, nil
}

// ListIncomeRecords lists all income records with optional filters
func (s *Service) ListIncomeRecords(ctx context.Context, req *ListIncomeRecordsRequest) (*ListIncomeRecordsResponse, error) {
	userID := auth.GetUserID(ctx)
	if userID == "" {
		return nil, fmt.Errorf("user not authenticated")
	}

	query := `
		SELECT id, user_id, source, category, amount, currency, frequency, tax_year, date_received, description, is_taxable, created_at, updated_at
		FROM income_records
		WHERE user_id = $1
	`
	args := []any{userID}
	argCount := 2

	if req != nil && req.Year != nil {
		query += fmt.Sprintf(" AND tax_year = $%d", argCount)
		args = append(args, *req.Year)
		argCount++
	}

	if req != nil && req.Category != nil {
		query += fmt.Sprintf(" AND category = $%d", argCount)
		args = append(args, *req.Category)
		argCount++
	}

	query += " ORDER BY tax_year DESC, created_at DESC"

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to list income records: %w", err)
	}
	defer rows.Close()

	records := make([]IncomeRecord, 0)
	for rows.Next() {
		var record IncomeRecord
		err := rows.Scan(&record.ID, &record.UserID, &record.Source, &record.Category, &record.Amount, &record.Currency,
			&record.Frequency, &record.TaxYear, &record.DateReceived, &record.Description, &record.IsTaxable,
			&record.CreatedAt, &record.UpdatedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan income record: %w", err)
		}
		records = append(records, record)
	}

	return &ListIncomeRecordsResponse{Records: records}, nil
}

// UpdateIncomeRecord updates an existing income record
func (s *Service) UpdateIncomeRecord(ctx context.Context, id string, req *UpdateIncomeRecordRequest) (*IncomeRecord, error) {
	userID := auth.GetUserID(ctx)
	if userID == "" {
		return nil, fmt.Errorf("user not authenticated")
	}

	// Build update query dynamically
	query := `UPDATE income_records SET updated_at = $1`
	args := []any{time.Now()}
	argCount := 2

	if req.Source != nil {
		query += fmt.Sprintf(", source = $%d", argCount)
		args = append(args, *req.Source)
		argCount++
	}
	if req.Category != nil {
		query += fmt.Sprintf(", category = $%d", argCount)
		args = append(args, *req.Category)
		argCount++
	}
	if req.Amount != nil {
		query += fmt.Sprintf(", amount = $%d", argCount)
		args = append(args, *req.Amount)
		argCount++
	}
	if req.Currency != nil {
		query += fmt.Sprintf(", currency = $%d", argCount)
		args = append(args, *req.Currency)
		argCount++
	}
	if req.Frequency != nil {
		query += fmt.Sprintf(", frequency = $%d", argCount)
		args = append(args, *req.Frequency)
		argCount++
	}
	if req.TaxYear != nil {
		query += fmt.Sprintf(", tax_year = $%d", argCount)
		args = append(args, *req.TaxYear)
		argCount++
	}
	if req.DateReceived != nil {
		query += fmt.Sprintf(", date_received = $%d", argCount)
		args = append(args, *req.DateReceived)
		argCount++
	}
	if req.Description != nil {
		query += fmt.Sprintf(", description = $%d", argCount)
		args = append(args, *req.Description)
		argCount++
	}
	if req.IsTaxable != nil {
		query += fmt.Sprintf(", is_taxable = $%d", argCount)
		args = append(args, *req.IsTaxable)
		argCount++
	}

	query += fmt.Sprintf(` WHERE id = $%d AND user_id = $%d`, argCount, argCount+1)
	args = append(args, id, userID)

	result, err := s.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to update income record: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return nil, fmt.Errorf("failed to check rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return nil, fmt.Errorf("income record not found")
	}

	// Fetch the updated record
	return s.GetIncomeRecord(ctx, id)
}

// DeleteIncomeRecord deletes an income record
func (s *Service) DeleteIncomeRecord(ctx context.Context, id string) (*DeleteResponse, error) {
	userID := auth.GetUserID(ctx)
	if userID == "" {
		return nil, fmt.Errorf("user not authenticated")
	}

	result, err := s.db.ExecContext(ctx, `DELETE FROM income_records WHERE id = $1 AND user_id = $2`, id, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to delete income record: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return nil, fmt.Errorf("failed to check rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return nil, fmt.Errorf("income record not found")
	}

	return &DeleteResponse{Success: true}, nil
}

// GetAnnualSummary calculates or retrieves the annual income summary with tax calculations
func (s *Service) GetAnnualSummary(ctx context.Context, year int) (*AnnualIncomeSummary, error) {
	userID := auth.GetUserID(ctx)
	if userID == "" {
		return nil, fmt.Errorf("user not authenticated")
	}

	// Get income records for the year
	records, err := s.ListIncomeRecords(ctx, &ListIncomeRecordsRequest{Year: &year})
	if err != nil {
		return nil, err
	}

	// Calculate income by category
	var employment, investment, rental, business, other float64
	var totalTaxable float64

	for _, record := range records.Records {
		annualAmount := s.convertToAnnualAmount(record.Amount, record.Frequency)

		switch record.Category {
		case CategoryEmployment:
			employment += annualAmount
		case CategoryInvestment:
			investment += annualAmount
		case CategoryRental:
			rental += annualAmount
		case CategoryBusiness:
			business += annualAmount
		case CategoryOther:
			other += annualAmount
		}

		if record.IsTaxable {
			totalTaxable += annualAmount
		}
	}

	totalGross := employment + investment + rental + business + other

	// Get stock options benefit from equity_exercises table
	stockOptionsBenefit := s.getStockOptionsBenefit(ctx, userID, year)
	totalTaxable += stockOptionsBenefit

	// Get tax configuration
	taxConfig, err := s.GetTaxConfig(ctx, year)
	if err != nil {
		// Use defaults if no config exists
		taxConfig = s.getDefaultTaxConfig(year)
	}

	// Calculate taxes
	taxBreakdown := s.calculateTaxes(totalTaxable, employment, taxConfig)

	netIncome := totalGross + stockOptionsBenefit - taxBreakdown.TotalTax

	summary := &AnnualIncomeSummary{
		UserID:              userID,
		TaxYear:             year,
		TotalGrossIncome:    totalGross,
		TotalTaxableIncome:  totalTaxable,
		EmploymentIncome:    employment,
		InvestmentIncome:    investment,
		RentalIncome:        rental,
		BusinessIncome:      business,
		OtherIncome:         other,
		StockOptionsBenefit: stockOptionsBenefit,
		FederalTax:          taxBreakdown.FederalTax,
		ProvincialTax:       taxBreakdown.ProvincialTax,
		CPPContribution:     taxBreakdown.CPPContribution,
		EIContribution:      taxBreakdown.EIContribution,
		TotalTax:            taxBreakdown.TotalTax,
		NetIncome:           netIncome,
		EffectiveTaxRate:    taxBreakdown.EffectiveTaxRate,
		MarginalTaxRate:     taxBreakdown.MarginalTaxRate,
		ComputedAt:          time.Now(),
	}

	return summary, nil
}

// GetMultiYearComparison returns income comparison across multiple years
func (s *Service) GetMultiYearComparison(ctx context.Context, startYear, endYear int) (*YearComparisonResponse, error) {
	userID := auth.GetUserID(ctx)
	if userID == "" {
		return nil, fmt.Errorf("user not authenticated")
	}

	if startYear > endYear {
		startYear, endYear = endYear, startYear
	}

	years := make([]YearSummary, 0)

	for year := startYear; year <= endYear; year++ {
		summary, err := s.GetAnnualSummary(ctx, year)
		if err != nil {
			continue
		}

		years = append(years, YearSummary{
			Year:             year,
			TotalGrossIncome: summary.TotalGrossIncome + summary.StockOptionsBenefit,
			TotalTax:         summary.TotalTax,
			NetIncome:        summary.NetIncome,
			EffectiveTaxRate: summary.EffectiveTaxRate,
			ByCategory: IncomeByCategory{
				Employment: summary.EmploymentIncome,
				Investment: summary.InvestmentIncome,
				Rental:     summary.RentalIncome,
				Business:   summary.BusinessIncome,
				Other:      summary.OtherIncome + summary.StockOptionsBenefit,
			},
		})
	}

	return &YearComparisonResponse{Years: years}, nil
}

// GetTaxConfig retrieves tax configuration for a year
func (s *Service) GetTaxConfig(ctx context.Context, year int) (*TaxConfiguration, error) {
	userID := auth.GetUserID(ctx)
	if userID == "" {
		return nil, fmt.Errorf("user not authenticated")
	}

	config := &TaxConfiguration{}
	var federalBracketsJSON, provincialBracketsJSON []byte

	err := s.db.QueryRowContext(ctx, `
		SELECT id, user_id, tax_year, province, federal_brackets, provincial_brackets,
			cpp_rate, cpp_max_pensionable_earnings, cpp_basic_exemption,
			ei_rate, ei_max_insurable_earnings, basic_personal_amount,
			created_at, updated_at
		FROM tax_configurations
		WHERE user_id = $1 AND tax_year = $2
	`, userID, year).Scan(
		&config.ID, &config.UserID, &config.TaxYear, &config.Province,
		&federalBracketsJSON, &provincialBracketsJSON,
		&config.CPPRate, &config.CPPMaxPensionableEarnings, &config.CPPBasicExemption,
		&config.EIRate, &config.EIMaxInsurableEarnings, &config.BasicPersonalAmount,
		&config.CreatedAt, &config.UpdatedAt)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("tax configuration not found for year %d", year)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get tax configuration: %w", err)
	}

	// Parse JSON brackets
	if err := json.Unmarshal(federalBracketsJSON, &config.FederalBrackets); err != nil {
		return nil, fmt.Errorf("failed to parse federal brackets: %w", err)
	}
	if err := json.Unmarshal(provincialBracketsJSON, &config.ProvincialBrackets); err != nil {
		return nil, fmt.Errorf("failed to parse provincial brackets: %w", err)
	}

	return config, nil
}

// SaveTaxConfig saves or updates tax configuration for a year
func (s *Service) SaveTaxConfig(ctx context.Context, req *SaveTaxConfigRequest) (*TaxConfiguration, error) {
	userID := auth.GetUserID(ctx)
	if userID == "" {
		return nil, fmt.Errorf("user not authenticated")
	}

	federalBracketsJSON, err := json.Marshal(req.FederalBrackets)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal federal brackets: %w", err)
	}

	provincialBracketsJSON, err := json.Marshal(req.ProvincialBrackets)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal provincial brackets: %w", err)
	}

	// Use defaults for optional fields
	cppRate := 0.0595
	if req.CPPRate != nil {
		cppRate = *req.CPPRate
	}
	cppMaxPensionable := 68500.0
	if req.CPPMaxPensionableEarnings != nil {
		cppMaxPensionable = *req.CPPMaxPensionableEarnings
	}
	cppBasicExemption := 3500.0
	if req.CPPBasicExemption != nil {
		cppBasicExemption = *req.CPPBasicExemption
	}
	eiRate := 0.0163
	if req.EIRate != nil {
		eiRate = *req.EIRate
	}
	eiMaxInsurable := 63200.0
	if req.EIMaxInsurableEarnings != nil {
		eiMaxInsurable = *req.EIMaxInsurableEarnings
	}
	basicPersonalAmount := 15705.0
	if req.BasicPersonalAmount != nil {
		basicPersonalAmount = *req.BasicPersonalAmount
	}

	now := time.Now()
	newID := uuid.New().String()

	_, err = s.db.ExecContext(ctx, `
		INSERT INTO tax_configurations (id, user_id, tax_year, province, federal_brackets, provincial_brackets,
			cpp_rate, cpp_max_pensionable_earnings, cpp_basic_exemption,
			ei_rate, ei_max_insurable_earnings, basic_personal_amount, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
		ON CONFLICT (user_id, tax_year) DO UPDATE SET
			province = excluded.province,
			federal_brackets = excluded.federal_brackets,
			provincial_brackets = excluded.provincial_brackets,
			cpp_rate = excluded.cpp_rate,
			cpp_max_pensionable_earnings = excluded.cpp_max_pensionable_earnings,
			cpp_basic_exemption = excluded.cpp_basic_exemption,
			ei_rate = excluded.ei_rate,
			ei_max_insurable_earnings = excluded.ei_max_insurable_earnings,
			basic_personal_amount = excluded.basic_personal_amount,
			updated_at = $14
	`, newID, userID, req.TaxYear, req.Province, federalBracketsJSON, provincialBracketsJSON,
		cppRate, cppMaxPensionable, cppBasicExemption, eiRate, eiMaxInsurable, basicPersonalAmount, now, now)

	if err != nil {
		return nil, fmt.Errorf("failed to save tax configuration: %w", err)
	}

	// Fetch the saved/updated config
	return s.GetTaxConfig(ctx, req.TaxYear)
}

// Helper functions

func (s *Service) convertToAnnualAmount(amount float64, frequency IncomeFrequency) float64 {
	switch frequency {
	case FrequencyOneTime:
		return amount
	case FrequencyMonthly:
		return amount * 12
	case FrequencyBiWeekly:
		return amount * 26
	case FrequencyAnnually:
		return amount
	default:
		return amount
	}
}

func (s *Service) getStockOptionsBenefit(ctx context.Context, userID string, year int) float64 {
	var benefit float64
	err := s.db.QueryRowContext(ctx, `
		SELECT COALESCE(SUM(ee.taxable_benefit), 0)
		FROM equity_exercises ee
		JOIN equity_grants eg ON ee.grant_id = eg.id
		JOIN accounts a ON eg.account_id = a.id
		WHERE a.user_id = $1 AND strftime('%Y', ee.exercise_date) = $2
	`, userID, fmt.Sprintf("%d", year)).Scan(&benefit)

	if err != nil {
		return 0
	}
	return benefit
}

func (s *Service) getDefaultTaxConfig(year int) *TaxConfiguration {
	return &TaxConfiguration{
		TaxYear:                   year,
		Province:                  "ON",
		FederalBrackets:           defaultFederalBrackets,
		ProvincialBrackets:        defaultProvincialBrackets,
		CPPRate:                   0.0595,
		CPPMaxPensionableEarnings: 68500,
		CPPBasicExemption:         3500,
		EIRate:                    0.0163,
		EIMaxInsurableEarnings:    63200,
		BasicPersonalAmount:       15705,
	}
}

func (s *Service) calculateTaxes(totalTaxableIncome, employmentIncome float64, config *TaxConfiguration) *TaxBreakdown {
	// Calculate federal tax using progressive brackets
	federalTax := s.calculateProgressiveTax(totalTaxableIncome, config.FederalBrackets)

	// Apply basic personal amount credit (15% of basic personal amount)
	federalCredit := config.BasicPersonalAmount * 0.15
	federalTax = math.Max(0, federalTax-federalCredit)

	// Calculate provincial tax using progressive brackets
	provincialTax := s.calculateProgressiveTax(totalTaxableIncome, config.ProvincialBrackets)

	// Calculate CPP contribution (only on employment income)
	cppContribution := 0.0
	if employmentIncome > config.CPPBasicExemption {
		pensionableEarnings := math.Min(employmentIncome, config.CPPMaxPensionableEarnings) - config.CPPBasicExemption
		cppContribution = pensionableEarnings * config.CPPRate
	}

	// Calculate EI contribution (only on employment income)
	eiContribution := 0.0
	if employmentIncome > 0 {
		insurableEarnings := math.Min(employmentIncome, config.EIMaxInsurableEarnings)
		eiContribution = insurableEarnings * config.EIRate
	}

	totalTax := federalTax + provincialTax + cppContribution + eiContribution

	// Calculate effective tax rate
	effectiveTaxRate := 0.0
	if totalTaxableIncome > 0 {
		effectiveTaxRate = totalTax / totalTaxableIncome
	}

	// Calculate marginal tax rate (combined federal + provincial at highest bracket)
	marginalTaxRate := s.getMarginalRate(totalTaxableIncome, config.FederalBrackets) +
		s.getMarginalRate(totalTaxableIncome, config.ProvincialBrackets)

	return &TaxBreakdown{
		FederalTax:       federalTax,
		ProvincialTax:    provincialTax,
		CPPContribution:  cppContribution,
		EIContribution:   eiContribution,
		TotalTax:         totalTax,
		EffectiveTaxRate: effectiveTaxRate,
		MarginalTaxRate:  marginalTaxRate,
	}
}

func (s *Service) calculateProgressiveTax(income float64, brackets []TaxBracket) float64 {
	if len(brackets) == 0 || income <= 0 {
		return 0
	}

	var totalTax float64
	remainingIncome := income

	for i, bracket := range brackets {
		var bracketIncome float64

		if bracket.UpToIncome == 0 {
			// Last bracket (unlimited)
			bracketIncome = remainingIncome
		} else if i == 0 {
			// First bracket
			bracketIncome = math.Min(remainingIncome, bracket.UpToIncome)
		} else {
			// Middle brackets
			prevBracket := brackets[i-1]
			bracketWidth := bracket.UpToIncome - prevBracket.UpToIncome
			bracketIncome = math.Min(remainingIncome, bracketWidth)
		}

		totalTax += bracketIncome * bracket.Rate
		remainingIncome -= bracketIncome

		if remainingIncome <= 0 {
			break
		}
	}

	return totalTax
}

func (s *Service) getMarginalRate(income float64, brackets []TaxBracket) float64 {
	if len(brackets) == 0 || income <= 0 {
		return 0
	}

	for i, bracket := range brackets {
		if bracket.UpToIncome == 0 || income <= bracket.UpToIncome {
			return bracket.Rate
		}
		if i == len(brackets)-1 {
			return bracket.Rate
		}
	}

	return brackets[len(brackets)-1].Rate
}
