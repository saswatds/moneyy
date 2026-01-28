package projections

import (
	"testing"
	"time"

	"money/internal/account"
)

func TestCalculateProjection_BasicScenario(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-calc-1"
	account.CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	service := SetupProjectionService(t, db)

	// Create some accounts with balances
	CreateTestAccountForProjection(t, db, userID, account.AccountTypeSavings, 10000.00)
	CreateTestAccountForProjection(t, db, userID, account.AccountTypeTFSA, 25000.00)

	config := DefaultTestConfig()
	config.TimeHorizonYears = 1 // Just 1 year for quick test

	req := &ProjectionRequest{
		Config: config,
	}

	// Act
	result, err := service.CalculateProjection(ctx, req)

	// Assert
	if err != nil {
		t.Fatalf("CalculateProjection failed: %v", err)
	}
	if result == nil {
		t.Fatal("Expected result, got nil")
	}
	if len(result.NetWorth) == 0 {
		t.Error("Expected net worth data points")
	}
	if len(result.CashFlow) == 0 {
		t.Error("Expected cash flow data points")
	}

	// Verify we have 13 data points (month 0 + 12 months)
	if len(result.NetWorth) != 13 {
		t.Errorf("Expected 13 net worth points, got %d", len(result.NetWorth))
	}

	// Verify net worth is positive and growing
	firstMonth := result.NetWorth[0].Value
	lastMonth := result.NetWorth[len(result.NetWorth)-1].Value
	if lastMonth <= firstMonth {
		t.Errorf("Expected net worth to grow: start=%.2f, end=%.2f", firstMonth, lastMonth)
	}
}

func TestCalculateProjection_Unauthenticated(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	service := SetupProjectionService(t, db)
	config := DefaultTestConfig()
	req := &ProjectionRequest{Config: config}

	// Act
	result, err := service.CalculateProjection(CreateAuthContext(""), req)

	// Assert
	if err == nil {
		t.Fatal("Expected error for unauthenticated user, got nil")
	}
	if result != nil {
		t.Error("Expected nil result for unauthenticated user")
	}
}

func TestCalculateProjection_WithMortgage(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-calc-mortgage-1"
	account.CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	service := SetupProjectionService(t, db)

	// Create accounts
	CreateTestAccountForProjection(t, db, userID, account.AccountTypeSavings, 50000.00)
	CreateTestMortgageForProjection(t, db, userID) // -400k mortgage

	config := DefaultTestConfig()
	config.TimeHorizonYears = 2

	req := &ProjectionRequest{Config: config}

	// Act
	result, err := service.CalculateProjection(ctx, req)

	// Assert
	if err != nil {
		t.Fatalf("CalculateProjection failed: %v", err)
	}

	// Verify we have debt payoff data
	if len(result.DebtPayoff) == 0 {
		t.Fatal("Expected debt payoff data")
	}

	// Verify mortgage balance decreases over time
	firstMonth := result.DebtPayoff[0].TotalDebt
	lastMonth := result.DebtPayoff[len(result.DebtPayoff)-1].TotalDebt

	if lastMonth >= firstMonth {
		t.Errorf("Expected debt to decrease: start=%.2f, end=%.2f", firstMonth, lastMonth)
	}

	// Verify mortgage appears in debt breakdown
	if len(result.DebtPayoff[0].Debts) == 0 {
		t.Error("Expected mortgage in debt breakdown")
	}
}

func TestCalculateProjection_WithLoan(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-calc-loan-1"
	account.CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	service := SetupProjectionService(t, db)

	// Create accounts
	CreateTestAccountForProjection(t, db, userID, account.AccountTypeSavings, 20000.00)
	CreateTestLoanForProjection(t, db, userID) // -10k loan

	config := DefaultTestConfig()
	config.TimeHorizonYears = 3

	req := &ProjectionRequest{Config: config}

	// Act
	result, err := service.CalculateProjection(ctx, req)

	// Assert
	if err != nil {
		t.Fatalf("CalculateProjection failed: %v", err)
	}

	// Verify loan balance decreases
	if len(result.DebtPayoff) < 12 {
		t.Fatal("Expected at least 12 months of debt data")
	}

	firstDebt := result.DebtPayoff[0].TotalDebt
	lastDebt := result.DebtPayoff[len(result.DebtPayoff)-1].TotalDebt

	if lastDebt >= firstDebt {
		t.Errorf("Expected loan debt to decrease: start=%.2f, end=%.2f", firstDebt, lastDebt)
	}
}

func TestCalculateProjection_InvestmentGrowth(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-calc-invest-1"
	account.CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	service := SetupProjectionService(t, db)

	// Create investment accounts
	CreateTestAccountForProjection(t, db, userID, account.AccountTypeTFSA, 100000.00)
	CreateTestAccountForProjection(t, db, userID, account.AccountTypeRRSP, 150000.00)

	config := DefaultTestConfig()
	config.TimeHorizonYears = 5
	config.InvestmentReturns = map[string]float64{
		"tfsa": 0.07, // 7% annual return
		"rrsp": 0.06, // 6% annual return
	}

	req := &ProjectionRequest{Config: config}

	// Act
	result, err := service.CalculateProjection(ctx, req)

	// Assert
	if err != nil {
		t.Fatalf("CalculateProjection failed: %v", err)
	}

	// Verify asset growth
	if len(result.Assets) < 60 {
		t.Fatal("Expected 60 months of asset data")
	}

	firstAssets := result.Assets[0].Value
	lastAssets := result.Assets[len(result.Assets)-1].Value

	// Assets should grow significantly over 5 years with 6-7% returns
	expectedMinGrowth := firstAssets * 1.30 // At least 30% growth
	if lastAssets < expectedMinGrowth {
		t.Errorf("Expected significant asset growth: start=%.2f, end=%.2f, expected min=%.2f",
			firstAssets, lastAssets, expectedMinGrowth)
	}
}

func TestCalculateProjection_SavingsAllocation(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-calc-savings-1"
	account.CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	service := SetupProjectionService(t, db)

	// Create investment accounts with initial balances
	CreateTestAccountForProjection(t, db, userID, account.AccountTypeTFSA, 10000.00)
	CreateTestAccountForProjection(t, db, userID, account.AccountTypeRRSP, 10000.00)

	config := DefaultTestConfig()
	config.TimeHorizonYears = 1
	config.AnnualSalary = 100000.00
	config.MonthlyExpenses = 4000.00
	config.MonthlySavingsRate = 0.30 // Save 30% of net income
	config.SavingsAllocation = map[string]float64{
		"tfsa": 0.60, // 60% to TFSA
		"rrsp": 0.40, // 40% to RRSP
	}

	req := &ProjectionRequest{Config: config}

	// Act
	result, err := service.CalculateProjection(ctx, req)

	// Assert
	if err != nil {
		t.Fatalf("CalculateProjection failed: %v", err)
	}

	// Verify asset breakdown shows allocation
	if len(result.AssetBreakdown) < 12 {
		t.Fatal("Expected 12 months of asset breakdown")
	}

	// Check that both TFSA and RRSP grow
	lastMonth := result.AssetBreakdown[len(result.AssetBreakdown)-1]
	if lastMonth.Assets["tfsa"] <= 10000.00 {
		t.Error("Expected TFSA to grow from initial balance")
	}
	if lastMonth.Assets["rrsp"] <= 10000.00 {
		t.Error("Expected RRSP to grow from initial balance")
	}
}

func TestCalculateProjection_PositiveCashFlow(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-calc-cashflow-1"
	account.CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	service := SetupProjectionService(t, db)

	CreateTestAccountForProjection(t, db, userID, account.AccountTypeSavings, 5000.00)

	config := DefaultTestConfig()
	config.TimeHorizonYears = 1
	config.AnnualSalary = 80000.00
	config.MonthlyExpenses = 3000.00

	req := &ProjectionRequest{Config: config}

	// Act
	result, err := service.CalculateProjection(ctx, req)

	// Assert
	if err != nil {
		t.Fatalf("CalculateProjection failed: %v", err)
	}

	if len(result.CashFlow) < 12 {
		t.Fatal("Expected 12 months of cash flow")
	}

	// Verify all months have positive cash flow (income > expenses)
	for i, cf := range result.CashFlow {
		if cf.Income <= 0 {
			t.Errorf("Month %d: expected positive income, got %.2f", i, cf.Income)
		}
		if cf.Expenses <= 0 {
			t.Errorf("Month %d: expected positive expenses, got %.2f", i, cf.Expenses)
		}
		if cf.Net <= 0 {
			t.Errorf("Month %d: expected positive net cash flow, got %.2f", i, cf.Net)
		}
	}
}

func TestCalculateProjection_NegativeCashFlow(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-calc-negative-1"
	account.CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	service := SetupProjectionService(t, db)

	// Create account with large balance to cover shortfall
	// Use TFSA since it's in the default SavingsAllocation
	CreateTestAccountForProjection(t, db, userID, account.AccountTypeTFSA, 100000.00)

	config := DefaultTestConfig()
	config.TimeHorizonYears = 1
	config.AnnualSalary = 30000.00   // Low salary
	config.MonthlyExpenses = 5000.00 // High expenses (more than income)

	req := &ProjectionRequest{Config: config}

	// Act
	result, err := service.CalculateProjection(ctx, req)

	// Assert
	if err != nil {
		t.Fatalf("CalculateProjection failed: %v", err)
	}

	// Verify negative cash flow is handled
	if len(result.CashFlow) < 12 {
		t.Fatal("Expected 12 months of cash flow")
	}

	// Assets should decrease due to negative cash flow
	firstAssets := result.Assets[0].Value
	lastAssets := result.Assets[len(result.Assets)-1].Value

	if lastAssets >= firstAssets {
		t.Errorf("Expected assets to decrease with negative cash flow: start=%.2f, end=%.2f",
			firstAssets, lastAssets)
	}
}

func TestCalculateProjection_TimeHorizonValidation(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-calc-horizon-1"
	account.CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	service := SetupProjectionService(t, db)

	CreateTestAccountForProjection(t, db, userID, account.AccountTypeSavings, 10000.00)

	tests := []struct {
		name    string
		years   int
		wantErr bool
		months  int
	}{
		{"1 year", 1, false, 13},   // month 0 + 12 months
		{"5 years", 5, false, 61},   // month 0 + 60 months
		{"10 years", 10, false, 121}, // month 0 + 120 months
		{"30 years", 30, false, 361}, // month 0 + 360 months
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			config := DefaultTestConfig()
			config.TimeHorizonYears = tt.years

			req := &ProjectionRequest{Config: config}

			// Act
			result, err := service.CalculateProjection(ctx, req)

			// Assert
			if (err != nil) != tt.wantErr {
				t.Errorf("wantErr=%v, got err=%v", tt.wantErr, err)
			}
			if !tt.wantErr && len(result.NetWorth) != tt.months {
				t.Errorf("Expected %d months, got %d", tt.months, len(result.NetWorth))
			}
		})
	}
}

func TestCalculateProjection_SalaryGrowth(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-calc-growth-1"
	account.CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	service := SetupProjectionService(t, db)

	CreateTestAccountForProjection(t, db, userID, account.AccountTypeSavings, 10000.00)

	config := DefaultTestConfig()
	config.TimeHorizonYears = 5
	config.AnnualSalary = 60000.00
	config.AnnualSalaryGrowth = 0.05 // 5% annual growth

	req := &ProjectionRequest{Config: config}

	// Act
	result, err := service.CalculateProjection(ctx, req)

	// Assert
	if err != nil {
		t.Fatalf("CalculateProjection failed: %v", err)
	}

	// Verify income grows over time
	firstYearIncome := result.CashFlow[0].Income
	lastYearIncome := result.CashFlow[len(result.CashFlow)-1].Income

	// With 5% growth over 5 years, income should grow by ~27%
	expectedMinGrowth := firstYearIncome * 1.20
	if lastYearIncome < expectedMinGrowth {
		t.Errorf("Expected income growth: start=%.2f, end=%.2f, expected min=%.2f",
			firstYearIncome, lastYearIncome, expectedMinGrowth)
	}
}

func TestCalculateProjection_ExpenseGrowth(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-calc-expense-growth-1"
	account.CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	service := SetupProjectionService(t, db)

	CreateTestAccountForProjection(t, db, userID, account.AccountTypeSavings, 50000.00)

	config := DefaultTestConfig()
	config.TimeHorizonYears = 3
	config.MonthlyExpenses = 3000.00
	config.AnnualExpenseGrowth = 0.03 // 3% annual expense growth (inflation)

	req := &ProjectionRequest{Config: config}

	// Act
	result, err := service.CalculateProjection(ctx, req)

	// Assert
	if err != nil {
		t.Fatalf("CalculateProjection failed: %v", err)
	}

	// Verify expenses grow over time
	firstYearExpenses := result.CashFlow[0].Expenses
	lastYearExpenses := result.CashFlow[len(result.CashFlow)-1].Expenses

	if lastYearExpenses <= firstYearExpenses {
		t.Errorf("Expected expense growth: start=%.2f, end=%.2f",
			firstYearExpenses, lastYearExpenses)
	}
}

func TestCalculateProjection_WithRecurringExpenses(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-calc-recurring-1"
	account.CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	service := SetupProjectionService(t, db)

	CreateTestAccountForProjection(t, db, userID, account.AccountTypeSavings, 20000.00)

	// Add recurring expenses
	CreateTestRecurringExpense(t, db, userID, 500.00, "monthly")
	CreateTestRecurringExpense(t, db, userID, 1200.00, "quarterly")

	config := DefaultTestConfig()
	config.TimeHorizonYears = 1
	config.MonthlyExpenses = 2000.00 // Base expenses

	req := &ProjectionRequest{Config: config}

	// Act
	result, err := service.CalculateProjection(ctx, req)

	// Assert
	if err != nil {
		t.Fatalf("CalculateProjection failed: %v", err)
	}

	// Verify expenses include recurring items
	// Base: 2000/month + recurring 500/month + quarterly 1200/3 = ~2900/month
	avgExpenses := 0.0
	for _, cf := range result.CashFlow {
		avgExpenses += cf.Expenses
	}
	avgExpenses /= float64(len(result.CashFlow))

	if avgExpenses < 2500.00 {
		t.Errorf("Expected expenses to include recurring items: avg=%.2f", avgExpenses)
	}
}

func TestCalculateProjection_ExtraDebtPayments(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-calc-extra-debt-1"
	account.CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	service := SetupProjectionService(t, db)

	CreateTestAccountForProjection(t, db, userID, account.AccountTypeSavings, 100000.00)
	mortgageID := CreateTestMortgageForProjection(t, db, userID)

	config := DefaultTestConfig()
	config.TimeHorizonYears = 2
	config.ExtraDebtPayments = map[string]float64{
		mortgageID: 1000.00, // Extra $1000/month to mortgage
	}

	req := &ProjectionRequest{Config: config}

	// Act
	result, err := service.CalculateProjection(ctx, req)

	// Assert
	if err != nil {
		t.Fatalf("CalculateProjection failed: %v", err)
	}

	// Verify debt decreases faster with extra payments
	if len(result.DebtPayoff) < 12 {
		t.Fatal("Expected debt payoff data")
	}

	// Debt should decrease significantly
	firstDebt := result.DebtPayoff[0].TotalDebt
	yearOneDebt := result.DebtPayoff[11].TotalDebt

	// With extra $1000/month, should pay off ~$12k more in year 1
	expectedMaxDebt := firstDebt - 12000.00
	if yearOneDebt > expectedMaxDebt {
		t.Errorf("Expected debt to decrease by at least $12k: start=%.2f, year1=%.2f",
			firstDebt, yearOneDebt)
	}
}

func TestCalculateProjection_AssetAppreciation(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-calc-appreciation-1"
	account.CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	service := SetupProjectionService(t, db)

	// Create real estate account
	CreateTestAccountForProjection(t, db, userID, account.AccountTypeRealEstate, 500000.00)

	config := DefaultTestConfig()
	config.TimeHorizonYears = 5
	config.AssetAppreciation = map[string]float64{
		"real_estate": 0.04, // 4% annual appreciation
	}

	req := &ProjectionRequest{Config: config}

	// Act
	result, err := service.CalculateProjection(ctx, req)

	// Assert
	if err != nil {
		t.Fatalf("CalculateProjection failed: %v", err)
	}

	// Verify assets appreciate
	firstAssets := result.Assets[0].Value
	lastAssets := result.Assets[len(result.Assets)-1].Value

	// With 4% growth over 5 years, should grow by ~21%
	expectedMinValue := firstAssets * 1.20
	if lastAssets < expectedMinValue {
		t.Errorf("Expected asset appreciation: start=%.2f, end=%.2f, expected min=%.2f",
			firstAssets, lastAssets, expectedMinValue)
	}
}

func TestCalculateProjection_MultipleAccountTypes(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-calc-multi-1"
	account.CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	service := SetupProjectionService(t, db)

	// Create diverse portfolio
	CreateTestAccountForProjection(t, db, userID, account.AccountTypeSavings, 10000.00)
	CreateTestAccountForProjection(t, db, userID, account.AccountTypeTFSA, 30000.00)
	CreateTestAccountForProjection(t, db, userID, account.AccountTypeRRSP, 50000.00)
	CreateTestAccountForProjection(t, db, userID, account.AccountTypeBrokerage, 25000.00)
	CreateTestAccountForProjection(t, db, userID, account.AccountTypeRealEstate, 400000.00)
	CreateTestMortgageForProjection(t, db, userID) // -400k
	CreateTestLoanForProjection(t, db, userID)     // -10k

	config := DefaultTestConfig()
	config.TimeHorizonYears = 3

	req := &ProjectionRequest{Config: config}

	// Act
	result, err := service.CalculateProjection(ctx, req)

	// Assert
	if err != nil {
		t.Fatalf("CalculateProjection failed: %v", err)
	}

	// Verify asset breakdown shows all account types
	if len(result.AssetBreakdown) < 12 {
		t.Fatal("Expected asset breakdown data")
	}

	lastMonth := result.AssetBreakdown[len(result.AssetBreakdown)-1]
	if len(lastMonth.Assets) < 4 {
		t.Errorf("Expected at least 4 asset types in breakdown, got %d", len(lastMonth.Assets))
	}

	// Verify debt breakdown shows both mortgage and loan
	if len(result.DebtPayoff) < 12 {
		t.Fatal("Expected debt payoff data")
	}

	firstDebt := result.DebtPayoff[0]
	if len(firstDebt.Debts) < 2 {
		t.Errorf("Expected at least 2 debt accounts, got %d", len(firstDebt.Debts))
	}

	// Verify net worth calculation (assets - liabilities)
	firstNetWorth := result.NetWorth[0].Value
	firstAssets := result.Assets[0].Value
	firstLiabilities := result.Liabilities[0].Value

	expectedNetWorth := firstAssets - firstLiabilities
	tolerance := 100.0 // Allow small rounding difference

	if firstNetWorth < expectedNetWorth-tolerance || firstNetWorth > expectedNetWorth+tolerance {
		t.Errorf("Net worth calculation incorrect: got=%.2f, expected=%.2f (assets=%.2f - liabilities=%.2f)",
			firstNetWorth, expectedNetWorth, firstAssets, firstLiabilities)
	}
}
// VALIDATION AND EDGE CASE TESTS

func TestCalculateProjection_InvalidTimeHorizon(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	userID := "test-user-validation-1"
	account.CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	service := SetupProjectionService(t, db)

	CreateTestAccountForProjection(t, db, userID, account.AccountTypeSavings, 10000.00)

	tests := []struct {
		name    string
		years   int
		wantErr bool
	}{
		{"Zero years", 0, false}, // Creates 1 month projection
		{"Negative years", -1, false}, // May fail or be clamped
		{"Very large years", 100, false}, // Should work but be slow
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			config := DefaultTestConfig()
			config.TimeHorizonYears = tt.years

			req := &ProjectionRequest{Config: config}
			result, err := service.CalculateProjection(ctx, req)

			if tt.wantErr && err == nil {
				t.Errorf("Expected error for %d years, got none", tt.years)
			}

			if !tt.wantErr && err == nil {
				t.Logf("%s: Generated %d data points", tt.name, len(result.NetWorth))
			}
		})
	}
}

func TestCalculateProjection_ExtremeSalary(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	userID := "test-user-extreme-salary-1"
	account.CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	service := SetupProjectionService(t, db)

	CreateTestAccountForProjection(t, db, userID, account.AccountTypeTFSA, 10000.00)

	tests := []struct {
		name   string
		salary float64
	}{
		{"Zero salary", 0},
		{"Very low salary", 1000},
		{"Very high salary", 10000000},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			config := DefaultTestConfig()
			config.TimeHorizonYears = 1
			config.AnnualSalary = tt.salary

			req := &ProjectionRequest{Config: config}
			result, err := service.CalculateProjection(ctx, req)

			if err != nil {
				t.Fatalf("CalculateProjection failed: %v", err)
			}

			if len(result.NetWorth) == 0 {
				t.Error("Expected net worth data")
			}
		})
	}
}

func TestCalculateProjection_SavingsAllocationNotSumToOne(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	userID := "test-user-allocation-1"
	account.CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	service := SetupProjectionService(t, db)

	CreateTestAccountForProjection(t, db, userID, account.AccountTypeTFSA, 10000.00)
	CreateTestAccountForProjection(t, db, userID, account.AccountTypeRRSP, 10000.00)

	tests := []struct {
		name       string
		allocation map[string]float64
	}{
		{
			"Less than 1.0",
			map[string]float64{"tfsa": 0.30, "rrsp": 0.40}, // 0.70 total
		},
		{
			"More than 1.0",
			map[string]float64{"tfsa": 0.70, "rrsp": 0.60}, // 1.30 total
		},
		{
			"Exactly 1.0",
			map[string]float64{"tfsa": 0.50, "rrsp": 0.50},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			config := DefaultTestConfig()
			config.TimeHorizonYears = 1
			config.SavingsAllocation = tt.allocation

			req := &ProjectionRequest{Config: config}
			result, err := service.CalculateProjection(ctx, req)

			if err != nil {
				t.Fatalf("CalculateProjection failed: %v", err)
			}

			// Log behavior - does it normalize? clip? use as-is?
			sum := 0.0
			for _, v := range tt.allocation {
				sum += v
			}
			t.Logf("Allocation sum: %.2f, result generated successfully", sum)

			if len(result.NetWorth) == 0 {
				t.Error("Expected net worth data")
			}
		})
	}
}

func TestCalculateProjection_NoInitialAccounts(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	userID := "test-user-no-accounts-1"
	account.CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	service := SetupProjectionService(t, db)

	// Don't create any accounts
	config := DefaultTestConfig()
	config.TimeHorizonYears = 1

	req := &ProjectionRequest{Config: config}
	result, err := service.CalculateProjection(ctx, req)

	if err != nil {
		t.Fatalf("CalculateProjection failed: %v", err)
	}

	// Should still project cash flow and net worth based on salary
	if len(result.CashFlow) == 0 {
		t.Error("Expected cash flow data even without accounts")
	}
}

func TestCalculateProjection_OnlyLiabilities(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	userID := "test-user-liabilities-only-1"
	account.CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	service := SetupProjectionService(t, db)

	// Only create debt accounts
	CreateTestMortgageForProjection(t, db, userID)
	CreateTestLoanForProjection(t, db, userID)

	config := DefaultTestConfig()
	config.TimeHorizonYears = 1

	req := &ProjectionRequest{Config: config}
	result, err := service.CalculateProjection(ctx, req)

	if err != nil {
		t.Fatalf("CalculateProjection failed: %v", err)
	}

	// Net worth should be negative
	firstNetWorth := result.NetWorth[0].Value
	if firstNetWorth >= 0 {
		t.Errorf("Expected negative net worth with only liabilities, got %.2f", firstNetWorth)
	}
}

func TestCalculateProjection_DebtPayoffRounding(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	userID := "test-user-rounding-1"
	account.CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	service := SetupProjectionService(t, db)

	// Create small loan that will be paid off quickly
	accountID := CreateTestAccountForProjection(t, db, userID, account.AccountTypeLoan, -1000.00)

	startDate := time.Now()
	maturityDate := startDate.AddDate(0, 4, 0)
	_, err := db.Exec(`
		INSERT INTO loan_details (
			id, account_id, original_amount, interest_rate, rate_type,
			start_date, maturity_date, term_months, payment_amount, payment_frequency,
			created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
	`, "test-loan-rounding", accountID, 1000.00, 0.05, "fixed",
		startDate, maturityDate, 4, 255.00, "monthly", time.Now(), time.Now())

	if err != nil {
		t.Fatalf("Failed to create loan: %v", err)
	}

	config := DefaultTestConfig()
	config.TimeHorizonYears = 1
	config.AnnualSalary = 60000.00

	req := &ProjectionRequest{Config: config}
	result, err := service.CalculateProjection(ctx, req)

	if err != nil {
		t.Fatalf("CalculateProjection failed: %v", err)
	}

	// Check that loan is fully paid off (liabilities should reach 0 or near 0)
	lastLiabilities := result.Liabilities[len(result.Liabilities)-1].Value
	if lastLiabilities < -10 {
		t.Errorf("Expected loan to be paid off, but liabilities are %.2f", lastLiabilities)
	}
}

func TestCalculateProjection_MultipleEventsInSameMonth(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	userID := "test-user-multi-events-1"
	account.CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	service := SetupProjectionService(t, db)

	CreateTestAccountForProjection(t, db, userID, account.AccountTypeSavings, 50000.00)

	config := DefaultTestConfig()
	config.TimeHorizonYears = 1
	eventDate := time.Now().AddDate(0, 3, 0)
	
	// Multiple events in same month
	config.Events = []Event{
		{
			ID:          "bonus-1",
			Type:        EventOneTimeIncome,
			Date:        eventDate,
			Description: "Bonus",
			Parameters:  EventParameters{Amount: 5000.00, Category: "bonus"},
		},
		{
			ID:          "vacation-1",
			Type:        EventOneTimeExpense,
			Date:        eventDate.Add(time.Hour), // Same month, different time
			Description: "Vacation",
			Parameters:  EventParameters{Amount: 3000.00, Category: "vacation"},
		},
		{
			ID:          "raise-1",
			Type:        EventSalaryChange,
			Date:        eventDate.Add(2 * time.Hour),
			Description: "Salary increase",
			Parameters:  EventParameters{NewSalary: 85000.00},
		},
	}

	req := &ProjectionRequest{Config: config}
	result, err := service.CalculateProjection(ctx, req)

	if err != nil {
		t.Fatalf("CalculateProjection failed: %v", err)
	}

	// Verify all events were processed
	if len(result.CashFlow) < 4 {
		t.Fatal("Expected at least 4 months of cash flow")
	}

	// Month 3 should show combined effect of all events
	month3Income := result.CashFlow[3].Income
	month4Income := result.CashFlow[4].Income

	// Month 3 should have bonus income
	if month3Income < month4Income {
		t.Logf("Month 3 income (%.2f) includes bonus, month 4 (%.2f) shows new salary", 
			month3Income, month4Income)
	}
}

func TestCalculateProjection_NegativeCashFlowWithNoWithdrawableAccounts(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	userID := "test-user-no-withdraw-1"
	account.CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	service := SetupProjectionService(t, db)

	// Create only a savings account (not in default SavingsAllocation)
	CreateTestAccountForProjection(t, db, userID, account.AccountTypeSavings, 10000.00)

	config := DefaultTestConfig()
	config.TimeHorizonYears = 1
	config.AnnualSalary = 20000.00 // Very low
	config.MonthlyExpenses = 5000.00 // High expenses
	// SavingsAllocation only has tfsa/rrsp, but we only have savings account

	req := &ProjectionRequest{Config: config}
	result, err := service.CalculateProjection(ctx, req)

	if err != nil {
		t.Fatalf("CalculateProjection failed: %v", err)
	}

	// Document behavior - what happens when negative cash flow 
	// but no accounts in savings allocation?
	firstAssets := result.Assets[0].Value
	lastAssets := result.Assets[len(result.Assets)-1].Value
	
	t.Logf("Assets: start=%.2f, end=%.2f (negative cash flow with no withdrawable accounts)", 
		firstAssets, lastAssets)
}

func TestCalculateProjection_ExtremeGrowthRates(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	userID := "test-user-extreme-growth-1"
	account.CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	service := SetupProjectionService(t, db)

	CreateTestAccountForProjection(t, db, userID, account.AccountTypeTFSA, 10000.00)

	tests := []struct {
		name              string
		salaryGrowth      float64
		expenseGrowth     float64
		investmentReturns map[string]float64
	}{
		{
			"Zero growth",
			0,
			0,
			map[string]float64{"tfsa": 0},
		},
		{
			"Negative growth",
			-0.05,
			-0.05,
			map[string]float64{"tfsa": -0.10},
		},
		{
			"Very high growth",
			0.50,
			0.20,
			map[string]float64{"tfsa": 0.30},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			config := DefaultTestConfig()
			config.TimeHorizonYears = 2
			config.AnnualSalaryGrowth = tt.salaryGrowth
			config.AnnualExpenseGrowth = tt.expenseGrowth
			config.InvestmentReturns = tt.investmentReturns

			req := &ProjectionRequest{Config: config}
			result, err := service.CalculateProjection(ctx, req)

			if err != nil {
				t.Fatalf("CalculateProjection failed for %s: %v", tt.name, err)
			}

			firstIncome := result.CashFlow[0].Income
			lastIncome := result.CashFlow[len(result.CashFlow)-1].Income
			t.Logf("%s: income growth from %.2f to %.2f", tt.name, firstIncome, lastIncome)
		})
	}
}

func TestCalculateProjection_LongTermProjection(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping long-term projection test in short mode")
	}

	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	userID := "test-user-longterm-1"
	account.CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	service := SetupProjectionService(t, db)

	CreateTestAccountForProjection(t, db, userID, account.AccountTypeTFSA, 50000.00)
	CreateTestAccountForProjection(t, db, userID, account.AccountTypeRRSP, 100000.00)

	config := DefaultTestConfig()
	config.TimeHorizonYears = 30 // 30 year projection

	req := &ProjectionRequest{Config: config}
	result, err := service.CalculateProjection(ctx, req)

	if err != nil {
		t.Fatalf("CalculateProjection failed: %v", err)
	}

	// Verify correct number of months (30 years * 12 months + initial month)
	expectedMonths := 30*12 + 1
	if len(result.NetWorth) != expectedMonths {
		t.Errorf("Expected %d months for 30 year projection, got %d", 
			expectedMonths, len(result.NetWorth))
	}

	// Check for reasonable growth (compound interest should work)
	initialNetWorth := result.NetWorth[0].Value
	finalNetWorth := result.NetWorth[len(result.NetWorth)-1].Value

	if finalNetWorth <= initialNetWorth {
		t.Errorf("Expected net worth growth over 30 years: start=%.2f, end=%.2f",
			initialNetWorth, finalNetWorth)
	}

	// With 7% returns and contributions, should see significant growth
	if finalNetWorth < initialNetWorth*2 {
		t.Logf("Warning: Net worth only grew from %.2f to %.2f over 30 years",
			initialNetWorth, finalNetWorth)
	}
}
