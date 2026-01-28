package account

import (
	"testing"
	"time"
)

func TestCreateLoanDetails_Success(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-loan-1"
	CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	accountID := CreateTestAccount(t, db, userID, AccountTypeLoan)
	service := SetupAccountService(t, db)

	paymentDay := 15
	req := &CreateLoanDetailsRequest{
		AccountID:        accountID,
		OriginalAmount:   10000.00,
		InterestRate:     0.05,
		RateType:         "fixed",
		StartDate:        Date{Time: time.Now()},
		TermMonths:       36,
		PaymentAmount:    299.71,
		PaymentFrequency: "monthly",
		PaymentDay:       &paymentDay,
		LoanType:         "personal",
		Lender:           "Test Bank",
	}

	// Act
	details, err := service.CreateLoanDetails(ctx, accountID, req)

	// Assert
	if err != nil {
		t.Fatalf("CreateLoanDetails failed: %v", err)
	}
	if details == nil {
		t.Fatal("Expected loan details, got nil")
	}
	if details.OriginalAmount != 10000.00 {
		t.Errorf("Expected amount 10000.00, got %f", details.OriginalAmount)
	}
	if details.InterestRate != 0.05 {
		t.Errorf("Expected rate 0.05, got %f", details.InterestRate)
	}
	if details.TermMonths != 36 {
		t.Errorf("Expected term 36, got %d", details.TermMonths)
	}
}

func TestCreateLoanDetails_UnauthorizedAccess(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	owner := "test-user-owner-loan-1"
	attacker := "test-user-attacker-loan-1"
	CreateTestUser(t, db, owner)
	CreateTestUser(t, db, attacker)
	accountID := CreateTestAccount(t, db, owner, AccountTypeLoan)
	service := SetupAccountService(t, db)

	req := &CreateLoanDetailsRequest{
		AccountID:        accountID,
		OriginalAmount:   10000.00,
		InterestRate:     0.05,
		RateType:         "fixed",
		StartDate:        Date{Time: time.Now()},
		TermMonths:       36,
		PaymentAmount:    299.71,
		PaymentFrequency: "monthly",
	}

	// Act - attacker tries to create loan details for owner's account
	ctx := CreateAuthContext(attacker)
	details, err := service.CreateLoanDetails(ctx, accountID, req)

	// Assert
	if err == nil {
		t.Fatal("Expected error for unauthorized access, got nil")
	}
	if details != nil {
		t.Error("Expected nil details for unauthorized access")
	}
}

func TestGetLoanDetails_Success(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-loan-get-1"
	CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	accountID := CreateTestAccount(t, db, userID, AccountTypeLoan)
	service := SetupAccountService(t, db)

	// Create loan
	service.CreateLoanDetails(ctx, accountID, &CreateLoanDetailsRequest{
		AccountID:        accountID,
		OriginalAmount:   10000.00,
		InterestRate:     0.05,
		RateType:         "fixed",
		StartDate:        Date{Time: time.Now()},
		TermMonths:       36,
		PaymentAmount:    299.71,
		PaymentFrequency: "monthly",
	})

	// Act
	details, err := service.GetLoanDetails(ctx, accountID)

	// Assert
	if err != nil {
		t.Fatalf("GetLoanDetails failed: %v", err)
	}
	if details == nil {
		t.Fatal("Expected loan details, got nil")
	}
	if details.AccountID != accountID {
		t.Errorf("Expected accountID %s, got %s", accountID, details.AccountID)
	}
}

func TestGetLoanDetails_UnauthorizedAccess(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	owner := "test-user-owner-loan-2"
	attacker := "test-user-attacker-loan-2"
	CreateTestUser(t, db, owner)
	CreateTestUser(t, db, attacker)
	accountID := CreateTestAccount(t, db, owner, AccountTypeLoan)
	service := SetupAccountService(t, db)

	// Create loan for owner
	ownerCtx := CreateAuthContext(owner)
	service.CreateLoanDetails(ownerCtx, accountID, &CreateLoanDetailsRequest{
		AccountID:        accountID,
		OriginalAmount:   10000.00,
		InterestRate:     0.05,
		RateType:         "fixed",
		StartDate:        Date{Time: time.Now()},
		TermMonths:       36,
		PaymentAmount:    299.71,
		PaymentFrequency: "monthly",
	})

	// Act - attacker tries to get owner's loan details
	attackerCtx := CreateAuthContext(attacker)
	details, err := service.GetLoanDetails(attackerCtx, accountID)

	// Assert
	if err == nil {
		t.Fatal("Expected error for unauthorized access, got nil")
	}
	if details != nil {
		t.Error("Expected nil details for unauthorized access")
	}
}

func TestGetLoanAmortizationSchedule_Success(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-loan-schedule-1"
	CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	accountID := CreateTestAccount(t, db, userID, AccountTypeLoan)
	service := SetupAccountService(t, db)

	// Create loan
	service.CreateLoanDetails(ctx, accountID, &CreateLoanDetailsRequest{
		AccountID:        accountID,
		OriginalAmount:   10000.00,
		InterestRate:     0.05,
		RateType:         "fixed",
		StartDate:        Date{Time: time.Now()},
		TermMonths:       12,
		PaymentAmount:    856.07,
		PaymentFrequency: "monthly",
	})

	// Act
	schedule, err := service.GetLoanAmortizationSchedule(ctx, accountID)

	// Assert
	if err != nil {
		t.Fatalf("GetLoanAmortizationSchedule failed: %v", err)
	}
	if schedule == nil {
		t.Fatal("Expected schedule, got nil")
	}
	if len(schedule.Schedule) == 0 {
		t.Error("Expected non-empty schedule")
	}
	// Verify schedule has approximately correct number of payments
	if len(schedule.Schedule) < 10 || len(schedule.Schedule) > 15 {
		t.Errorf("Expected around 12 payments, got %d", len(schedule.Schedule))
	}
}

func TestRecordLoanPayment_Success(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-loan-payment-1"
	CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	accountID := CreateTestAccount(t, db, userID, AccountTypeLoan)
	service := SetupAccountService(t, db)

	// Create loan
	service.CreateLoanDetails(ctx, accountID, &CreateLoanDetailsRequest{
		AccountID:        accountID,
		OriginalAmount:   10000.00,
		InterestRate:     0.05,
		RateType:         "fixed",
		StartDate:        Date{Time: time.Now()},
		TermMonths:       36,
		PaymentAmount:    299.71,
		PaymentFrequency: "monthly",
	})

	// Record payment
	paymentReq := &CreateLoanPaymentRequest{
		AccountID:       accountID,
		PaymentDate:     Date{Time: time.Now()},
		PaymentAmount:   299.71,
		PrincipalAmount: 258.04,
		InterestAmount:  41.67,
		ExtraPayment:    0,
	}

	// Act
	payment, err := service.RecordLoanPayment(ctx, accountID, paymentReq)

	// Assert
	if err != nil {
		t.Fatalf("RecordLoanPayment failed: %v", err)
	}
	if payment == nil {
		t.Fatal("Expected payment, got nil")
	}
	if payment.PaymentAmount != 299.71 {
		t.Errorf("Expected payment amount 299.71, got %f", payment.PaymentAmount)
	}
	if payment.PrincipalAmount != 258.04 {
		t.Errorf("Expected principal 258.04, got %f", payment.PrincipalAmount)
	}
}

func TestRecordLoanPayment_UnauthorizedAccess(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	owner := "test-user-owner-loan-payment-1"
	attacker := "test-user-attacker-loan-payment-1"
	CreateTestUser(t, db, owner)
	CreateTestUser(t, db, attacker)
	accountID := CreateTestAccount(t, db, owner, AccountTypeLoan)
	service := SetupAccountService(t, db)

	// Create loan for owner
	ownerCtx := CreateAuthContext(owner)
	service.CreateLoanDetails(ownerCtx, accountID, &CreateLoanDetailsRequest{
		AccountID:        accountID,
		OriginalAmount:   10000.00,
		InterestRate:     0.05,
		RateType:         "fixed",
		StartDate:        Date{Time: time.Now()},
		TermMonths:       36,
		PaymentAmount:    299.71,
		PaymentFrequency: "monthly",
	})

	// Act - attacker tries to record payment
	attackerCtx := CreateAuthContext(attacker)
	paymentReq := &CreateLoanPaymentRequest{
		AccountID:       accountID,
		PaymentDate:     Date{Time: time.Now()},
		PaymentAmount:   299.71,
		PrincipalAmount: 258.04,
		InterestAmount:  41.67,
		ExtraPayment:    0,
	}
	payment, err := service.RecordLoanPayment(attackerCtx, accountID, paymentReq)

	// Assert
	if err == nil {
		t.Fatal("Expected error for unauthorized access, got nil")
	}
	if payment != nil {
		t.Error("Expected nil payment for unauthorized access")
	}
}

func TestGetLoanPayments_Success(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-loan-payments-1"
	CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	accountID := CreateTestAccount(t, db, userID, AccountTypeLoan)
	service := SetupAccountService(t, db)

	// Create loan
	service.CreateLoanDetails(ctx, accountID, &CreateLoanDetailsRequest{
		AccountID:        accountID,
		OriginalAmount:   10000.00,
		InterestRate:     0.05,
		RateType:         "fixed",
		StartDate:        Date{Time: time.Now()},
		TermMonths:       36,
		PaymentAmount:    299.71,
		PaymentFrequency: "monthly",
	})

	// Record multiple payments
	for i := 0; i < 3; i++ {
		service.RecordLoanPayment(ctx, accountID, &CreateLoanPaymentRequest{
			AccountID:       accountID,
			PaymentDate:     Date{Time: time.Now().AddDate(0, i, 0)},
			PaymentAmount:   299.71,
			PrincipalAmount: 250.00,
			InterestAmount:  49.71,
			ExtraPayment:    0,
		})
	}

	// Act
	payments, err := service.GetLoanPayments(ctx, accountID)

	// Assert
	if err != nil {
		t.Fatalf("GetLoanPayments failed: %v", err)
	}
	if payments == nil {
		t.Fatal("Expected payments, got nil")
	}
	if len(payments.Payments) != 3 {
		t.Errorf("Expected 3 payments, got %d", len(payments.Payments))
	}
}

func TestGetLoanPayments_UnauthorizedAccess(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	owner := "test-user-owner-loan-payments-1"
	attacker := "test-user-attacker-loan-payments-1"
	CreateTestUser(t, db, owner)
	CreateTestUser(t, db, attacker)
	accountID := CreateTestAccount(t, db, owner, AccountTypeLoan)
	service := SetupAccountService(t, db)

	// Create loan for owner
	ownerCtx := CreateAuthContext(owner)
	service.CreateLoanDetails(ownerCtx, accountID, &CreateLoanDetailsRequest{
		AccountID:        accountID,
		OriginalAmount:   10000.00,
		InterestRate:     0.05,
		RateType:         "fixed",
		StartDate:        Date{Time: time.Now()},
		TermMonths:       36,
		PaymentAmount:    299.71,
		PaymentFrequency: "monthly",
	})

	// Act - attacker tries to get payments
	attackerCtx := CreateAuthContext(attacker)
	payments, err := service.GetLoanPayments(attackerCtx, accountID)

	// Assert
	if err == nil {
		t.Fatal("Expected error for unauthorized access, got nil")
	}
	if payments != nil {
		t.Error("Expected nil payments for unauthorized access")
	}
}

func TestSyncLoanBalance_Success(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-loan-sync-1"
	CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	accountID := CreateTestAccount(t, db, userID, AccountTypeLoan)
	service := SetupAccountService(t, db)

	// Create loan
	service.CreateLoanDetails(ctx, accountID, &CreateLoanDetailsRequest{
		AccountID:        accountID,
		OriginalAmount:   10000.00,
		InterestRate:     0.05,
		RateType:         "fixed",
		StartDate:        Date{Time: time.Now()},
		TermMonths:       36,
		PaymentAmount:    299.71,
		PaymentFrequency: "monthly",
	})

	// Act
	err := service.SyncLoanBalance(ctx, accountID)

	// Assert
	if err != nil {
		t.Fatalf("SyncLoanBalance failed: %v", err)
	}
}
