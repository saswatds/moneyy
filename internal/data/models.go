package data

import "time"

// ExportManifest represents the metadata for an export archive
type ExportManifest struct {
	Version    string                    `json:"version"`
	AppVersion string                    `json:"app_version"`
	ExportedAt time.Time                 `json:"exported_at"`
	UserID     string                    `json:"user_id"`
	Tables     map[string]TableMetadata  `json:"tables"`
}

// TableMetadata represents metadata for a single table in the export
type TableMetadata struct {
	Count    int    `json:"count"`
	Checksum string `json:"checksum"`
}

// ImportOptions represents options for importing data
type ImportOptions struct {
	Mode         string `json:"mode"` // "merge", "replace", "skip_existing"
	ValidateOnly bool   `json:"validate_only"`
}

// ImportResult represents the result of an import operation
type ImportResult struct {
	Success  bool                           `json:"success"`
	Summary  map[string]ImportTableSummary  `json:"summary"`
	Errors   []ImportError                  `json:"errors"`
	Warnings []string                       `json:"warnings"`
}

// ImportTableSummary represents statistics for a single table import
type ImportTableSummary struct {
	Created int `json:"created"`
	Updated int `json:"updated"`
	Skipped int `json:"skipped"`
	Errors  int `json:"errors"`
}

// ImportError represents an error that occurred during import
type ImportError struct {
	Table   string `json:"table"`
	Row     int    `json:"row"`
	Message string `json:"message"`
}

// ValidationResult represents the result of archive validation
type ValidationResult struct {
	Valid    bool     `json:"valid"`
	Errors   []string `json:"errors"`
	Warnings []string `json:"warnings"`
	Manifest *ExportManifest `json:"manifest,omitempty"`
}

// Account represents an account record
type Account struct {
	ID          string    `json:"id"`
	UserID      string    `json:"user_id"`
	Name        string    `json:"name"`
	Type        string    `json:"type"`
	Currency    string    `json:"currency"`
	Institution *string   `json:"institution"`
	IsAsset     bool      `json:"is_asset"`
	IsActive    bool      `json:"is_active"`
	SyncedAccountID *string `json:"synced_account_id"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// Balance represents a balance record
type Balance struct {
	ID        string    `json:"id"`
	AccountID string    `json:"account_id"`
	Amount    float64   `json:"amount"`
	Date      time.Time `json:"date"`
	Notes     *string   `json:"notes"`
	CreatedAt time.Time `json:"created_at"`
}

// Holding represents a holding record
type Holding struct {
	ID           string     `json:"id"`
	AccountID    string     `json:"account_id"`
	Type         string     `json:"type"`
	Symbol       *string    `json:"symbol"`
	Quantity     *float64   `json:"quantity"`
	CostBasis    *float64   `json:"cost_basis"`
	Currency     *string    `json:"currency"`
	Amount       *float64   `json:"amount"`
	PurchaseDate *time.Time `json:"purchase_date"`
	Notes        *string    `json:"notes"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

// HoldingTransaction represents a holding transaction record
type HoldingTransaction struct {
	ID              string     `json:"id"`
	HoldingID       string     `json:"holding_id"`
	Type            string     `json:"type"`
	Quantity        *float64   `json:"quantity"`
	Price           *float64   `json:"price"`
	TotalAmount     *float64   `json:"total_amount"`
	TransactionDate time.Time  `json:"transaction_date"`
	Notes           *string    `json:"notes"`
	CreatedAt       time.Time  `json:"created_at"`
}

// MortgageDetails represents mortgage details record
type MortgageDetails struct {
	ID                    string    `json:"id"`
	AccountID             string    `json:"account_id"`
	PrincipalAmount       float64   `json:"principal_amount"`
	InterestRate          float64   `json:"interest_rate"`
	PaymentFrequency      string    `json:"payment_frequency"`
	AmortizationYears     int       `json:"amortization_years"`
	StartDate             time.Time `json:"start_date"`
	FirstPaymentDate      time.Time `json:"first_payment_date"`
	PropertyValue         *float64  `json:"property_value"`
	DownPaymentPercentage *float64  `json:"down_payment_percentage"`
	CreatedAt             time.Time `json:"created_at"`
	UpdatedAt             time.Time `json:"updated_at"`
}

// MortgagePayment represents a mortgage payment record
type MortgagePayment struct {
	ID             string    `json:"id"`
	AccountID      string    `json:"account_id"`
	PaymentDate    time.Time `json:"payment_date"`
	Amount         float64   `json:"amount"`
	PrincipalPaid  float64   `json:"principal_paid"`
	InterestPaid   float64   `json:"interest_paid"`
	RemainingBalance float64 `json:"remaining_balance"`
	Notes          *string   `json:"notes"`
	CreatedAt      time.Time `json:"created_at"`
}

// LoanDetails represents loan details record
type LoanDetails struct {
	ID               string    `json:"id"`
	AccountID        string    `json:"account_id"`
	PrincipalAmount  float64   `json:"principal_amount"`
	InterestRate     float64   `json:"interest_rate"`
	PaymentFrequency string    `json:"payment_frequency"`
	TermYears        int       `json:"term_years"`
	StartDate        time.Time `json:"start_date"`
	FirstPaymentDate time.Time `json:"first_payment_date"`
	LoanType         *string   `json:"loan_type"`
	Lender           *string   `json:"lender"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

// LoanPayment represents a loan payment record
type LoanPayment struct {
	ID               string    `json:"id"`
	AccountID        string    `json:"account_id"`
	PaymentDate      time.Time `json:"payment_date"`
	Amount           float64   `json:"amount"`
	PrincipalPaid    float64   `json:"principal_paid"`
	InterestPaid     float64   `json:"interest_paid"`
	RemainingBalance float64   `json:"remaining_balance"`
	Notes            *string   `json:"notes"`
	CreatedAt        time.Time `json:"created_at"`
}

// AssetDetails represents asset details record
type AssetDetails struct {
	ID                   string     `json:"id"`
	AccountID            string     `json:"account_id"`
	AssetType            string     `json:"asset_type"`
	PurchasePrice        float64    `json:"purchase_price"`
	PurchaseDate         time.Time  `json:"purchase_date"`
	CurrentValue         *float64   `json:"current_value"`
	DepreciationMethod   *string    `json:"depreciation_method"`
	UsefulLifeYears      *int       `json:"useful_life_years"`
	SalvageValue         *float64   `json:"salvage_value"`
	Description          *string    `json:"description"`
	LastValuationDate    *time.Time `json:"last_valuation_date"`
	CreatedAt            time.Time  `json:"created_at"`
	UpdatedAt            time.Time  `json:"updated_at"`
}

// AssetDepreciationEntry represents an asset depreciation entry
type AssetDepreciationEntry struct {
	ID                string    `json:"id"`
	AccountID         string    `json:"account_id"`
	EntryDate         time.Time `json:"entry_date"`
	DepreciationAmount float64  `json:"depreciation_amount"`
	BookValue         float64   `json:"book_value"`
	Method            string    `json:"method"`
	Notes             *string   `json:"notes"`
	CreatedAt         time.Time `json:"created_at"`
}

// RecurringExpense represents a recurring expense record
type RecurringExpense struct {
	ID          string    `json:"id"`
	UserID      string    `json:"user_id"`
	Name        string    `json:"name"`
	Amount      float64   `json:"amount"`
	Currency    string    `json:"currency"`
	Frequency   string    `json:"frequency"`
	Category    *string   `json:"category"`
	Description *string   `json:"description"`
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// ProjectionScenario represents a projection scenario record
type ProjectionScenario struct {
	ID          string    `json:"id"`
	UserID      string    `json:"user_id"`
	Name        string    `json:"name"`
	Description *string   `json:"description"`
	Config      string    `json:"config"` // JSON string
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// ExchangeRate represents an exchange rate record
type ExchangeRate struct {
	ID           string    `json:"id"`
	FromCurrency string    `json:"from_currency"`
	ToCurrency   string    `json:"to_currency"`
	Rate         float64   `json:"rate"`
	Date         time.Time `json:"date"`
	CreatedAt    time.Time `json:"created_at"`
}
