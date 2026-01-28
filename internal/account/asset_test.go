package account

import (
	"encoding/json"
	"testing"
	"time"
)

func TestCreateAssetDetails_Success(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-asset-1"
	CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	accountID := CreateTestAccount(t, db, userID, AccountTypeVehicle)
	service := SetupAccountService(t, db)

	usefulLife := 10
	req := &CreateAssetDetailsRequest{
		AccountID:          accountID,
		AssetType:          "vehicle",
		PurchasePrice:      25000.00,
		PurchaseDate:       Date{Time: time.Now()},
		DepreciationMethod: "straight_line",
		UsefulLifeYears:    &usefulLife,
		SalvageValue:       5000.00,
		TypeSpecificData:   json.RawMessage("{}"),
	}

	// Act
	details, err := service.CreateAssetDetails(ctx, accountID, req)

	// Assert
	if err != nil {
		t.Fatalf("CreateAssetDetails failed: %v", err)
	}
	if details == nil {
		t.Fatal("Expected asset details, got nil")
	}
	if details.AssetType != "vehicle" {
		t.Errorf("Expected type 'vehicle', got '%s'", details.AssetType)
	}
	if details.PurchasePrice != 25000.00 {
		t.Errorf("Expected price 25000.00, got %f", details.PurchasePrice)
	}
	if *details.UsefulLifeYears != 10 {
		t.Errorf("Expected useful life 10, got %d", *details.UsefulLifeYears)
	}
}

func TestCreateAssetDetails_UnauthorizedAccess(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	owner := "test-user-owner-asset-1"
	attacker := "test-user-attacker-asset-1"
	CreateTestUser(t, db, owner)
	CreateTestUser(t, db, attacker)
	accountID := CreateTestAccount(t, db, owner, AccountTypeVehicle)
	service := SetupAccountService(t, db)

	usefulLife := 10
	req := &CreateAssetDetailsRequest{
		AccountID:          accountID,
		AssetType:          "vehicle",
		PurchasePrice:      25000.00,
		PurchaseDate:       Date{Time: time.Now()},
		DepreciationMethod: "straight_line",
		UsefulLifeYears:    &usefulLife,
		SalvageValue:       5000.00,
		TypeSpecificData:   json.RawMessage("{}"),
	}

	// Act - attacker tries to create asset details for owner's account
	ctx := CreateAuthContext(attacker)
	details, err := service.CreateAssetDetails(ctx, accountID, req)

	// Assert
	if err == nil {
		t.Fatal("Expected error for unauthorized access, got nil")
	}
	if details != nil {
		t.Error("Expected nil details for unauthorized access")
	}
}

func TestCreateAssetDetails_InvalidDepreciationMethod(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-asset-2"
	CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	accountID := CreateTestAccount(t, db, userID, AccountTypeVehicle)
	service := SetupAccountService(t, db)

	req := &CreateAssetDetailsRequest{
		AccountID:          accountID,
		AssetType:          "vehicle",
		PurchasePrice:      25000.00,
		PurchaseDate:       Date{Time: time.Now()},
		DepreciationMethod: "straight_line",
		// Missing UsefulLifeYears for straight_line method
		SalvageValue: 5000.00,
	}

	// Act
	details, err := service.CreateAssetDetails(ctx, accountID, req)

	// Assert
	if err == nil {
		t.Fatal("Expected validation error, got nil")
	}
	if details != nil {
		t.Error("Expected nil details for invalid request")
	}
}

func TestGetAssetDetails_Success(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-asset-get-1"
	CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	accountID := CreateTestAccount(t, db, userID, AccountTypeVehicle)
	service := SetupAccountService(t, db)

	usefulLife := 10
	createReq := &CreateAssetDetailsRequest{
		AccountID:          accountID,
		AssetType:          "vehicle",
		PurchasePrice:      25000.00,
		PurchaseDate:       Date{Time: time.Now()},
		DepreciationMethod: "straight_line",
		UsefulLifeYears:    &usefulLife,
		SalvageValue:       5000.00,
		TypeSpecificData:   json.RawMessage("{}"),
	}
	service.CreateAssetDetails(ctx, accountID, createReq)

	// Act
	details, err := service.GetAssetDetails(ctx, accountID)

	// Assert
	if err != nil {
		t.Fatalf("GetAssetDetails failed: %v", err)
	}
	if details == nil {
		t.Fatal("Expected asset details, got nil")
	}
	if details.AccountID != accountID {
		t.Errorf("Expected accountID %s, got %s", accountID, details.AccountID)
	}
}

func TestGetAssetDetails_UnauthorizedAccess(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	owner := "test-user-owner-asset-2"
	attacker := "test-user-attacker-asset-2"
	CreateTestUser(t, db, owner)
	CreateTestUser(t, db, attacker)
	accountID := CreateTestAccount(t, db, owner, AccountTypeVehicle)
	service := SetupAccountService(t, db)

	// Create asset for owner
	ownerCtx := CreateAuthContext(owner)
	usefulLife := 10
	createReq := &CreateAssetDetailsRequest{
		AccountID:          accountID,
		AssetType:          "vehicle",
		PurchasePrice:      25000.00,
		PurchaseDate:       Date{Time: time.Now()},
		DepreciationMethod: "straight_line",
		UsefulLifeYears:    &usefulLife,
		SalvageValue:       5000.00,
		TypeSpecificData:   json.RawMessage("{}"),
	}
	service.CreateAssetDetails(ownerCtx, accountID, createReq)

	// Act - attacker tries to get owner's asset details
	attackerCtx := CreateAuthContext(attacker)
	details, err := service.GetAssetDetails(attackerCtx, accountID)

	// Assert
	if err == nil {
		t.Fatal("Expected error for unauthorized access, got nil")
	}
	if details != nil {
		t.Error("Expected nil details for unauthorized access")
	}
}

func TestUpdateAssetDetails_Success(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-asset-update-1"
	CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	accountID := CreateTestAccount(t, db, userID, AccountTypeVehicle)
	service := SetupAccountService(t, db)

	// Create initial asset
	usefulLife := 10
	createReq := &CreateAssetDetailsRequest{
		AccountID:          accountID,
		AssetType:          "vehicle",
		PurchasePrice:      25000.00,
		PurchaseDate:       Date{Time: time.Now()},
		DepreciationMethod: "straight_line",
		UsefulLifeYears:    &usefulLife,
		SalvageValue:       5000.00,
		TypeSpecificData:   json.RawMessage("{}"),
	}
	service.CreateAssetDetails(ctx, accountID, createReq)

	// Update request
	newUsefulLife := 12
	updateReq := &UpdateAssetDetailsRequest{
		AssetType:          "vehicle",
		PurchasePrice:      28000.00,
		PurchaseDate:       Date{Time: time.Now()},
		DepreciationMethod: "straight_line",
		UsefulLifeYears:    &newUsefulLife,
		SalvageValue:       6000.00,
		TypeSpecificData:   json.RawMessage("{}"),
	}

	// Act
	details, err := service.UpdateAssetDetails(ctx, accountID, updateReq)

	// Assert
	if err != nil {
		t.Fatalf("UpdateAssetDetails failed: %v", err)
	}
	if details.PurchasePrice != 28000.00 {
		t.Errorf("Expected updated price 28000.00, got %f", details.PurchasePrice)
	}
	if *details.UsefulLifeYears != 12 {
		t.Errorf("Expected updated useful life 12, got %d", *details.UsefulLifeYears)
	}
}

func TestUpdateAssetDetails_UnauthorizedAccess(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	owner := "test-user-owner-asset-3"
	attacker := "test-user-attacker-asset-3"
	CreateTestUser(t, db, owner)
	CreateTestUser(t, db, attacker)
	accountID := CreateTestAccount(t, db, owner, AccountTypeVehicle)
	service := SetupAccountService(t, db)

	// Create asset for owner
	ownerCtx := CreateAuthContext(owner)
	usefulLife := 10
	service.CreateAssetDetails(ownerCtx, accountID, &CreateAssetDetailsRequest{
		AccountID:          accountID,
		AssetType:          "vehicle",
		PurchasePrice:      25000.00,
		PurchaseDate:       Date{Time: time.Now()},
		DepreciationMethod: "straight_line",
		UsefulLifeYears:    &usefulLife,
		SalvageValue:       5000.00,
		TypeSpecificData:   json.RawMessage("{}"),
	})

	// Act - attacker tries to update
	attackerCtx := CreateAuthContext(attacker)
	newUsefulLife := 12
	updateReq := &UpdateAssetDetailsRequest{
		AssetType:          "vehicle",
		PurchasePrice:      1.00,
		PurchaseDate:       Date{Time: time.Now()},
		DepreciationMethod: "straight_line",
		UsefulLifeYears:    &newUsefulLife,
		SalvageValue:       1.00,
	}
	details, err := service.UpdateAssetDetails(attackerCtx, accountID, updateReq)

	// Assert
	if err == nil {
		t.Fatal("Expected error for unauthorized update, got nil")
	}
	if details != nil {
		t.Error("Expected nil details for unauthorized update")
	}
}

func TestGetAssetValuation_Success(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-asset-valuation-1"
	CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	accountID := CreateTestAccount(t, db, userID, AccountTypeVehicle)
	service := SetupAccountService(t, db)

	// Create asset with straight-line depreciation
	usefulLife := 10
	service.CreateAssetDetails(ctx, accountID, &CreateAssetDetailsRequest{
		AccountID:          accountID,
		AssetType:          "vehicle",
		PurchasePrice:      20000.00,
		PurchaseDate:       Date{Time: time.Now().AddDate(-1, 0, 0)}, // 1 year ago
		DepreciationMethod: "straight_line",
		UsefulLifeYears:    &usefulLife,
		SalvageValue:       2000.00,
		TypeSpecificData:   json.RawMessage("{}"),
	})

	// Act
	valuation, err := service.GetAssetValuation(ctx, accountID)

	// Assert
	if err != nil {
		t.Fatalf("GetAssetValuation failed: %v", err)
	}
	if valuation == nil {
		t.Fatal("Expected valuation, got nil")
	}
	if valuation.CurrentValue >= 20000.00 {
		t.Error("Expected current value to be less than purchase price after 1 year")
	}
	if valuation.AccumulatedDepreciation == 0 {
		t.Error("Expected accumulated depreciation to be greater than 0")
	}
}

func TestGetAssetsSummary_Success(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-assets-summary-1"
	CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	service := SetupAccountService(t, db)

	// Create multiple assets
	account1 := CreateTestAccount(t, db, userID, AccountTypeVehicle)
	account2 := CreateTestAccount(t, db, userID, AccountTypeRealEstate)

	usefulLife := 10
	service.CreateAssetDetails(ctx, account1, &CreateAssetDetailsRequest{
		AccountID:          account1,
		AssetType:          "vehicle",
		PurchasePrice:      25000.00,
		PurchaseDate:       Date{Time: time.Now()},
		DepreciationMethod: "straight_line",
		UsefulLifeYears:    &usefulLife,
		SalvageValue:       5000.00,
		TypeSpecificData:   json.RawMessage("{}"),
	})

	usefulLife2 := 20
	service.CreateAssetDetails(ctx, account2, &CreateAssetDetailsRequest{
		AccountID:          account2,
		AssetType:          "real_estate",
		PurchasePrice:      500000.00,
		PurchaseDate:       Date{Time: time.Now()},
		DepreciationMethod: "straight_line",
		UsefulLifeYears:    &usefulLife2,
		SalvageValue:       100000.00,
		TypeSpecificData:   json.RawMessage("{}"),
	})

	// Act
	summary, err := service.GetAssetsSummary(ctx)

	// Assert
	if err != nil {
		t.Fatalf("GetAssetsSummary failed: %v", err)
	}
	if summary == nil {
		t.Fatal("Expected summary, got nil")
	}
	if len(summary.Assets) != 2 {
		t.Errorf("Expected 2 assets, got %d", len(summary.Assets))
	}
}

func TestGetAssetsSummary_IsolationBetweenUsers(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	user1 := "test-user-assets-isolation-1"
	user2 := "test-user-assets-isolation-2"
	CreateTestUser(t, db, user1)
	CreateTestUser(t, db, user2)
	service := SetupAccountService(t, db)

	// Create assets for both users
	account1 := CreateTestAccount(t, db, user1, AccountTypeVehicle)
	account2 := CreateTestAccount(t, db, user2, AccountTypeVehicle)

	usefulLife := 10
	ctx1 := CreateAuthContext(user1)
	service.CreateAssetDetails(ctx1, account1, &CreateAssetDetailsRequest{
		AccountID:          account1,
		AssetType:          "vehicle",
		PurchasePrice:      25000.00,
		PurchaseDate:       Date{Time: time.Now()},
		DepreciationMethod: "straight_line",
		UsefulLifeYears:    &usefulLife,
		SalvageValue:       5000.00,
		TypeSpecificData:   json.RawMessage("{}"),
	})

	ctx2 := CreateAuthContext(user2)
	service.CreateAssetDetails(ctx2, account2, &CreateAssetDetailsRequest{
		AccountID:          account2,
		AssetType:          "vehicle",
		PurchasePrice:      30000.00,
		PurchaseDate:       Date{Time: time.Now()},
		DepreciationMethod: "straight_line",
		UsefulLifeYears:    &usefulLife,
		SalvageValue:       6000.00,
		TypeSpecificData:   json.RawMessage("{}"),
	})

	// Act - user1 gets summary
	summary1, err1 := service.GetAssetsSummary(ctx1)

	// Act - user2 gets summary
	summary2, err2 := service.GetAssetsSummary(ctx2)

	// Assert
	if err1 != nil {
		t.Fatalf("GetAssetsSummary failed for user1: %v", err1)
	}
	if err2 != nil {
		t.Fatalf("GetAssetsSummary failed for user2: %v", err2)
	}
	if len(summary1.Assets) != 1 {
		t.Errorf("Expected user1 to have 1 asset, got %d", len(summary1.Assets))
		return
	}
	if len(summary2.Assets) != 1 {
		t.Errorf("Expected user2 to have 1 asset, got %d", len(summary2.Assets))
		return
	}

	// Verify user1 doesn't see user2's assets
	if summary1.Assets[0].PurchasePrice == 30000.00 {
		t.Error("User1 should not see user2's asset")
	}
}

func TestGetDepreciationHistory_Success(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-depreciation-1"
	CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	accountID := CreateTestAccount(t, db, userID, AccountTypeVehicle)
	service := SetupAccountService(t, db)

	// Create asset with manual depreciation
	service.CreateAssetDetails(ctx, accountID, &CreateAssetDetailsRequest{
		AccountID:          accountID,
		AssetType:          "vehicle",
		PurchasePrice:      20000.00,
		PurchaseDate:       Date{Time: time.Now()},
		DepreciationMethod: "manual",
		SalvageValue:       2000.00,
		TypeSpecificData:   json.RawMessage("{}"),
	})

	// Record depreciation entry
	service.RecordDepreciation(ctx, accountID, &CreateDepreciationEntryRequest{
		AccountID:    accountID,
		EntryDate:    Date{Time: time.Now()},
		CurrentValue: 18000.00,
	})

	// Act
	history, err := service.GetDepreciationHistory(ctx, accountID)

	// Assert
	if err != nil {
		t.Fatalf("GetDepreciationHistory failed: %v", err)
	}
	if history == nil {
		t.Fatal("Expected history, got nil")
	}
	if len(history.Entries) != 1 {
		t.Errorf("Expected 1 entry, got %d", len(history.Entries))
	}
}

func TestGetDepreciationHistory_UnauthorizedAccess(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	owner := "test-user-owner-depreciation-1"
	attacker := "test-user-attacker-depreciation-1"
	CreateTestUser(t, db, owner)
	CreateTestUser(t, db, attacker)
	accountID := CreateTestAccount(t, db, owner, AccountTypeVehicle)
	service := SetupAccountService(t, db)

	// Create asset for owner
	ownerCtx := CreateAuthContext(owner)
	service.CreateAssetDetails(ownerCtx, accountID, &CreateAssetDetailsRequest{
		AccountID:          accountID,
		AssetType:          "vehicle",
		PurchasePrice:      20000.00,
		PurchaseDate:       Date{Time: time.Now()},
		DepreciationMethod: "manual",
		SalvageValue:       2000.00,
		TypeSpecificData:   json.RawMessage("{}"),
	})

	// Act - attacker tries to get depreciation history
	attackerCtx := CreateAuthContext(attacker)
	history, err := service.GetDepreciationHistory(attackerCtx, accountID)

	// Assert
	if err == nil {
		t.Fatal("Expected error for unauthorized access, got nil")
	}
	if history != nil {
		t.Error("Expected nil history for unauthorized access")
	}
}
