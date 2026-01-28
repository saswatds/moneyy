package account

import (
	"testing"
	"time"
)

func TestCreateMortgageDetails_Success(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-mortgage-1"
	CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	accountID := CreateTestAccount(t, db, userID, AccountTypeMortgage)
	service := SetupAccountService(t, db)

	paymentDay := 1
	propertyValue := 500000.00
	req := &CreateMortgageDetailsRequest{
		AccountID:          accountID,
		OriginalAmount:     400000.00,
		InterestRate:       0.03,
		RateType:           "fixed",
		StartDate:          Date{Time: time.Now()},
		TermMonths:         60,
		AmortizationMonths: 300,
		PaymentAmount:      1896.00,
		PaymentFrequency:   "monthly",
		PaymentDay:         &paymentDay,
		PropertyAddress:    "123 Main St",
		PropertyCity:       "Toronto",
		PropertyProvince:   "ON",
		PropertyPostalCode: "M1A 1A1",
		PropertyValue:      &propertyValue,
		Lender:             "Test Bank",
	}

	// Act
	details, err := service.CreateMortgageDetails(ctx, accountID, req)

	// Assert
	if err != nil {
		t.Fatalf("CreateMortgageDetails failed: %v", err)
	}
	if details == nil {
		t.Fatal("Expected mortgage details, got nil")
	}
	if details.OriginalAmount != 400000.00 {
		t.Errorf("Expected amount 400000.00, got %f", details.OriginalAmount)
	}
	if details.InterestRate != 0.03 {
		t.Errorf("Expected rate 0.03, got %f", details.InterestRate)
	}
	if details.TermMonths != 60 {
		t.Errorf("Expected term 60, got %d", details.TermMonths)
	}
	if details.PropertyAddress != "123 Main St" {
		t.Errorf("Expected address '123 Main St', got '%s'", details.PropertyAddress)
	}
}

func TestCreateMortgageDetails_UnauthorizedAccess(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	owner := "test-user-owner-mortgage-1"
	attacker := "test-user-attacker-mortgage-1"
	CreateTestUser(t, db, owner)
	CreateTestUser(t, db, attacker)
	accountID := CreateTestAccount(t, db, owner, AccountTypeMortgage)
	service := SetupAccountService(t, db)

	req := &CreateMortgageDetailsRequest{
		AccountID:          accountID,
		OriginalAmount:     400000.00,
		InterestRate:       0.03,
		RateType:           "fixed",
		StartDate:          Date{Time: time.Now()},
		TermMonths:         60,
		AmortizationMonths: 300,
		PaymentAmount:      1896.00,
		PaymentFrequency:   "monthly",
	}

	// Act - attacker tries to create mortgage details for owner's account
	ctx := CreateAuthContext(attacker)
	details, err := service.CreateMortgageDetails(ctx, accountID, req)

	// Assert
	if err == nil {
		t.Fatal("Expected error for unauthorized access, got nil")
	}
	if details != nil {
		t.Error("Expected nil details for unauthorized access")
	}
}

func TestGetMortgageDetails_Success(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-mortgage-get-1"
	CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	accountID := CreateTestAccount(t, db, userID, AccountTypeMortgage)
	service := SetupAccountService(t, db)

	// Create mortgage
	service.CreateMortgageDetails(ctx, accountID, &CreateMortgageDetailsRequest{
		AccountID:          accountID,
		OriginalAmount:     400000.00,
		InterestRate:       0.03,
		RateType:           "fixed",
		StartDate:          Date{Time: time.Now()},
		TermMonths:         60,
		AmortizationMonths: 300,
		PaymentAmount:      1896.00,
		PaymentFrequency:   "monthly",
	})

	// Act
	details, err := service.GetMortgageDetails(ctx, accountID)

	// Assert
	if err != nil {
		t.Fatalf("GetMortgageDetails failed: %v", err)
	}
	if details == nil {
		t.Fatal("Expected mortgage details, got nil")
	}
	if details.AccountID != accountID {
		t.Errorf("Expected accountID %s, got %s", accountID, details.AccountID)
	}
}

func TestGetMortgageDetails_UnauthorizedAccess(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	owner := "test-user-owner-mortgage-2"
	attacker := "test-user-attacker-mortgage-2"
	CreateTestUser(t, db, owner)
	CreateTestUser(t, db, attacker)
	accountID := CreateTestAccount(t, db, owner, AccountTypeMortgage)
	service := SetupAccountService(t, db)

	// Create mortgage for owner
	ownerCtx := CreateAuthContext(owner)
	service.CreateMortgageDetails(ownerCtx, accountID, &CreateMortgageDetailsRequest{
		AccountID:          accountID,
		OriginalAmount:     400000.00,
		InterestRate:       0.03,
		RateType:           "fixed",
		StartDate:          Date{Time: time.Now()},
		TermMonths:         60,
		AmortizationMonths: 300,
		PaymentAmount:      1896.00,
		PaymentFrequency:   "monthly",
	})

	// Act - attacker tries to get owner's mortgage details
	attackerCtx := CreateAuthContext(attacker)
	details, err := service.GetMortgageDetails(attackerCtx, accountID)

	// Assert
	if err == nil {
		t.Fatal("Expected error for unauthorized access, got nil")
	}
	if details != nil {
		t.Error("Expected nil details for unauthorized access")
	}
}

func TestGetAmortizationSchedule_Success(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-mortgage-schedule-1"
	CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	accountID := CreateTestAccount(t, db, userID, AccountTypeMortgage)
	service := SetupAccountService(t, db)

	// Create mortgage
	service.CreateMortgageDetails(ctx, accountID, &CreateMortgageDetailsRequest{
		AccountID:          accountID,
		OriginalAmount:     100000.00,
		InterestRate:       0.05,
		RateType:           "fixed",
		StartDate:          Date{Time: time.Now()},
		TermMonths:         60,
		AmortizationMonths: 120,
		PaymentAmount:      1061.00,
		PaymentFrequency:   "monthly",
	})

	// Act
	schedule, err := service.GetAmortizationSchedule(ctx, accountID)

	// Assert
	if err != nil {
		t.Fatalf("GetAmortizationSchedule failed: %v", err)
	}
	if schedule == nil {
		t.Fatal("Expected schedule, got nil")
	}
	if len(schedule.Schedule) == 0 {
		t.Error("Expected non-empty schedule")
	}
}

func TestRecordMortgagePayment_Success(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-mortgage-payment-1"
	CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	accountID := CreateTestAccount(t, db, userID, AccountTypeMortgage)
	service := SetupAccountService(t, db)

	// Create mortgage
	service.CreateMortgageDetails(ctx, accountID, &CreateMortgageDetailsRequest{
		AccountID:          accountID,
		OriginalAmount:     400000.00,
		InterestRate:       0.03,
		RateType:           "fixed",
		StartDate:          Date{Time: time.Now()},
		TermMonths:         60,
		AmortizationMonths: 300,
		PaymentAmount:      1896.00,
		PaymentFrequency:   "monthly",
	})

	// Record payment
	paymentReq := &CreateMortgagePaymentRequest{
		AccountID:       accountID,
		PaymentDate:     Date{Time: time.Now()},
		PaymentAmount:   1896.00,
		PrincipalAmount: 896.00,
		InterestAmount:  1000.00,
		ExtraPayment:    0,
	}

	// Act
	payment, err := service.RecordMortgagePayment(ctx, accountID, paymentReq)

	// Assert
	if err != nil {
		t.Fatalf("RecordMortgagePayment failed: %v", err)
	}
	if payment == nil {
		t.Fatal("Expected payment, got nil")
	}
	if payment.PaymentAmount != 1896.00 {
		t.Errorf("Expected payment amount 1896.00, got %f", payment.PaymentAmount)
	}
	if payment.PrincipalAmount != 896.00 {
		t.Errorf("Expected principal 896.00, got %f", payment.PrincipalAmount)
	}
}

func TestRecordMortgagePayment_UnauthorizedAccess(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	owner := "test-user-owner-mortgage-payment-1"
	attacker := "test-user-attacker-mortgage-payment-1"
	CreateTestUser(t, db, owner)
	CreateTestUser(t, db, attacker)
	accountID := CreateTestAccount(t, db, owner, AccountTypeMortgage)
	service := SetupAccountService(t, db)

	// Create mortgage for owner
	ownerCtx := CreateAuthContext(owner)
	service.CreateMortgageDetails(ownerCtx, accountID, &CreateMortgageDetailsRequest{
		AccountID:          accountID,
		OriginalAmount:     400000.00,
		InterestRate:       0.03,
		RateType:           "fixed",
		StartDate:          Date{Time: time.Now()},
		TermMonths:         60,
		AmortizationMonths: 300,
		PaymentAmount:      1896.00,
		PaymentFrequency:   "monthly",
	})

	// Act - attacker tries to record payment
	attackerCtx := CreateAuthContext(attacker)
	paymentReq := &CreateMortgagePaymentRequest{
		AccountID:       accountID,
		PaymentDate:     Date{Time: time.Now()},
		PaymentAmount:   1896.00,
		PrincipalAmount: 896.00,
		InterestAmount:  1000.00,
		ExtraPayment:    0,
	}
	payment, err := service.RecordMortgagePayment(attackerCtx, accountID, paymentReq)

	// Assert
	if err == nil {
		t.Fatal("Expected error for unauthorized access, got nil")
	}
	if payment != nil {
		t.Error("Expected nil payment for unauthorized access")
	}
}

func TestGetMortgagePayments_Success(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-mortgage-payments-1"
	CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	accountID := CreateTestAccount(t, db, userID, AccountTypeMortgage)
	service := SetupAccountService(t, db)

	// Create mortgage
	service.CreateMortgageDetails(ctx, accountID, &CreateMortgageDetailsRequest{
		AccountID:          accountID,
		OriginalAmount:     400000.00,
		InterestRate:       0.03,
		RateType:           "fixed",
		StartDate:          Date{Time: time.Now()},
		TermMonths:         60,
		AmortizationMonths: 300,
		PaymentAmount:      1896.00,
		PaymentFrequency:   "monthly",
	})

	// Record multiple payments
	for i := 0; i < 3; i++ {
		service.RecordMortgagePayment(ctx, accountID, &CreateMortgagePaymentRequest{
			AccountID:       accountID,
			PaymentDate:     Date{Time: time.Now().AddDate(0, i, 0)},
			PaymentAmount:   1896.00,
			PrincipalAmount: 896.00,
			InterestAmount:  1000.00,
			ExtraPayment:    0,
		})
	}

	// Act
	payments, err := service.GetMortgagePayments(ctx, accountID)

	// Assert
	if err != nil {
		t.Fatalf("GetMortgagePayments failed: %v", err)
	}
	if payments == nil {
		t.Fatal("Expected payments, got nil")
	}
	if len(payments.Payments) != 3 {
		t.Errorf("Expected 3 payments, got %d", len(payments.Payments))
	}
}

func TestGetMortgagePayments_UnauthorizedAccess(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	owner := "test-user-owner-mortgage-payments-1"
	attacker := "test-user-attacker-mortgage-payments-1"
	CreateTestUser(t, db, owner)
	CreateTestUser(t, db, attacker)
	accountID := CreateTestAccount(t, db, owner, AccountTypeMortgage)
	service := SetupAccountService(t, db)

	// Create mortgage for owner
	ownerCtx := CreateAuthContext(owner)
	service.CreateMortgageDetails(ownerCtx, accountID, &CreateMortgageDetailsRequest{
		AccountID:          accountID,
		OriginalAmount:     400000.00,
		InterestRate:       0.03,
		RateType:           "fixed",
		StartDate:          Date{Time: time.Now()},
		TermMonths:         60,
		AmortizationMonths: 300,
		PaymentAmount:      1896.00,
		PaymentFrequency:   "monthly",
	})

	// Act - attacker tries to get payments
	attackerCtx := CreateAuthContext(attacker)
	payments, err := service.GetMortgagePayments(attackerCtx, accountID)

	// Assert
	if err == nil {
		t.Fatal("Expected error for unauthorized access, got nil")
	}
	if payments != nil {
		t.Error("Expected nil payments for unauthorized access")
	}
}

func TestSyncMortgageBalance_Success(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-mortgage-sync-1"
	CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	accountID := CreateTestAccount(t, db, userID, AccountTypeMortgage)
	service := SetupAccountService(t, db)

	// Create mortgage
	service.CreateMortgageDetails(ctx, accountID, &CreateMortgageDetailsRequest{
		AccountID:          accountID,
		OriginalAmount:     400000.00,
		InterestRate:       0.03,
		RateType:           "fixed",
		StartDate:          Date{Time: time.Now()},
		TermMonths:         60,
		AmortizationMonths: 300,
		PaymentAmount:      1896.00,
		PaymentFrequency:   "monthly",
	})

	// Act
	err := service.SyncMortgageBalance(ctx, accountID)

	// Assert
	if err != nil {
		t.Fatalf("SyncMortgageBalance failed: %v", err)
	}
}
