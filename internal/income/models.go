package income

import (
	"time"
)

// IncomeCategory represents types of income
type IncomeCategory string

const (
	CategoryEmployment IncomeCategory = "employment"
	CategoryInvestment IncomeCategory = "investment"
	CategoryRental     IncomeCategory = "rental"
	CategoryBusiness   IncomeCategory = "business"
	CategoryOther      IncomeCategory = "other"
)

// IncomeFrequency represents how often income is received
type IncomeFrequency string

const (
	FrequencyOneTime  IncomeFrequency = "one_time"
	FrequencyMonthly  IncomeFrequency = "monthly"
	FrequencyBiWeekly IncomeFrequency = "bi-weekly"
	FrequencyAnnually IncomeFrequency = "annually"
)

// Currency represents supported currencies
type Currency string

const (
	CurrencyCAD Currency = "CAD"
	CurrencyUSD Currency = "USD"
	CurrencyINR Currency = "INR"
)

// IncomeRecord represents an individual income entry
type IncomeRecord struct {
	ID           string          `json:"id"`
	UserID       string          `json:"user_id"`
	Source       string          `json:"source"`
	Category     IncomeCategory  `json:"category"`
	Amount       float64         `json:"amount"`
	Currency     Currency        `json:"currency"`
	Frequency    IncomeFrequency `json:"frequency"`
	TaxYear      int             `json:"tax_year"`
	DateReceived *string         `json:"date_received,omitempty"`
	Description  *string         `json:"description,omitempty"`
	IsTaxable    bool            `json:"is_taxable"`
	CreatedAt    time.Time       `json:"created_at"`
	UpdatedAt    time.Time       `json:"updated_at"`
}

// TaxBracket represents a progressive tax bracket
type TaxBracket struct {
	UpToIncome float64 `json:"up_to_income"`
	Rate       float64 `json:"rate"`
}

// FieldSource represents the source of a field value
type FieldSource string

const (
	FieldSourceAPI    FieldSource = "api"
	FieldSourceManual FieldSource = "manual"
)

// FieldSources maps field names to their data source
type FieldSources map[string]FieldSource

// TaxConfiguration represents per-user tax settings per year
type TaxConfiguration struct {
	ID                        string       `json:"id"`
	UserID                    string       `json:"user_id"`
	TaxYear                   int          `json:"tax_year"`
	Province                  string       `json:"province"`
	FederalBrackets           []TaxBracket `json:"federal_brackets"`
	ProvincialBrackets        []TaxBracket `json:"provincial_brackets"`
	CPPRate                   float64      `json:"cpp_rate"`
	CPPMaxPensionableEarnings float64      `json:"cpp_max_pensionable_earnings"`
	CPPBasicExemption         float64      `json:"cpp_basic_exemption"`
	EIRate                    float64      `json:"ei_rate"`
	EIMaxInsurableEarnings    float64      `json:"ei_max_insurable_earnings"`
	BasicPersonalAmount       float64      `json:"basic_personal_amount"`
	FieldSources              FieldSources `json:"field_sources"`
	CreatedAt                 time.Time    `json:"created_at"`
	UpdatedAt                 time.Time    `json:"updated_at"`
}

// AnnualIncomeSummary represents pre-computed annual totals
type AnnualIncomeSummary struct {
	ID                  string    `json:"id"`
	UserID              string    `json:"user_id"`
	TaxYear             int       `json:"tax_year"`
	TotalGrossIncome    float64   `json:"total_gross_income"`
	TotalTaxableIncome  float64   `json:"total_taxable_income"`
	EmploymentIncome    float64   `json:"employment_income"`
	InvestmentIncome    float64   `json:"investment_income"`
	RentalIncome        float64   `json:"rental_income"`
	BusinessIncome      float64   `json:"business_income"`
	OtherIncome         float64   `json:"other_income"`
	StockOptionsBenefit float64   `json:"stock_options_benefit"`
	FederalTax          float64   `json:"federal_tax"`
	ProvincialTax       float64   `json:"provincial_tax"`
	CPPContribution     float64   `json:"cpp_contribution"`
	EIContribution      float64   `json:"ei_contribution"`
	TotalTax            float64   `json:"total_tax"`
	NetIncome           float64   `json:"net_income"`
	EffectiveTaxRate    float64   `json:"effective_tax_rate"`
	MarginalTaxRate     float64   `json:"marginal_tax_rate"`
	ComputedAt          time.Time `json:"computed_at"`
	CreatedAt           time.Time `json:"created_at"`
	UpdatedAt           time.Time `json:"updated_at"`
}

// TaxBreakdown provides detailed tax calculation breakdown
type TaxBreakdown struct {
	FederalTax          float64 `json:"federal_tax"`
	ProvincialTax       float64 `json:"provincial_tax"`
	CPPContribution     float64 `json:"cpp_contribution"`
	EIContribution      float64 `json:"ei_contribution"`
	TotalTax            float64 `json:"total_tax"`
	EffectiveTaxRate    float64 `json:"effective_tax_rate"`
	MarginalTaxRate     float64 `json:"marginal_tax_rate"`
}

// IncomeByCategory provides income breakdown by category
type IncomeByCategory struct {
	Employment float64 `json:"employment"`
	Investment float64 `json:"investment"`
	Rental     float64 `json:"rental"`
	Business   float64 `json:"business"`
	Other      float64 `json:"other"`
}

// Request/Response types

// CreateIncomeRecordRequest represents a request to create an income record
type CreateIncomeRecordRequest struct {
	Source       string          `json:"source"`
	Category     IncomeCategory  `json:"category"`
	Amount       float64         `json:"amount"`
	Currency     Currency        `json:"currency"`
	Frequency    IncomeFrequency `json:"frequency"`
	TaxYear      int             `json:"tax_year"`
	DateReceived *string         `json:"date_received,omitempty"`
	Description  *string         `json:"description,omitempty"`
	IsTaxable    *bool           `json:"is_taxable,omitempty"`
}

// UpdateIncomeRecordRequest represents a request to update an income record
type UpdateIncomeRecordRequest struct {
	Source       *string          `json:"source,omitempty"`
	Category     *IncomeCategory  `json:"category,omitempty"`
	Amount       *float64         `json:"amount,omitempty"`
	Currency     *Currency        `json:"currency,omitempty"`
	Frequency    *IncomeFrequency `json:"frequency,omitempty"`
	TaxYear      *int             `json:"tax_year,omitempty"`
	DateReceived *string          `json:"date_received,omitempty"`
	Description  *string          `json:"description,omitempty"`
	IsTaxable    *bool            `json:"is_taxable,omitempty"`
}

// ListIncomeRecordsRequest represents query parameters for listing income
type ListIncomeRecordsRequest struct {
	Year     *int            `json:"year,omitempty"`
	Category *IncomeCategory `json:"category,omitempty"`
}

// ListIncomeRecordsResponse represents the response for listing income records
type ListIncomeRecordsResponse struct {
	Records []IncomeRecord `json:"records"`
}

// SaveTaxConfigRequest represents a request to save tax configuration
type SaveTaxConfigRequest struct {
	TaxYear                   int          `json:"tax_year"`
	Province                  string       `json:"province"`
	FederalBrackets           []TaxBracket `json:"federal_brackets"`
	ProvincialBrackets        []TaxBracket `json:"provincial_brackets"`
	CPPRate                   *float64     `json:"cpp_rate,omitempty"`
	CPPMaxPensionableEarnings *float64     `json:"cpp_max_pensionable_earnings,omitempty"`
	CPPBasicExemption         *float64     `json:"cpp_basic_exemption,omitempty"`
	EIRate                    *float64     `json:"ei_rate,omitempty"`
	EIMaxInsurableEarnings    *float64     `json:"ei_max_insurable_earnings,omitempty"`
	BasicPersonalAmount       *float64     `json:"basic_personal_amount,omitempty"`
	FieldSources              FieldSources `json:"field_sources,omitempty"`
}

// YearComparisonResponse represents multi-year income comparison
type YearComparisonResponse struct {
	Years []YearSummary `json:"years"`
}

// YearSummary represents a single year's summary for comparison
type YearSummary struct {
	Year             int              `json:"year"`
	TotalGrossIncome float64          `json:"total_gross_income"`
	TotalTax         float64          `json:"total_tax"`
	NetIncome        float64          `json:"net_income"`
	EffectiveTaxRate float64          `json:"effective_tax_rate"`
	ByCategory       IncomeByCategory `json:"by_category"`
}

// DeleteResponse represents a successful delete response
type DeleteResponse struct {
	Success bool `json:"success"`
}

// Tax Simulation Models

// CalculateExerciseTaxRequest represents a request to calculate exercise tax
type CalculateExerciseTaxRequest struct {
	Quantity      int     `json:"quantity"`
	StrikePrice   float64 `json:"strike_price"`
	FMVAtExercise float64 `json:"fmv_at_exercise"`
	MarginalRate  float64 `json:"marginal_rate"` // Combined federal + provincial rate
}

// ExerciseTaxResult represents the result of exercise tax calculation
type ExerciseTaxResult struct {
	Quantity             int     `json:"quantity"`
	StrikePrice          float64 `json:"strike_price"`
	FMVAtExercise        float64 `json:"fmv_at_exercise"`
	ExerciseCost         float64 `json:"exercise_cost"`
	TaxableBenefit       float64 `json:"taxable_benefit"`
	StockOptionDeduction float64 `json:"stock_option_deduction"`
	NetTaxable           float64 `json:"net_taxable"`
	EstimatedTax         float64 `json:"estimated_tax"`
}

// CalculateSaleTaxRequest represents a request to calculate sale tax
type CalculateSaleTaxRequest struct {
	Quantity        int     `json:"quantity"`
	SalePrice       float64 `json:"sale_price"`
	CostBasis       float64 `json:"cost_basis"`
	AcquisitionDate string  `json:"acquisition_date"` // ISO date string
	SaleDate        string  `json:"sale_date"`        // ISO date string
	MarginalRate    float64 `json:"marginal_rate"`
}

// SaleTaxResult represents the result of sale tax calculation
type SaleTaxResult struct {
	Quantity          int     `json:"quantity"`
	SalePrice         float64 `json:"sale_price"`
	CostBasis         float64 `json:"cost_basis"`
	TotalProceeds     float64 `json:"total_proceeds"`
	CapitalGain       float64 `json:"capital_gain"`
	HoldingPeriodDays int     `json:"holding_period_days"`
	TaxableGain       float64 `json:"taxable_gain"` // 50% of capital gain
	EstimatedTax      float64 `json:"estimated_tax"`
}

// BatchTaxCalculationRequest allows calculating multiple exercises and sales at once
type BatchTaxCalculationRequest struct {
	Exercises    []CalculateExerciseTaxRequest `json:"exercises"`
	Sales        []CalculateSaleTaxRequest     `json:"sales"`
	MarginalRate float64                       `json:"marginal_rate"`
}

// BatchTaxCalculationResult returns results for batch calculations
type BatchTaxCalculationResult struct {
	Exercises        []ExerciseTaxResult `json:"exercises"`
	Sales            []SaleTaxResult     `json:"sales"`
	TotalExerciseTax float64             `json:"total_exercise_tax"`
	TotalSaleTax     float64             `json:"total_sale_tax"`
	TotalTax         float64             `json:"total_tax"`
}
