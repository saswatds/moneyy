package account

import (
	"testing"
	"time"
)

func TestCreateEquityGrant_Success(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-grant-1"
	CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	accountID := CreateTestAccount(t, db, userID, AccountTypeStockOptions)
	service := SetupAccountService(t, db)

	strikePrice := 10.00
	req := &CreateEquityGrantRequest{
		AccountID:   accountID,
		GrantType:   GrantTypeISO,
		GrantDate:   Date{Time: time.Now()},
		Quantity:    1000,
		StrikePrice: &strikePrice,
		FMVAtGrant:  15.00,
		CompanyName: "Test Corp",
		Currency:    "USD",
	}

	// Act
	grant, err := service.CreateEquityGrant(ctx, accountID, req)

	// Assert
	if err != nil {
		t.Fatalf("CreateEquityGrant failed: %v", err)
	}
	if grant == nil {
		t.Fatal("Expected grant, got nil")
	}
	if grant.Quantity != 1000 {
		t.Errorf("Expected quantity 1000, got %d", grant.Quantity)
	}
	if grant.CompanyName != "Test Corp" {
		t.Errorf("Expected company 'Test Corp', got '%s'", grant.CompanyName)
	}
	if grant.ID == "" {
		t.Error("Expected non-empty grant ID")
	}
}

func TestCreateEquityGrant_UnauthorizedAccess(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	owner := "test-user-owner-grant-1"
	attacker := "test-user-attacker-grant-1"
	CreateTestUser(t, db, owner)
	CreateTestUser(t, db, attacker)
	accountID := CreateTestAccount(t, db, owner, AccountTypeStockOptions)
	service := SetupAccountService(t, db)

	strikePrice := 10.00
	req := &CreateEquityGrantRequest{
		AccountID:   accountID,
		GrantType:   GrantTypeISO,
		GrantDate:   Date{Time: time.Now()},
		Quantity:    1000,
		StrikePrice: &strikePrice,
		FMVAtGrant:  15.00,
		CompanyName: "Test Corp",
		Currency:    "USD",
	}

	// Act
	ctx := CreateAuthContext(attacker)
	grant, err := service.CreateEquityGrant(ctx, accountID, req)

	// Assert
	if err == nil {
		t.Fatal("Expected error for unauthorized access, got nil")
	}
	if grant != nil {
		t.Error("Expected nil grant for unauthorized access")
	}
}

func TestSetVestingSchedule_Success(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-vesting-1"
	CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	accountID := CreateTestAccount(t, db, userID, AccountTypeStockOptions)
	service := SetupAccountService(t, db)

	// Create grant first
	strikePrice := 10.00
	grant, _ := service.CreateEquityGrant(ctx, accountID, &CreateEquityGrantRequest{
		AccountID:   accountID,
		GrantType:   GrantTypeISO,
		GrantDate:   Date{Time: time.Now()},
		Quantity:    1000,
		StrikePrice: &strikePrice,
		FMVAtGrant:  15.00,
		CompanyName: "Test Corp",
		Currency:    "USD",
	})

	// Set vesting schedule
	cliffMonths := 12
	totalMonths := 48
	frequency := "monthly"
	req := &SetVestingScheduleRequest{
		GrantID:            grant.ID,
		ScheduleType:       "time_based",
		CliffMonths:        &cliffMonths,
		TotalVestingMonths: &totalMonths,
		VestingFrequency:   &frequency,
	}

	// Act
	schedule, err := service.SetVestingSchedule(ctx, grant.ID, req)

	// Assert
	if err != nil {
		t.Fatalf("SetVestingSchedule failed: %v", err)
	}
	if schedule == nil {
		t.Fatal("Expected schedule, got nil")
	}
	if *schedule.CliffMonths != 12 {
		t.Errorf("Expected cliff 12 months, got %d", *schedule.CliffMonths)
	}
	if *schedule.TotalVestingMonths != 48 {
		t.Errorf("Expected total 48 months, got %d", *schedule.TotalVestingMonths)
	}
}

func TestRecordExercise_Success(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-exercise-1"
	CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	accountID := CreateTestAccount(t, db, userID, AccountTypeStockOptions)
	service := SetupAccountService(t, db)

	// Create grant
	strikePrice := 10.00
	grant, _ := service.CreateEquityGrant(ctx, accountID, &CreateEquityGrantRequest{
		AccountID:   accountID,
		GrantType:   GrantTypeISO,
		GrantDate:   Date{Time: time.Now().AddDate(-2, 0, 0)},
		Quantity:    1000,
		StrikePrice: &strikePrice,
		FMVAtGrant:  15.00,
		CompanyName: "Test Corp",
		Currency:    "USD",
	})

	req := &RecordExerciseRequest{
		GrantID:       grant.ID,
		ExerciseDate:  Date{Time: time.Now()},
		Quantity:      100,
		FMVAtExercise: 25.00,
	}

	// Act
	exercise, err := service.RecordExercise(ctx, grant.ID, req)

	// Assert
	if err != nil {
		t.Fatalf("RecordExercise failed: %v", err)
	}
	if exercise == nil {
		t.Fatal("Expected exercise, got nil")
	}
	if exercise.Quantity != 100 {
		t.Errorf("Expected quantity 100, got %d", exercise.Quantity)
	}
	if exercise.StrikePrice != 10.00 {
		t.Errorf("Expected strike price 10.00, got %f", exercise.StrikePrice)
	}
	// Exercise cost = 100 * 10.00 = 1000
	if exercise.ExerciseCost != 1000.00 {
		t.Errorf("Expected exercise cost 1000, got %f", exercise.ExerciseCost)
	}
	// Taxable benefit = 100 * (25 - 10) = 1500
	if exercise.TaxableBenefit != 1500.00 {
		t.Errorf("Expected taxable benefit 1500, got %f", exercise.TaxableBenefit)
	}
}

func TestRecordExercise_RSUNotAllowed(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-exercise-rsu-1"
	CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	accountID := CreateTestAccount(t, db, userID, AccountTypeStockOptions)
	service := SetupAccountService(t, db)

	// Create RSU grant (no strike price needed)
	grant, _ := service.CreateEquityGrant(ctx, accountID, &CreateEquityGrantRequest{
		AccountID:   accountID,
		GrantType:   GrantTypeRSU,
		GrantDate:   Date{Time: time.Now()},
		Quantity:    1000,
		FMVAtGrant:  15.00,
		CompanyName: "Test Corp",
		Currency:    "USD",
	})

	req := &RecordExerciseRequest{
		GrantID:       grant.ID,
		ExerciseDate:  Date{Time: time.Now()},
		Quantity:      100,
		FMVAtExercise: 25.00,
	}

	// Act
	exercise, err := service.RecordExercise(ctx, grant.ID, req)

	// Assert - should fail because RSUs can't be exercised
	if err == nil {
		t.Fatal("Expected error for RSU exercise, got nil")
	}
	if exercise != nil {
		t.Error("Expected nil exercise for RSU")
	}
}

func TestRecordSale_Success(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-sale-1"
	CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	accountID := CreateTestAccount(t, db, userID, AccountTypeStockOptions)
	service := SetupAccountService(t, db)

	req := &RecordSaleRequest{
		AccountID: accountID,
		SaleDate:  Date{Time: time.Now()},
		Quantity:  50,
		SalePrice: 30.00,
		CostBasis: 500.00,
	}

	// Act
	sale, err := service.RecordSale(ctx, accountID, req)

	// Assert
	if err != nil {
		t.Fatalf("RecordSale failed: %v", err)
	}
	if sale == nil {
		t.Fatal("Expected sale, got nil")
	}
	if sale.Quantity != 50 {
		t.Errorf("Expected quantity 50, got %d", sale.Quantity)
	}
	// Total proceeds = 50 * 30 = 1500
	if sale.TotalProceeds != 1500.00 {
		t.Errorf("Expected total proceeds 1500, got %f", sale.TotalProceeds)
	}
	// Capital gain = 1500 - 500 = 1000
	if sale.CapitalGain != 1000.00 {
		t.Errorf("Expected capital gain 1000, got %f", sale.CapitalGain)
	}
}

func TestRecordSale_UnauthorizedAccess(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	owner := "test-user-owner-sale-1"
	attacker := "test-user-attacker-sale-1"
	CreateTestUser(t, db, owner)
	CreateTestUser(t, db, attacker)
	accountID := CreateTestAccount(t, db, owner, AccountTypeStockOptions)
	service := SetupAccountService(t, db)

	req := &RecordSaleRequest{
		AccountID: accountID,
		SaleDate:  Date{Time: time.Now()},
		Quantity:  50,
		SalePrice: 30.00,
		CostBasis: 500.00,
	}

	// Act
	ctx := CreateAuthContext(attacker)
	sale, err := service.RecordSale(ctx, accountID, req)

	// Assert
	if err == nil {
		t.Fatal("Expected error for unauthorized access, got nil")
	}
	if sale != nil {
		t.Error("Expected nil sale for unauthorized access")
	}
}

func TestRecordFMV_Success(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-fmv-1"
	CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	accountID := CreateTestAccount(t, db, userID, AccountTypeStockOptions)
	service := SetupAccountService(t, db)

	req := &RecordFMVRequest{
		AccountID:     accountID,
		Currency:      "USD",
		EffectiveDate: Date{Time: time.Now()},
		FMVPerShare:   50.00,
	}

	// Act
	fmv, err := service.RecordFMV(ctx, accountID, req)

	// Assert
	if err != nil {
		t.Fatalf("RecordFMV failed: %v", err)
	}
	if fmv == nil {
		t.Fatal("Expected FMV entry, got nil")
	}
	if fmv.FMVPerShare != 50.00 {
		t.Errorf("Expected FMV 50.00, got %f", fmv.FMVPerShare)
	}
	if fmv.Currency != "USD" {
		t.Errorf("Expected currency USD, got %s", fmv.Currency)
	}
}

func TestRecordFMV_Upsert(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-fmv-upsert-1"
	CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	accountID := CreateTestAccount(t, db, userID, AccountTypeStockOptions)
	service := SetupAccountService(t, db)

	effectiveDate := Date{Time: time.Now()}

	// Create first FMV
	service.RecordFMV(ctx, accountID, &RecordFMVRequest{
		AccountID:     accountID,
		Currency:      "USD",
		EffectiveDate: effectiveDate,
		FMVPerShare:   50.00,
	})

	// Update FMV for same date
	req := &RecordFMVRequest{
		AccountID:     accountID,
		Currency:      "USD",
		EffectiveDate: effectiveDate,
		FMVPerShare:   75.00,
	}

	// Act
	fmv, err := service.RecordFMV(ctx, accountID, req)

	// Assert
	if err != nil {
		t.Fatalf("RecordFMV upsert failed: %v", err)
	}
	if fmv == nil {
		t.Fatal("Expected FMV entry, got nil")
	}
	if fmv.FMVPerShare != 75.00 {
		t.Errorf("Expected updated FMV 75.00, got %f", fmv.FMVPerShare)
	}
}

func TestGetOptionsSummary_Success(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-summary-1"
	CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	accountID := CreateTestAccount(t, db, userID, AccountTypeStockOptions)
	service := SetupAccountService(t, db)

	// Create multiple grants
	strikePrice := 10.00
	service.CreateEquityGrant(ctx, accountID, &CreateEquityGrantRequest{
		AccountID:   accountID,
		GrantType:   GrantTypeISO,
		GrantDate:   Date{Time: time.Now()},
		Quantity:    1000,
		StrikePrice: &strikePrice,
		FMVAtGrant:  15.00,
		CompanyName: "Test Corp",
		Currency:    "USD",
	})

	service.CreateEquityGrant(ctx, accountID, &CreateEquityGrantRequest{
		AccountID:   accountID,
		GrantType:   GrantTypeRSU,
		GrantDate:   Date{Time: time.Now()},
		Quantity:    500,
		FMVAtGrant:  20.00,
		CompanyName: "Test Corp",
		Currency:    "USD",
	})

	// Act
	summary, err := service.GetOptionsSummary(ctx, accountID)

	// Assert
	if err != nil {
		t.Fatalf("GetOptionsSummary failed: %v", err)
	}
	if summary == nil {
		t.Fatal("Expected summary, got nil")
	}
	if summary.TotalGrants != 2 {
		t.Errorf("Expected 2 grants, got %d", summary.TotalGrants)
	}
	if summary.TotalShares != 1500 {
		t.Errorf("Expected 1500 total shares, got %d", summary.TotalShares)
	}
}
