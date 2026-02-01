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
	ID                 string     `json:"id"`
	AccountID          string     `json:"account_id"`
	OriginalAmount     float64    `json:"original_amount"`
	InterestRate       float64    `json:"interest_rate"`
	RateType           string     `json:"rate_type"`
	StartDate          time.Time  `json:"start_date"`
	TermMonths         int        `json:"term_months"`
	AmortizationMonths int        `json:"amortization_months"`
	PaymentAmount      float64    `json:"payment_amount"`
	PaymentFrequency   string     `json:"payment_frequency"`
	PaymentDay         *int       `json:"payment_day"`
	PropertyAddress    *string    `json:"property_address"`
	PropertyCity       *string    `json:"property_city"`
	PropertyProvince   *string    `json:"property_province"`
	PropertyPostalCode *string    `json:"property_postal_code"`
	PropertyValue      *float64   `json:"property_value"`
	RenewalDate        *time.Time `json:"renewal_date"`
	MaturityDate       time.Time  `json:"maturity_date"`
	Lender             *string    `json:"lender"`
	MortgageNumber     *string    `json:"mortgage_number"`
	Notes              *string    `json:"notes"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
}

// MortgagePayment represents a mortgage payment record
type MortgagePayment struct {
	ID              string    `json:"id"`
	AccountID       string    `json:"account_id"`
	PaymentDate     time.Time `json:"payment_date"`
	PaymentAmount   float64   `json:"payment_amount"`
	PrincipalAmount float64   `json:"principal_amount"`
	InterestAmount  float64   `json:"interest_amount"`
	ExtraPayment    *float64  `json:"extra_payment"`
	BalanceAfter    float64   `json:"balance_after"`
	Notes           *string   `json:"notes"`
	CreatedAt       time.Time `json:"created_at"`
}

// LoanDetails represents loan details record
type LoanDetails struct {
	ID               string     `json:"id"`
	AccountID        string     `json:"account_id"`
	OriginalAmount   float64    `json:"original_amount"`
	InterestRate     float64    `json:"interest_rate"`
	RateType         string     `json:"rate_type"`
	StartDate        time.Time  `json:"start_date"`
	TermMonths       int        `json:"term_months"`
	PaymentAmount    float64    `json:"payment_amount"`
	PaymentFrequency string     `json:"payment_frequency"`
	PaymentDay       *int       `json:"payment_day"`
	LoanType         *string    `json:"loan_type"`
	Lender           *string    `json:"lender"`
	LoanNumber       *string    `json:"loan_number"`
	Purpose          *string    `json:"purpose"`
	MaturityDate     time.Time  `json:"maturity_date"`
	Notes            *string    `json:"notes"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

// LoanPayment represents a loan payment record
type LoanPayment struct {
	ID              string    `json:"id"`
	AccountID       string    `json:"account_id"`
	PaymentDate     time.Time `json:"payment_date"`
	PaymentAmount   float64   `json:"payment_amount"`
	PrincipalAmount float64   `json:"principal_amount"`
	InterestAmount  float64   `json:"interest_amount"`
	ExtraPayment    *float64  `json:"extra_payment"`
	BalanceAfter    float64   `json:"balance_after"`
	Notes           *string   `json:"notes"`
	CreatedAt       time.Time `json:"created_at"`
}

// AssetDetails represents asset details record
type AssetDetails struct {
	ID                 string    `json:"id"`
	AccountID          string    `json:"account_id"`
	AssetType          string    `json:"asset_type"`
	PurchasePrice      float64   `json:"purchase_price"`
	PurchaseDate       time.Time `json:"purchase_date"`
	DepreciationMethod string    `json:"depreciation_method"`
	UsefulLifeYears    *int      `json:"useful_life_years"`
	SalvageValue       *float64  `json:"salvage_value"`
	DepreciationRate   *float64  `json:"depreciation_rate"`
	TypeSpecificData   *string   `json:"type_specific_data"` // JSONB stored as string
	Notes              *string   `json:"notes"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
}

// AssetDepreciationEntry represents an asset depreciation entry
type AssetDepreciationEntry struct {
	ID                      string    `json:"id"`
	AccountID               string    `json:"account_id"`
	EntryDate               time.Time `json:"entry_date"`
	CurrentValue            float64   `json:"current_value"`
	AccumulatedDepreciation float64   `json:"accumulated_depreciation"`
	Notes                   *string   `json:"notes"`
	CreatedAt               time.Time `json:"created_at"`
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
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Name      string    `json:"name"`
	IsDefault bool      `json:"is_default"`
	Config    string    `json:"config"` // JSONB stored as string
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
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

// Connection represents a provider connection (without credentials)
type Connection struct {
	ID            string     `json:"id"`
	UserID        string     `json:"user_id"`
	Provider      string     `json:"provider"`
	Name          string     `json:"name"`
	Status        string     `json:"status"`
	LastSyncAt    *time.Time `json:"last_sync_at"`
	LastSyncError *string    `json:"last_sync_error"`
	SyncFrequency string     `json:"sync_frequency"`
	AccountCount  int        `json:"account_count"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

// SyncCredential represents sync credentials (without encrypted data for export)
type SyncCredential struct {
	ID            string     `json:"id"`
	UserID        string     `json:"user_id"`
	Provider      string     `json:"provider"`
	Email         string     `json:"email"`
	Name          string     `json:"name"`
	Status        string     `json:"status"`
	LastSyncAt    *time.Time `json:"last_sync_at"`
	LastSyncError *string    `json:"last_sync_error"`
	SyncFrequency string     `json:"sync_frequency"`
	AccountCount  int        `json:"account_count"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

// SyncedAccount represents the mapping between local and provider accounts
type SyncedAccount struct {
	ID                string     `json:"id"`
	CredentialID      string     `json:"credential_id"`
	LocalAccountID    string     `json:"local_account_id"`
	ProviderAccountID string     `json:"provider_account_id"`
	LastSyncAt        *time.Time `json:"last_sync_at"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
}

// EquityGrant represents an equity grant record
type EquityGrant struct {
	ID             string     `json:"id"`
	AccountID      string     `json:"account_id"`
	GrantType      string     `json:"grant_type"`
	GrantDate      string     `json:"grant_date"`
	Quantity       int        `json:"quantity"`
	StrikePrice    *float64   `json:"strike_price"`
	FMVAtGrant     float64    `json:"fmv_at_grant"`
	Currency       string     `json:"currency"`
	ExpirationDate *string    `json:"expiration_date"`
	CompanyName    *string    `json:"company_name"`
	GrantNumber    *string    `json:"grant_number"`
	Notes          *string    `json:"notes"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

// VestingSchedule represents a vesting schedule record
type VestingSchedule struct {
	ID                   string    `json:"id"`
	GrantID              string    `json:"grant_id"`
	ScheduleType         string    `json:"schedule_type"`
	CliffMonths          *int      `json:"cliff_months"`
	TotalVestingMonths   *int      `json:"total_vesting_months"`
	VestingFrequency     *string   `json:"vesting_frequency"`
	MilestoneDescription *string   `json:"milestone_description"`
	CreatedAt            time.Time `json:"created_at"`
}

// FMVHistory represents a fair market value history record
type FMVHistory struct {
	ID            string    `json:"id"`
	AccountID     string    `json:"account_id"`
	Currency      string    `json:"currency"`
	EffectiveDate string    `json:"effective_date"`
	FMVPerShare   float64   `json:"fmv_per_share"`
	Notes         *string   `json:"notes"`
	CreatedAt     time.Time `json:"created_at"`
}

// EquityExercise represents an equity exercise record
type EquityExercise struct {
	ID            string    `json:"id"`
	GrantID       string    `json:"grant_id"`
	ExerciseDate  string    `json:"exercise_date"`
	Quantity      int       `json:"quantity"`
	FMVAtExercise float64   `json:"fmv_at_exercise"`
	CostBasis     float64   `json:"cost_basis"`
	ExerciseType  string    `json:"exercise_type"`
	Notes         *string   `json:"notes"`
	CreatedAt     time.Time `json:"created_at"`
}

// EquitySale represents an equity sale record
type EquitySale struct {
	ID            string    `json:"id"`
	GrantID       string    `json:"grant_id"`
	ExerciseID    *string   `json:"exercise_id"`
	SaleDate      string    `json:"sale_date"`
	Quantity      int       `json:"quantity"`
	SalePrice     float64   `json:"sale_price"`
	TotalProceeds float64   `json:"total_proceeds"`
	GainLoss      float64   `json:"gain_loss"`
	SaleType      string    `json:"sale_type"`
	Notes         *string   `json:"notes"`
	CreatedAt     time.Time `json:"created_at"`
}
