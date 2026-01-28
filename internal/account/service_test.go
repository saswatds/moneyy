package account

import (
	"testing"
)

func TestCreate_Success(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-create-1"
	CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	service := SetupAccountService(t, db)

	req := &CreateAccountRequest{
		Name:     "Test Savings Account",
		Type:     AccountTypeSavings,
		Currency: CurrencyCAD,
		IsAsset:  true,
	}

	// Act
	account, err := service.Create(ctx, req)

	// Assert
	if err != nil {
		t.Fatalf("Create failed: %v", err)
	}
	if account == nil {
		t.Fatal("Expected account, got nil")
	}
	if account.Name != "Test Savings Account" {
		t.Errorf("Expected name 'Test Savings Account', got '%s'", account.Name)
	}
	if account.Type != AccountTypeSavings {
		t.Errorf("Expected type savings, got %s", account.Type)
	}
	if account.UserID != userID {
		t.Errorf("Expected userID %s, got %s", userID, account.UserID)
	}
	if !account.IsActive {
		t.Error("Expected account to be active")
	}
}

func TestCreate_Unauthenticated(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	service := SetupAccountService(t, db)
	req := &CreateAccountRequest{
		Name:     "Test Account",
		Type:     AccountTypeSavings,
		Currency: CurrencyCAD,
		IsAsset:  true,
	}

	// Act
	account, err := service.Create(CreateAuthContext(""), req)

	// Assert
	if err == nil {
		t.Fatal("Expected error for unauthenticated user, got nil")
	}
	if account != nil {
		t.Error("Expected nil account for unauthenticated user")
	}
}

func TestGet_Success(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-get-1"
	CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	accountID := CreateTestAccount(t, db, userID, AccountTypeSavings)
	service := SetupAccountService(t, db)

	// Act
	account, err := service.Get(ctx, accountID)

	// Assert
	if err != nil {
		t.Fatalf("Get failed: %v", err)
	}
	if account == nil {
		t.Fatal("Expected account, got nil")
	}
	if account.ID != accountID {
		t.Errorf("Expected ID %s, got %s", accountID, account.ID)
	}
	if account.UserID != userID {
		t.Errorf("Expected userID %s, got %s", userID, account.UserID)
	}
}

func TestGet_UnauthorizedAccess(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	owner := "test-user-owner-1"
	attacker := "test-user-attacker-1"
	CreateTestUser(t, db, owner)
	CreateTestUser(t, db, attacker)
	accountID := CreateTestAccount(t, db, owner, AccountTypeSavings)
	service := SetupAccountService(t, db)

	// Act - attacker tries to access owner's account
	ctx := CreateAuthContext(attacker)
	account, err := service.Get(ctx, accountID)

	// Assert
	if err == nil {
		t.Fatal("Expected error for unauthorized access, got nil")
	}
	if account != nil {
		t.Error("Expected nil account for unauthorized access")
	}
}

func TestList_Success(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-list-1"
	CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	service := SetupAccountService(t, db)

	// Create multiple accounts
	CreateTestAccount(t, db, userID, AccountTypeSavings)
	CreateTestAccount(t, db, userID, AccountTypeChecking)
	CreateTestAccount(t, db, userID, AccountTypeCreditCard)

	// Act
	resp, err := service.List(ctx)

	// Assert
	if err != nil {
		t.Fatalf("List failed: %v", err)
	}
	if resp == nil {
		t.Fatal("Expected response, got nil")
	}
	if len(resp.Accounts) != 3 {
		t.Errorf("Expected 3 accounts, got %d", len(resp.Accounts))
	}
}

func TestList_IsolationBetweenUsers(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	user1 := "test-user-isolation-1"
	user2 := "test-user-isolation-2"
	CreateTestUser(t, db, user1)
	CreateTestUser(t, db, user2)
	service := SetupAccountService(t, db)

	// Create accounts for both users
	CreateTestAccount(t, db, user1, AccountTypeSavings)
	CreateTestAccount(t, db, user1, AccountTypeChecking)
	CreateTestAccount(t, db, user2, AccountTypeSavings)

	// Act - user1 lists their accounts
	ctx1 := CreateAuthContext(user1)
	resp1, err1 := service.List(ctx1)

	// Act - user2 lists their accounts
	ctx2 := CreateAuthContext(user2)
	resp2, err2 := service.List(ctx2)

	// Assert
	if err1 != nil {
		t.Fatalf("List failed for user1: %v", err1)
	}
	if err2 != nil {
		t.Fatalf("List failed for user2: %v", err2)
	}
	if len(resp1.Accounts) != 2 {
		t.Errorf("Expected user1 to have 2 accounts, got %d", len(resp1.Accounts))
	}
	if len(resp2.Accounts) != 1 {
		t.Errorf("Expected user2 to have 1 account, got %d", len(resp2.Accounts))
	}

	// Verify user1 can't see user2's accounts
	for _, acc := range resp1.Accounts {
		if acc.UserID == user2 {
			t.Error("User1 should not see user2's accounts")
		}
	}
}

func TestListWithBalance_Success(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-balance-1"
	CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	service := SetupAccountService(t, db)

	accountID := CreateTestAccount(t, db, userID, AccountTypeSavings)
	CreateTestBalance(t, db, accountID, 1000.50)

	// Act
	resp, err := service.ListWithBalance(ctx)

	// Assert
	if err != nil {
		t.Fatalf("ListWithBalance failed: %v", err)
	}
	if resp == nil {
		t.Fatal("Expected response, got nil")
	}
	if len(resp.Accounts) != 1 {
		t.Fatalf("Expected 1 account, got %d", len(resp.Accounts))
	}

	account := resp.Accounts[0]
	if account.CurrentBalance == nil {
		t.Fatal("Expected balance, got nil")
	}
	if *account.CurrentBalance != 1000.50 {
		t.Errorf("Expected balance 1000.50, got %f", *account.CurrentBalance)
	}
}

func TestUpdate_Success(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-update-1"
	CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	accountID := CreateTestAccount(t, db, userID, AccountTypeSavings)
	service := SetupAccountService(t, db)

	newName := "Updated Account Name"
	req := &UpdateAccountRequest{
		Name: &newName,
	}

	// Act
	account, err := service.Update(ctx, accountID, req)

	// Assert
	if err != nil {
		t.Fatalf("Update failed: %v", err)
	}
	if account.Name != newName {
		t.Errorf("Expected name '%s', got '%s'", newName, account.Name)
	}
}

func TestUpdate_UnauthorizedAccess(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	owner := "test-user-owner-2"
	attacker := "test-user-attacker-2"
	CreateTestUser(t, db, owner)
	CreateTestUser(t, db, attacker)
	accountID := CreateTestAccount(t, db, owner, AccountTypeSavings)
	service := SetupAccountService(t, db)

	newName := "Hacked Name"
	req := &UpdateAccountRequest{
		Name: &newName,
	}

	// Act - attacker tries to update owner's account
	ctx := CreateAuthContext(attacker)
	account, err := service.Update(ctx, accountID, req)

	// Assert
	if err == nil {
		t.Fatal("Expected error for unauthorized update, got nil")
	}
	if account != nil {
		t.Error("Expected nil account for unauthorized update")
	}
}

func TestDelete_Success(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-delete-1"
	CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	accountID := CreateTestAccount(t, db, userID, AccountTypeSavings)
	service := SetupAccountService(t, db)

	// Act
	resp, err := service.Delete(ctx, accountID)

	// Assert
	if err != nil {
		t.Fatalf("Delete failed: %v", err)
	}
	if !resp.Success {
		t.Error("Expected success true")
	}

	// Verify account is deleted
	_, err = service.Get(ctx, accountID)
	if err == nil {
		t.Error("Expected error when getting deleted account")
	}
}

func TestDelete_UnauthorizedAccess(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	owner := "test-user-owner-3"
	attacker := "test-user-attacker-3"
	CreateTestUser(t, db, owner)
	CreateTestUser(t, db, attacker)
	accountID := CreateTestAccount(t, db, owner, AccountTypeSavings)
	service := SetupAccountService(t, db)

	// Act - attacker tries to delete owner's account
	ctx := CreateAuthContext(attacker)
	resp, err := service.Delete(ctx, accountID)

	// Assert
	if err == nil {
		t.Fatal("Expected error for unauthorized delete, got nil")
	}
	if resp != nil && resp.Success {
		t.Error("Expected delete to fail for unauthorized access")
	}

	// Verify account still exists for owner
	ownerCtx := CreateAuthContext(owner)
	account, err := service.Get(ownerCtx, accountID)
	if err != nil {
		t.Error("Account should still exist after unauthorized delete attempt")
	}
	if account == nil {
		t.Error("Expected account to still exist")
	}
}

func TestSummary_Success(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-summary-1"
	CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	service := SetupAccountService(t, db)

	// Create mixed accounts
	CreateTestAccount(t, db, userID, AccountTypeSavings)    // asset
	CreateTestAccount(t, db, userID, AccountTypeChecking)   // asset
	CreateTestAccount(t, db, userID, AccountTypeCreditCard) // liability

	// Act
	summary, err := service.Summary(ctx)

	// Assert
	if err != nil {
		t.Fatalf("Summary failed: %v", err)
	}
	if summary.TotalAccounts != 3 {
		t.Errorf("Expected 3 total accounts, got %d", summary.TotalAccounts)
	}
	if summary.ActiveAccounts != 3 {
		t.Errorf("Expected 3 active accounts, got %d", summary.ActiveAccounts)
	}
}
