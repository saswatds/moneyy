package projections

import (
	"testing"
	"time"

	"money/internal/account"
)

func TestCalculateProjection_OneTimeIncomeEvent(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-event-income-1"
	account.CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	service := SetupProjectionService(t, db)

	CreateTestAccountForProjection(t, db, userID, account.AccountTypeSavings, 10000.00)

	config := DefaultTestConfig()
	config.TimeHorizonYears = 1
	config.Events = []Event{
		{
			ID:          "bonus-1",
			Type:        EventOneTimeIncome,
			Date:        time.Now().AddDate(0, 3, 0), // 3 months from now
			Description: "Annual Bonus",
			Parameters: EventParameters{
				Amount:   10000.00,
				Category: "bonus",
			},
		},
	}

	req := &ProjectionRequest{Config: config}

	// Act
	result, err := service.CalculateProjection(ctx, req)

	// Assert
	if err != nil {
		t.Fatalf("CalculateProjection failed: %v", err)
	}

	// Verify income spike in month 4 (index 3)
	if len(result.CashFlow) < 4 {
		t.Fatal("Expected at least 4 months of cash flow")
	}

	month3Income := result.CashFlow[2].Income
	month4Income := result.CashFlow[3].Income // Should have bonus

	if month4Income <= month3Income {
		t.Errorf("Expected income spike in month 4: month3=%.2f, month4=%.2f",
			month3Income, month4Income)
	}

	// Bonus should add approximately $10k to that month's income
	if month4Income < month3Income+9000.00 {
		t.Errorf("Expected ~$10k income increase: month3=%.2f, month4=%.2f, diff=%.2f",
			month3Income, month4Income, month4Income-month3Income)
	}
}

func TestCalculateProjection_OneTimeExpenseEvent(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-event-expense-1"
	account.CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	service := SetupProjectionService(t, db)

	CreateTestAccountForProjection(t, db, userID, account.AccountTypeSavings, 50000.00)

	config := DefaultTestConfig()
	config.TimeHorizonYears = 1
	config.Events = []Event{
		{
			ID:          "vacation-1",
			Type:        EventOneTimeExpense,
			Date:        time.Now().AddDate(0, 6, 0), // 6 months from now
			Description: "Vacation",
			Parameters: EventParameters{
				Amount:   5000.00,
				Category: "travel",
			},
		},
	}

	req := &ProjectionRequest{Config: config}

	// Act
	result, err := service.CalculateProjection(ctx, req)

	// Assert
	if err != nil {
		t.Fatalf("CalculateProjection failed: %v", err)
	}

	// Verify expense spike in month 7 (index 6)
	if len(result.CashFlow) < 7 {
		t.Fatal("Expected at least 7 months of cash flow")
	}

	month6Expenses := result.CashFlow[5].Expenses
	month7Expenses := result.CashFlow[6].Expenses // Should have vacation cost

	if month7Expenses <= month6Expenses {
		t.Errorf("Expected expense spike in month 7: month6=%.2f, month7=%.2f",
			month6Expenses, month7Expenses)
	}

	// Vacation should add $5k to that month's expenses
	if month7Expenses < month6Expenses+4500.00 {
		t.Errorf("Expected ~$5k expense increase: month6=%.2f, month7=%.2f, diff=%.2f",
			month6Expenses, month7Expenses, month7Expenses-month6Expenses)
	}
}

func TestCalculateProjection_SalaryChangeEvent(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-event-salary-1"
	account.CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	service := SetupProjectionService(t, db)

	CreateTestAccountForProjection(t, db, userID, account.AccountTypeSavings, 10000.00)

	config := DefaultTestConfig()
	config.TimeHorizonYears = 2
	config.AnnualSalary = 60000.00
	config.Events = []Event{
		{
			ID:          "promotion-1",
			Type:        EventSalaryChange,
			Date:        time.Now().AddDate(0, 6, 0), // Promotion after 6 months
			Description: "Job Promotion",
			Parameters: EventParameters{
				NewSalary:       80000.00,
				NewSalaryGrowth: 0.05, // 5% annual growth after promotion
			},
		},
	}

	req := &ProjectionRequest{Config: config}

	// Act
	result, err := service.CalculateProjection(ctx, req)

	// Assert
	if err != nil {
		t.Fatalf("CalculateProjection failed: %v", err)
	}

	// Verify income increases after month 7
	if len(result.CashFlow) < 12 {
		t.Fatal("Expected at least 12 months of cash flow")
	}

	beforePromotion := result.CashFlow[5].Income
	afterPromotion := result.CashFlow[7].Income

	if afterPromotion <= beforePromotion {
		t.Errorf("Expected income increase after promotion: before=%.2f, after=%.2f",
			beforePromotion, afterPromotion)
	}

	// Income should increase by roughly 33% (60k -> 80k)
	expectedIncrease := beforePromotion * 0.25
	if afterPromotion < beforePromotion+expectedIncrease {
		t.Errorf("Expected significant income increase: before=%.2f, after=%.2f",
			beforePromotion, afterPromotion)
	}
}

func TestCalculateProjection_ExpenseLevelChangeEvent_Absolute(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-event-expense-change-1"
	account.CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	service := SetupProjectionService(t, db)

	CreateTestAccountForProjection(t, db, userID, account.AccountTypeSavings, 50000.00)

	config := DefaultTestConfig()
	config.TimeHorizonYears = 1
	config.MonthlyExpenses = 3000.00
	config.Events = []Event{
		{
			ID:          "lifestyle-change-1",
			Type:        EventExpenseLevelChange,
			Date:        time.Now().AddDate(0, 4, 0),
			Description: "Moved to cheaper city",
			Parameters: EventParameters{
				NewExpenses:       2000.00,
				ExpenseChangeType: "absolute",
			},
		},
	}

	req := &ProjectionRequest{Config: config}

	// Act
	result, err := service.CalculateProjection(ctx, req)

	// Assert
	if err != nil {
		t.Fatalf("CalculateProjection failed: %v", err)
	}

	// Verify expenses decrease after month 5
	if len(result.CashFlow) < 6 {
		t.Fatal("Expected at least 6 months of cash flow")
	}

	beforeChange := result.CashFlow[3].Expenses
	afterChange := result.CashFlow[5].Expenses

	if afterChange >= beforeChange {
		t.Errorf("Expected expense decrease: before=%.2f, after=%.2f",
			beforeChange, afterChange)
	}
}

func TestCalculateProjection_ExpenseLevelChangeEvent_RelativePercent(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-event-expense-relative-1"
	account.CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	service := SetupProjectionService(t, db)

	CreateTestAccountForProjection(t, db, userID, account.AccountTypeSavings, 50000.00)

	config := DefaultTestConfig()
	config.TimeHorizonYears = 1
	config.MonthlyExpenses = 4000.00
	config.Events = []Event{
		{
			ID:          "expense-cut-1",
			Type:        EventExpenseLevelChange,
			Date:        time.Now().AddDate(0, 3, 0),
			Description: "Reduced spending by 20%",
			Parameters: EventParameters{
				ExpenseChange:     -0.20, // 20% reduction
				ExpenseChangeType: "relative_percent",
			},
		},
	}

	req := &ProjectionRequest{Config: config}

	// Act
	result, err := service.CalculateProjection(ctx, req)

	// Assert
	if err != nil {
		t.Fatalf("CalculateProjection failed: %v", err)
	}

	// Verify 20% expense reduction
	if len(result.CashFlow) < 4 {
		t.Fatal("Expected at least 4 months of cash flow")
	}

	beforeChange := result.CashFlow[2].Expenses
	afterChange := result.CashFlow[3].Expenses

	expectedAfter := beforeChange * 0.80 // 20% reduction
	tolerance := 100.0

	if afterChange < expectedAfter-tolerance || afterChange > expectedAfter+tolerance {
		t.Errorf("Expected ~20%% expense reduction: before=%.2f, after=%.2f, expected=%.2f",
			beforeChange, afterChange, expectedAfter)
	}
}

func TestCalculateProjection_SavingsRateChangeEvent(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-event-savings-1"
	account.CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	service := SetupProjectionService(t, db)

	CreateTestAccountForProjection(t, db, userID, account.AccountTypeChecking, 5000.00)
	CreateTestAccountForProjection(t, db, userID, account.AccountTypeTFSA, 10000.00)
	CreateTestAccountForProjection(t, db, userID, account.AccountTypeRRSP, 10000.00)

	config := DefaultTestConfig()
	config.TimeHorizonYears = 2
	config.MonthlySavingsRate = 0.10 // Start at 10%
	config.Events = []Event{
		{
			ID:          "savings-boost-1",
			Type:        EventSavingsRateChange,
			Date:        time.Now().AddDate(0, 6, 0),
			Description: "Increased savings rate",
			Parameters: EventParameters{
				NewSavingsRate: 0.30, // Increase to 30%
			},
		},
	}

	req := &ProjectionRequest{Config: config}

	// Act
	result, err := service.CalculateProjection(ctx, req)

	// Assert
	if err != nil {
		t.Fatalf("CalculateProjection failed: %v", err)
	}

	// Verify savings rate change is applied
	if len(result.NetWorth) < 18 {
		t.Fatal("Expected at least 18 months of data")
	}

	// The event should cause the savings rate to increase
	// This means more money is invested (going to TFSA/RRSP) after month 6
	// We verify this by checking that net worth in the later months is positive and growing
	month6NetWorth := result.NetWorth[6].Value // When event happens
	month12NetWorth := result.NetWorth[12].Value

	if month12NetWorth <= month6NetWorth {
		t.Errorf("Expected net worth to grow after savings rate increase: month6=%.2f, month12=%.2f",
			month6NetWorth, month12NetWorth)
	}

	// Verify net worth is actually increasing (not just from initial balances)
	if month12NetWorth < 25000.00 { // Started with 25k total
		t.Errorf("Expected net worth to grow from initial amount, got %.2f", month12NetWorth)
	}
}

func TestCalculateProjection_ExtraDebtPaymentEvent(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-event-debt-1"
	account.CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	service := SetupProjectionService(t, db)

	CreateTestAccountForProjection(t, db, userID, account.AccountTypeSavings, 100000.00)
	loanID := CreateTestLoanForProjection(t, db, userID) // -10k loan

	config := DefaultTestConfig()
	config.TimeHorizonYears = 1
	config.Events = []Event{
		{
			ID:          "bonus-payoff-1",
			Type:        EventExtraDebtPayment,
			Date:        time.Now().AddDate(0, 3, 0),
			Description: "Bonus applied to loan",
			Parameters: EventParameters{
				Amount:    5000.00,
				AccountID: loanID,
			},
		},
	}

	req := &ProjectionRequest{Config: config}

	// Act
	result, err := service.CalculateProjection(ctx, req)

	// Assert
	if err != nil {
		t.Fatalf("CalculateProjection failed: %v", err)
	}

	// Verify debt drops significantly in month 4
	if len(result.DebtPayoff) < 4 {
		t.Fatal("Expected at least 4 months of debt data")
	}

	month3Debt := result.DebtPayoff[2].TotalDebt
	month4Debt := result.DebtPayoff[3].TotalDebt

	debtReduction := month3Debt - month4Debt
	if debtReduction < 4500.00 {
		t.Errorf("Expected ~$5k debt reduction: month3=%.2f, month4=%.2f, reduction=%.2f",
			month3Debt, month4Debt, debtReduction)
	}
}

func TestCalculateProjection_RecurringEvent_Monthly(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-recurring-monthly-1"
	account.CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	service := SetupProjectionService(t, db)

	CreateTestAccountForProjection(t, db, userID, account.AccountTypeSavings, 50000.00)

	config := DefaultTestConfig()
	config.TimeHorizonYears = 1
	config.Events = []Event{
		{
			ID:          "rental-income-1",
			Type:        EventOneTimeIncome,
			Date:        time.Now().AddDate(0, 1, 0), // Start month 2
			Description: "Monthly rental income",
			IsRecurring: true,
			Parameters: EventParameters{
				Amount:   2000.00,
				Category: "rental",
			},
			RecurrenceFrequency: "monthly",
		},
	}

	req := &ProjectionRequest{Config: config}

	// Act
	result, err := service.CalculateProjection(ctx, req)

	// Assert
	if err != nil {
		t.Fatalf("CalculateProjection failed: %v", err)
	}

	// Verify recurring income appears in multiple months
	if len(result.CashFlow) < 12 {
		t.Fatal("Expected 12 months of cash flow")
	}

	// Month 1 should not have rental income
	month1Income := result.CashFlow[0].Income
	// Month 2-12 should have recurring rental income
	month2Income := result.CashFlow[1].Income

	if month2Income <= month1Income {
		t.Errorf("Expected recurring income to start in month 2: month1=%.2f, month2=%.2f",
			month1Income, month2Income)
	}

	// Check that income stays elevated for subsequent months
	month6Income := result.CashFlow[5].Income
	if month6Income < month2Income*0.95 {
		t.Errorf("Expected consistent recurring income: month2=%.2f, month6=%.2f",
			month2Income, month6Income)
	}
}

func TestCalculateProjection_RecurringEvent_Quarterly(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-recurring-quarterly-1"
	account.CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	service := SetupProjectionService(t, db)

	CreateTestAccountForProjection(t, db, userID, account.AccountTypeSavings, 50000.00)

	config := DefaultTestConfig()
	config.TimeHorizonYears = 1
	config.Events = []Event{
		{
			ID:          "quarterly-bonus-1",
			Type:        EventOneTimeIncome,
			Date:        time.Now().AddDate(0, 3, 0), // Start Q2
			Description: "Quarterly bonus",
			IsRecurring: true,
			Parameters: EventParameters{
				Amount:   3000.00,
				Category: "bonus",
			},
			RecurrenceFrequency: "quarterly",
		},
	}

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

	// Should see income spikes in months 4, 7, 10 (Q2, Q3, Q4)
	baseIncome := result.CashFlow[1].Income
	q2Income := result.CashFlow[3].Income // Month 4
	q3Income := result.CashFlow[6].Income // Month 7

	if q2Income <= baseIncome {
		t.Errorf("Expected Q2 bonus: base=%.2f, q2=%.2f", baseIncome, q2Income)
	}
	if q3Income <= baseIncome {
		t.Errorf("Expected Q3 bonus: base=%.2f, q3=%.2f", baseIncome, q3Income)
	}
}

func TestCalculateProjection_RecurringEvent_Annually(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-recurring-annually-1"
	account.CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	service := SetupProjectionService(t, db)

	CreateTestAccountForProjection(t, db, userID, account.AccountTypeSavings, 50000.00)

	config := DefaultTestConfig()
	config.TimeHorizonYears = 3
	config.Events = []Event{
		{
			ID:          "annual-bonus-1",
			Type:        EventOneTimeIncome,
			Date:        time.Now().AddDate(0, 12, 0), // Start year 2
			Description: "Annual bonus",
			IsRecurring: true,
			Parameters: EventParameters{
				Amount:   15000.00,
				Category: "bonus",
			},
			RecurrenceFrequency: "annually",
		},
	}

	req := &ProjectionRequest{Config: config}

	// Act
	result, err := service.CalculateProjection(ctx, req)

	// Assert
	if err != nil {
		t.Fatalf("CalculateProjection failed: %v", err)
	}

	if len(result.CashFlow) < 36 {
		t.Fatal("Expected 36 months of cash flow")
	}

	// Should see income spikes in months 13 and 25 (year 2 and 3)
	baseIncome := result.CashFlow[10].Income
	year2Bonus := result.CashFlow[12].Income // Month 13
	year3Bonus := result.CashFlow[24].Income // Month 25

	if year2Bonus <= baseIncome {
		t.Errorf("Expected year 2 bonus: base=%.2f, year2=%.2f", baseIncome, year2Bonus)
	}
	if year3Bonus <= baseIncome {
		t.Errorf("Expected year 3 bonus: base=%.2f, year3=%.2f", baseIncome, year3Bonus)
	}
}

func TestCalculateProjection_RecurringEvent_WithEndDate(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-recurring-end-1"
	account.CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	service := SetupProjectionService(t, db)

	CreateTestAccountForProjection(t, db, userID, account.AccountTypeSavings, 50000.00)

	endDate := time.Now().AddDate(0, 6, 0) // Recur for 6 months only
	config := DefaultTestConfig()
	config.TimeHorizonYears = 1
	config.Events = []Event{
		{
			ID:          "temp-income-1",
			Type:        EventOneTimeIncome,
			Date:        time.Now().AddDate(0, 1, 0),
			Description: "Temporary side income",
			IsRecurring: true,
			Parameters: EventParameters{
				Amount:   1000.00,
				Category: "side_hustle",
			},
			RecurrenceFrequency: "monthly",
			RecurrenceEndDate:   &endDate,
		},
	}

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

	// Should have extra income in months 2-6 (index 1-5)
	baseIncome := result.CashFlow[0].Income
	month3Income := result.CashFlow[2].Income // Should have extra
	month8Income := result.CashFlow[7].Income // Should NOT have extra (after end date)

	if month3Income <= baseIncome {
		t.Errorf("Expected extra income in month 3: base=%.2f, month3=%.2f",
			baseIncome, month3Income)
	}

	// Month 8 should not have the recurring income anymore
	tolerance := 500.0
	if month8Income > baseIncome+tolerance {
		t.Errorf("Expected recurring income to stop by month 8: base=%.2f, month8=%.2f",
			baseIncome, month8Income)
	}
}

func TestCalculateProjection_MultipleEvents(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-multi-events-1"
	account.CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	service := SetupProjectionService(t, db)

	CreateTestAccountForProjection(t, db, userID, account.AccountTypeSavings, 50000.00)
	CreateTestAccountForProjection(t, db, userID, account.AccountTypeTFSA, 30000.00)

	config := DefaultTestConfig()
	config.TimeHorizonYears = 2
	config.AnnualSalary = 60000.00
	config.Events = []Event{
		{
			ID:          "promotion-1",
			Type:        EventSalaryChange,
			Date:        time.Now().AddDate(0, 6, 0),
			Description: "Promotion",
			Parameters: EventParameters{
				NewSalary:       80000.00,
				NewSalaryGrowth: 0.05,
			},
		},
		{
			ID:          "bonus-1",
			Type:        EventOneTimeIncome,
			Date:        time.Now().AddDate(0, 12, 0),
			Description: "Year-end bonus",
			Parameters: EventParameters{
				Amount:   10000.00,
				Category: "bonus",
			},
		},
		{
			ID:          "vacation-1",
			Type:        EventOneTimeExpense,
			Date:        time.Now().AddDate(0, 8, 0),
			Description: "Vacation",
			Parameters: EventParameters{
				Amount:   5000.00,
				Category: "travel",
			},
		},
	}

	req := &ProjectionRequest{Config: config}

	// Act
	result, err := service.CalculateProjection(ctx, req)

	// Assert
	if err != nil {
		t.Fatalf("CalculateProjection failed: %v", err)
	}

	if len(result.CashFlow) < 24 {
		t.Fatal("Expected 24 months of cash flow")
	}

	// Verify all events had impact
	// 1. Salary increase after month 6
	beforePromotion := result.CashFlow[5].Income
	afterPromotion := result.CashFlow[7].Income
	if afterPromotion <= beforePromotion {
		t.Error("Expected promotion to increase income")
	}

	// 2. Bonus in month 13
	month12Income := result.CashFlow[11].Income
	month13Income := result.CashFlow[12].Income
	if month13Income <= month12Income {
		t.Error("Expected bonus to show in month 13")
	}

	// 3. Vacation expense in month 9
	month8Expenses := result.CashFlow[7].Expenses
	month9Expenses := result.CashFlow[8].Expenses
	if month9Expenses <= month8Expenses {
		t.Error("Expected vacation expense in month 9")
	}
}
