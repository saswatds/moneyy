// Service projections implements financial projection and forecasting functionality.
package projections

import (
	"context"
	"fmt"
	"math"
	"time"

	"encore.dev/storage/sqldb"
)

// ProjectionScenario represents a saved projection configuration
type ProjectionScenario struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Name      string    `json:"name"`
	IsDefault bool      `json:"is_default"`
	Config    *Config   `json:"config"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Config represents projection configuration parameters
type Config struct {
	TimeHorizonYears      int                        `json:"time_horizon_years"`      // 1-30 years
	InflationRate         float64                    `json:"inflation_rate"`          // e.g., 0.02 for 2%
	AnnualSalary          float64                    `json:"annual_salary"`           // Gross annual salary
	AnnualSalaryGrowth    float64                    `json:"annual_salary_growth"`    // e.g., 0.03 for 3%
	FederalTaxBrackets    []TaxBracket               `json:"federal_tax_brackets"`    // Federal progressive tax brackets
	ProvincialTaxBrackets []TaxBracket               `json:"provincial_tax_brackets"` // Provincial/state progressive tax brackets
	MonthlyExpenses       float64                    `json:"monthly_expenses"`        // Base monthly expenses
	AnnualExpenseGrowth   float64                    `json:"annual_expense_growth"`   // e.g., 0.02 for 2%
	MonthlySavingsRate    float64                    `json:"monthly_savings_rate"`    // % of net income to save (e.g., 0.2 for 20%)
	InvestmentReturns     map[string]float64         `json:"investment_returns"`      // Expected annual returns by account type
	ExtraDebtPayments     map[string]float64         `json:"extra_debt_payments"`     // Extra monthly principal by account ID
	OneTimeExpenses       []OneTimeExpense           `json:"one_time_expenses"`       // Future planned expenses
	OneTimeIncomes        []OneTimeIncome            `json:"one_time_incomes"`        // Future planned incomes
	AssetAppreciation     map[string]float64         `json:"asset_appreciation"`      // Annual appreciation rate by account type
	SavingsAllocation     map[string]float64         `json:"savings_allocation"`      // How to allocate monthly savings by account type
}

// TaxBracket represents a progressive tax bracket
type TaxBracket struct {
	UpToIncome float64 `json:"up_to_income"` // Income threshold (0 = unlimited)
	Rate       float64 `json:"rate"`         // Tax rate for this bracket (e.g., 0.15 for 15%)
}

// OneTimeExpense represents a planned future expense
type OneTimeExpense struct {
	Date        time.Time `json:"date"`
	Amount      float64   `json:"amount"`
	Description string    `json:"description"`
}

// OneTimeIncome represents a planned future income
type OneTimeIncome struct {
	Date        time.Time `json:"date"`
	Amount      float64   `json:"amount"`
	Description string    `json:"description"`
}

// ProjectionRequest represents a request to calculate projections
type ProjectionRequest struct {
	Config *Config `json:"config"`
}

// ProjectionResponse represents the calculated projection data
type ProjectionResponse struct {
	NetWorth     []DataPoint            `json:"net_worth"`
	Assets       []DataPoint            `json:"assets"`
	Liabilities  []DataPoint            `json:"liabilities"`
	CashFlow     []CashFlowPoint        `json:"cash_flow"`
	AssetBreakdown []AssetBreakdownPoint `json:"asset_breakdown"`
	DebtPayoff   []DebtPayoffPoint      `json:"debt_payoff"`
}

// DataPoint represents a single point in time for a metric
type DataPoint struct {
	Date  time.Time `json:"date"`
	Value float64   `json:"value"`
}

// CashFlowPoint represents income and expenses at a point in time
type CashFlowPoint struct {
	Date     time.Time `json:"date"`
	Income   float64   `json:"income"`
	Expenses float64   `json:"expenses"`
	Net      float64   `json:"net"`
}

// AssetBreakdownPoint represents asset composition at a point in time
type AssetBreakdownPoint struct {
	Date   time.Time          `json:"date"`
	Assets map[string]float64 `json:"assets"` // account type -> value
}

// DebtPayoffPoint represents debt balance over time
type DebtPayoffPoint struct {
	Date       time.Time          `json:"date"`
	Debts      map[string]float64 `json:"debts"` // account ID -> balance
	TotalDebt  float64            `json:"total_debt"`
}

// CreateScenarioRequest represents a request to create a projection scenario
type CreateScenarioRequest struct {
	Name      string  `json:"name"`
	IsDefault bool    `json:"is_default"`
	Config    *Config `json:"config"`
}

// UpdateScenarioRequest represents a request to update a projection scenario
type UpdateScenarioRequest struct {
	Name      *string `json:"name,omitempty"`
	IsDefault *bool   `json:"is_default,omitempty"`
	Config    *Config `json:"config,omitempty"`
}

// ListScenariosResponse represents the response for listing scenarios
type ListScenariosResponse struct {
	Scenarios []*ProjectionScenario `json:"scenarios"`
}

// DeleteScenarioResponse represents the response for deleting a scenario
type DeleteScenarioResponse struct {
	Success bool `json:"success"`
}

// Database instance
var db = sqldb.NewDatabase("projections", sqldb.DatabaseConfig{
	Migrations: "./migrations",
})

// Account database instance (to query current account data)
var accountDB = sqldb.Named("account")

// Balance database instance (to query balance history)
var balanceDB = sqldb.Named("balance")

// CalculateProjection calculates financial projections based on configuration
//
//encore:api public path=/projections/calculate method=POST
func CalculateProjection(ctx context.Context, req *ProjectionRequest) (*ProjectionResponse, error) {
	config := req.Config

	// Get current accounts and balances
	accounts, err := getCurrentAccounts(ctx)
	if err != nil {
		return nil, err
	}

	// Get current mortgages and loans for amortization
	mortgages, err := getMortgageDetails(ctx)
	if err != nil {
		return nil, err
	}

	loans, err := getLoanDetails(ctx)
	if err != nil {
		return nil, err
	}

	// Initialize response
	response := &ProjectionResponse{
		NetWorth:       make([]DataPoint, 0),
		Assets:         make([]DataPoint, 0),
		Liabilities:    make([]DataPoint, 0),
		CashFlow:       make([]CashFlowPoint, 0),
		AssetBreakdown: make([]AssetBreakdownPoint, 0),
		DebtPayoff:     make([]DebtPayoffPoint, 0),
	}

	// Calculate projections month by month
	startDate := time.Now()
	totalMonths := config.TimeHorizonYears * 12

	// Track running balances for all accounts
	accountBalances := make(map[string]float64)
	for _, acc := range accounts {
		accountBalances[acc.ID] = acc.Balance
	}

	// Track mortgage/loan balances with detailed payment schedules
	debtBalances := make(map[string]float64)
	for _, m := range mortgages {
		debtBalances[m.AccountID] = m.CurrentBalance
	}
	for _, l := range loans {
		debtBalances[l.AccountID] = l.CurrentBalance
	}

	// Note: Other liability accounts (credit cards, lines of credit, etc.)
	// are tracked in accountBalances and will be included as static liabilities

	for month := 0; month <= totalMonths; month++ {
		currentDate := startDate.AddDate(0, month, 0)
		yearsElapsed := float64(month) / 12.0

		// Calculate gross annual salary for this year
		annualGrossSalary := config.AnnualSalary * math.Pow(1+config.AnnualSalaryGrowth, yearsElapsed)

		// Calculate federal and provincial tax separately
		federalTax := calculateTax(annualGrossSalary, config.FederalTaxBrackets)
		provincialTax := calculateTax(annualGrossSalary, config.ProvincialTaxBrackets)
		annualTax := federalTax + provincialTax

		// Calculate net monthly income (after tax)
		annualNetSalary := annualGrossSalary - annualTax
		monthlyNetIncome := annualNetSalary / 12.0

		// Calculate expenses for this month
		expenses := config.MonthlyExpenses * math.Pow(1+config.AnnualExpenseGrowth, yearsElapsed)

		// Add one-time incomes/expenses
		oneTimeIncome := 0.0
		for _, oneTime := range config.OneTimeIncomes {
			if isSameMonth(oneTime.Date, currentDate) {
				oneTimeIncome += oneTime.Amount
			}
		}
		for _, oneTime := range config.OneTimeExpenses {
			if isSameMonth(oneTime.Date, currentDate) {
				expenses += oneTime.Amount
			}
		}

		totalMonthlyIncome := monthlyNetIncome + oneTimeIncome

		// Calculate net cash flow
		netCashFlow := totalMonthlyIncome - expenses

		// Calculate savings based on savings rate
		savings := netCashFlow * config.MonthlySavingsRate
		if savings < 0 {
			savings = 0
		}
		if savings > netCashFlow {
			savings = netCashFlow
		}

		// Record cash flow
		response.CashFlow = append(response.CashFlow, CashFlowPoint{
			Date:     currentDate,
			Income:   totalMonthlyIncome,
			Expenses: expenses,
			Net:      netCashFlow,
		})

		// Update asset balances with returns
		assetTotal := 0.0
		assetBreakdown := make(map[string]float64)

		for accountID, balance := range accountBalances {
			account := findAccount(accounts, accountID)
			if account == nil {
				continue
			}

			if account.IsAsset {
				// Apply investment returns or asset appreciation
				var growthRate float64
				if returnRate, ok := config.InvestmentReturns[string(account.Type)]; ok {
					growthRate = returnRate
				} else if apprRate, ok := config.AssetAppreciation[string(account.Type)]; ok {
					growthRate = apprRate
				}

				monthlyReturn := math.Pow(1+growthRate, 1.0/12.0) - 1
				accountBalances[accountID] = balance * (1 + monthlyReturn)

				// Add savings allocation
				if alloc, ok := config.SavingsAllocation[string(account.Type)]; ok && savings > 0 {
					accountBalances[accountID] += savings * alloc
				}

				assetTotal += accountBalances[accountID]
				assetBreakdown[string(account.Type)] += accountBalances[accountID]
			}
		}

		// Update debt balances
		liabilityTotal := 0.0
		debtBreakdown := make(map[string]float64)

		// First, add all liability accounts (credit cards, lines of credit, etc.)
		for accountID, balance := range accountBalances {
			account := findAccount(accounts, accountID)
			if account == nil {
				continue
			}

			if !account.IsAsset && balance != 0 {
				// Check if this account has detailed mortgage/loan tracking
				hasDetailedTracking := false
				for _, m := range mortgages {
					if m.AccountID == accountID {
						hasDetailedTracking = true
						break
					}
				}
				if !hasDetailedTracking {
					for _, l := range loans {
						if l.AccountID == accountID {
							hasDetailedTracking = true
							break
						}
					}
				}

				// If no detailed tracking, use account balance as liability
				// Use absolute value since liability balances might be negative
				if !hasDetailedTracking {
					liabilityAmount := math.Abs(balance)
					liabilityTotal += liabilityAmount
					debtBreakdown[accountID] = liabilityAmount
				}
			}
		}

		// Update mortgage balances (with detailed payment tracking)
		for _, m := range mortgages {
			if balance, exists := debtBalances[m.AccountID]; exists {
				// Use absolute value in case balance is stored as negative
				balance = math.Abs(balance)

				if balance > 0 {
					// Calculate monthly payment components
					monthlyRate := m.InterestRate / 12.0 / 100.0
					payment := m.PaymentAmount

					// Add extra payment if configured
					if extra, ok := config.ExtraDebtPayments[m.AccountID]; ok {
						payment += extra
					}

					interest := balance * monthlyRate
					principal := payment - interest
					if principal > balance {
						principal = balance
					}

					newBalance := balance - principal
					if newBalance < 0 {
						newBalance = 0
					}

					debtBalances[m.AccountID] = newBalance
					liabilityTotal += newBalance
					debtBreakdown[m.AccountID] = newBalance
				}
			}
		}

		// Update loan balances
		for _, l := range loans {
			if balance, exists := debtBalances[l.AccountID]; exists {
				// Use absolute value in case balance is stored as negative
				balance = math.Abs(balance)

				if balance > 0 {
					monthlyRate := l.InterestRate / 12.0 / 100.0
					payment := l.PaymentAmount

					if extra, ok := config.ExtraDebtPayments[l.AccountID]; ok {
						payment += extra
					}

					interest := balance * monthlyRate
					principal := payment - interest
					if principal > balance {
						principal = balance
					}

					newBalance := balance - principal
					if newBalance < 0 {
						newBalance = 0
					}

					debtBalances[l.AccountID] = newBalance
					liabilityTotal += newBalance
					debtBreakdown[l.AccountID] = newBalance
				}
			}
		}

		// Calculate net worth
		netWorth := assetTotal - liabilityTotal

		// Record data points
		response.NetWorth = append(response.NetWorth, DataPoint{
			Date:  currentDate,
			Value: netWorth,
		})
		response.Assets = append(response.Assets, DataPoint{
			Date:  currentDate,
			Value: assetTotal,
		})
		response.Liabilities = append(response.Liabilities, DataPoint{
			Date:  currentDate,
			Value: liabilityTotal,
		})
		response.AssetBreakdown = append(response.AssetBreakdown, AssetBreakdownPoint{
			Date:   currentDate,
			Assets: assetBreakdown,
		})
		response.DebtPayoff = append(response.DebtPayoff, DebtPayoffPoint{
			Date:      currentDate,
			Debts:     debtBreakdown,
			TotalDebt: liabilityTotal,
		})
	}

	return response, nil
}

// Helper types for querying account data
type AccountData struct {
	ID       string
	Type     string
	IsAsset  bool
	Balance  float64
	Currency string
}

type MortgageData struct {
	AccountID      string
	CurrentBalance float64
	InterestRate   float64
	PaymentAmount  float64
}

type LoanData struct {
	AccountID      string
	CurrentBalance float64
	InterestRate   float64
	PaymentAmount  float64
}

func getCurrentAccounts(ctx context.Context) ([]AccountData, error) {
	// First get all active accounts
	rows, err := accountDB.Query(ctx, `
		SELECT id, type, is_asset, currency
		FROM accounts
		WHERE is_active = true
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var accounts []AccountData
	accountIDs := make([]string, 0)
	for rows.Next() {
		var acc AccountData
		err := rows.Scan(&acc.ID, &acc.Type, &acc.IsAsset, &acc.Currency)
		if err != nil {
			return nil, err
		}
		accounts = append(accounts, acc)
		accountIDs = append(accountIDs, acc.ID)
	}

	// Get latest balances from balance DB
	if len(accountIDs) > 0 {
		balanceRows, err := balanceDB.Query(ctx, `
			SELECT DISTINCT ON (account_id) account_id, amount
			FROM balances
			ORDER BY account_id, date DESC, created_at DESC
		`)
		if err == nil {
			defer balanceRows.Close()

			balanceMap := make(map[string]float64)
			for balanceRows.Next() {
				var accountID string
				var amount float64
				if err := balanceRows.Scan(&accountID, &amount); err == nil {
					balanceMap[accountID] = amount
				}
			}

			// Apply balances to accounts
			for i := range accounts {
				if balance, ok := balanceMap[accounts[i].ID]; ok {
					accounts[i].Balance = balance
				}
			}
		}
	}

	return accounts, nil
}

func getMortgageDetails(ctx context.Context) ([]MortgageData, error) {
	rows, err := accountDB.Query(ctx, `
		SELECT m.account_id, m.original_amount, m.interest_rate, m.payment_amount,
		       COALESCE((
		           SELECT balance_after
		           FROM mortgage_payments mp
		           WHERE mp.account_id = m.account_id
		           ORDER BY payment_date DESC, created_at DESC
		           LIMIT 1
		       ), m.original_amount) as current_balance
		FROM mortgage_details m
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var mortgages []MortgageData
	for rows.Next() {
		var m MortgageData
		var originalAmount float64
		err := rows.Scan(&m.AccountID, &originalAmount, &m.InterestRate, &m.PaymentAmount, &m.CurrentBalance)
		if err != nil {
			return nil, err
		}
		mortgages = append(mortgages, m)
	}

	return mortgages, nil
}

func getLoanDetails(ctx context.Context) ([]LoanData, error) {
	rows, err := accountDB.Query(ctx, `
		SELECT l.account_id, l.original_amount, l.interest_rate, l.payment_amount,
		       COALESCE((
		           SELECT balance_after
		           FROM loan_payments lp
		           WHERE lp.account_id = l.account_id
		           ORDER BY payment_date DESC, created_at DESC
		           LIMIT 1
		       ), l.original_amount) as current_balance
		FROM loan_details l
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var loans []LoanData
	for rows.Next() {
		var l LoanData
		var originalAmount float64
		err := rows.Scan(&l.AccountID, &originalAmount, &l.InterestRate, &l.PaymentAmount, &l.CurrentBalance)
		if err != nil {
			return nil, err
		}
		loans = append(loans, l)
	}

	return loans, nil
}

func findAccount(accounts []AccountData, id string) *AccountData {
	for i := range accounts {
		if accounts[i].ID == id {
			return &accounts[i]
		}
	}
	return nil
}

func isSameMonth(date1, date2 time.Time) bool {
	return date1.Year() == date2.Year() && date1.Month() == date2.Month()
}

// calculateTax calculates tax based on progressive tax brackets
func calculateTax(income float64, brackets []TaxBracket) float64 {
	if len(brackets) == 0 {
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

// CreateScenario creates a new projection scenario
//
//encore:api public path=/projections/scenarios method=POST
func CreateScenario(ctx context.Context, req *CreateScenarioRequest) (*ProjectionScenario, error) {
	userID := "temp-user-id" // TODO: Get from auth context

	// If this is set as default, unset other defaults
	if req.IsDefault {
		_, err := db.Exec(ctx, `
			UPDATE projection_scenarios
			SET is_default = false
			WHERE user_id = $1
		`, userID)
		if err != nil {
			return nil, err
		}
	}

	scenario := &ProjectionScenario{
		UserID:    userID,
		Name:      req.Name,
		IsDefault: req.IsDefault,
		Config:    req.Config,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	err := db.QueryRow(ctx, `
		INSERT INTO projection_scenarios (user_id, name, is_default, config, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id
	`, userID, req.Name, req.IsDefault, req.Config, scenario.CreatedAt, scenario.UpdatedAt).Scan(&scenario.ID)

	if err != nil {
		return nil, err
	}

	return scenario, nil
}

// ListScenarios lists all projection scenarios for the user
//
//encore:api public path=/projections/scenarios method=GET
func ListScenarios(ctx context.Context) (*ListScenariosResponse, error) {
	userID := "temp-user-id" // TODO: Get from auth context

	rows, err := db.Query(ctx, `
		SELECT id, user_id, name, is_default, config, created_at, updated_at
		FROM projection_scenarios
		WHERE user_id = $1
		ORDER BY is_default DESC, updated_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	scenarios := make([]*ProjectionScenario, 0)
	for rows.Next() {
		var s ProjectionScenario
		err := rows.Scan(&s.ID, &s.UserID, &s.Name, &s.IsDefault, &s.Config, &s.CreatedAt, &s.UpdatedAt)
		if err != nil {
			return nil, err
		}
		scenarios = append(scenarios, &s)
	}

	return &ListScenariosResponse{Scenarios: scenarios}, nil
}

// GetScenario retrieves a specific projection scenario
//
//encore:api public path=/projections/scenarios/:id method=GET
func GetScenario(ctx context.Context, id string) (*ProjectionScenario, error) {
	var scenario ProjectionScenario
	err := db.QueryRow(ctx, `
		SELECT id, user_id, name, is_default, config, created_at, updated_at
		FROM projection_scenarios
		WHERE id = $1
	`, id).Scan(&scenario.ID, &scenario.UserID, &scenario.Name, &scenario.IsDefault, &scenario.Config, &scenario.CreatedAt, &scenario.UpdatedAt)

	if err != nil {
		return nil, err
	}

	return &scenario, nil
}

// UpdateScenario updates a projection scenario
//
//encore:api public path=/projections/scenarios/:id method=PUT
func UpdateScenario(ctx context.Context, id string, req *UpdateScenarioRequest) (*ProjectionScenario, error) {
	userID := "temp-user-id" // TODO: Get from auth context

	// If setting as default, unset other defaults
	if req.IsDefault != nil && *req.IsDefault {
		_, err := db.Exec(ctx, `
			UPDATE projection_scenarios
			SET is_default = false
			WHERE user_id = $1 AND id != $2
		`, userID, id)
		if err != nil {
			return nil, err
		}
	}

	// Build update query dynamically
	query := `UPDATE projection_scenarios SET updated_at = $1`
	args := []any{time.Now()}
	argCount := 2

	if req.Name != nil {
		query += fmt.Sprintf(`, name = $%d`, argCount)
		args = append(args, *req.Name)
		argCount++
	}
	if req.IsDefault != nil {
		query += fmt.Sprintf(`, is_default = $%d`, argCount)
		args = append(args, *req.IsDefault)
		argCount++
	}
	if req.Config != nil {
		query += fmt.Sprintf(`, config = $%d`, argCount)
		args = append(args, req.Config)
		argCount++
	}

	query += fmt.Sprintf(` WHERE id = $%d RETURNING id, user_id, name, is_default, config, created_at, updated_at`, argCount)
	args = append(args, id)

	var scenario ProjectionScenario
	err := db.QueryRow(ctx, query, args...).Scan(
		&scenario.ID, &scenario.UserID, &scenario.Name, &scenario.IsDefault,
		&scenario.Config, &scenario.CreatedAt, &scenario.UpdatedAt,
	)

	if err != nil {
		return nil, err
	}

	return &scenario, nil
}

// DeleteScenario deletes a projection scenario
//
//encore:api public path=/projections/scenarios/:id method=DELETE
func DeleteScenario(ctx context.Context, id string) (*DeleteScenarioResponse, error) {
	_, err := db.Exec(ctx, `DELETE FROM projection_scenarios WHERE id = $1`, id)
	if err != nil {
		return &DeleteScenarioResponse{Success: false}, err
	}

	return &DeleteScenarioResponse{Success: true}, nil
}
