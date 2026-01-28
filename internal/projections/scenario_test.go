package projections

import (
	"encoding/json"
	"testing"
	"time"

	"money/internal/account"
)

func TestCreateScenario_Success(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-scenario-1"
	account.CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	service := SetupProjectionService(t, db)

	config := DefaultTestConfig()
	req := &CreateScenarioRequest{
		Name:      "My Retirement Plan",
		IsDefault: true,
		Config:    config,
	}

	// Act
	scenario, err := service.CreateScenario(ctx, req)

	// Assert
	if err != nil {
		t.Fatalf("CreateScenario failed: %v", err)
	}
	if scenario == nil {
		t.Fatal("Expected scenario, got nil")
	}
	if scenario.Name != "My Retirement Plan" {
		t.Errorf("Expected name 'My Retirement Plan', got '%s'", scenario.Name)
	}
	if !scenario.IsDefault {
		t.Error("Expected scenario to be default")
	}
	if scenario.UserID != userID {
		t.Errorf("Expected userID %s, got %s", userID, scenario.UserID)
	}
}

func TestCreateScenario_Unauthenticated(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	service := SetupProjectionService(t, db)
	config := DefaultTestConfig()
	req := &CreateScenarioRequest{
		Name:   "Plan",
		Config: config,
	}

	// Act
	scenario, err := service.CreateScenario(CreateAuthContext(""), req)

	// Assert
	if err == nil {
		t.Fatal("Expected error for unauthenticated user, got nil")
	}
	if scenario != nil {
		t.Error("Expected nil scenario for unauthenticated user")
	}
}

func TestCreateScenario_UnsetsOtherDefaults(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-scenario-2"
	account.CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	service := SetupProjectionService(t, db)

	// Create first default scenario
	config1 := DefaultTestConfig()
	service.CreateScenario(ctx, &CreateScenarioRequest{
		Name:      "First Default",
		IsDefault: true,
		Config:    config1,
	})

	// Act - Create second default scenario
	config2 := DefaultTestConfig()
	service.CreateScenario(ctx, &CreateScenarioRequest{
		Name:      "Second Default",
		IsDefault: true,
		Config:    config2,
	})

	// Assert - List scenarios and check only one is default
	scenarios, err := service.ListScenarios(ctx)
	if err != nil {
		t.Fatalf("ListScenarios failed: %v", err)
	}

	defaultCount := 0
	for _, s := range scenarios.Scenarios {
		if s.IsDefault {
			defaultCount++
			if s.Name != "Second Default" {
				t.Errorf("Expected 'Second Default' to be default, got '%s'", s.Name)
			}
		}
	}

	if defaultCount != 1 {
		t.Errorf("Expected exactly 1 default scenario, got %d", defaultCount)
	}
}

func TestListScenarios_Success(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-list-1"
	account.CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	service := SetupProjectionService(t, db)

	// Create multiple scenarios
	config := DefaultTestConfig()
	service.CreateScenario(ctx, &CreateScenarioRequest{Name: "Plan A", Config: config})
	service.CreateScenario(ctx, &CreateScenarioRequest{Name: "Plan B", Config: config})
	service.CreateScenario(ctx, &CreateScenarioRequest{Name: "Plan C", Config: config})

	// Act
	scenarios, err := service.ListScenarios(ctx)

	// Assert
	if err != nil {
		t.Fatalf("ListScenarios failed: %v", err)
	}
	if len(scenarios.Scenarios) != 3 {
		t.Errorf("Expected 3 scenarios, got %d", len(scenarios.Scenarios))
	}
}

func TestListScenarios_IsolationBetweenUsers(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	user1 := "test-user-isolation-1"
	user2 := "test-user-isolation-2"
	account.CreateTestUser(t, db, user1)
	account.CreateTestUser(t, db, user2)
	service := SetupProjectionService(t, db)

	config := DefaultTestConfig()

	// Create scenarios for both users
	ctx1 := CreateAuthContext(user1)
	service.CreateScenario(ctx1, &CreateScenarioRequest{Name: "User1 Plan A", Config: config})
	service.CreateScenario(ctx1, &CreateScenarioRequest{Name: "User1 Plan B", Config: config})

	ctx2 := CreateAuthContext(user2)
	service.CreateScenario(ctx2, &CreateScenarioRequest{Name: "User2 Plan", Config: config})

	// Act
	scenarios1, err1 := service.ListScenarios(ctx1)
	scenarios2, err2 := service.ListScenarios(ctx2)

	// Assert
	if err1 != nil {
		t.Fatalf("ListScenarios failed for user1: %v", err1)
	}
	if err2 != nil {
		t.Fatalf("ListScenarios failed for user2: %v", err2)
	}

	if len(scenarios1.Scenarios) != 2 {
		t.Errorf("Expected user1 to have 2 scenarios, got %d", len(scenarios1.Scenarios))
	}
	if len(scenarios2.Scenarios) != 1 {
		t.Errorf("Expected user2 to have 1 scenario, got %d", len(scenarios2.Scenarios))
	}

	// Verify user1 doesn't see user2's scenarios
	for _, s := range scenarios1.Scenarios {
		if s.UserID == user2 {
			t.Error("User1 should not see user2's scenarios")
		}
	}
}

func TestGetScenario_Success(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-get-1"
	account.CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	service := SetupProjectionService(t, db)

	config := DefaultTestConfig()
	created, _ := service.CreateScenario(ctx, &CreateScenarioRequest{
		Name:   "Test Plan",
		Config: config,
	})

	// Act
	scenario, err := service.GetScenario(ctx, created.ID)

	// Assert
	if err != nil {
		t.Fatalf("GetScenario failed: %v", err)
	}
	if scenario == nil {
		t.Fatal("Expected scenario, got nil")
	}
	if scenario.ID != created.ID {
		t.Errorf("Expected ID %s, got %s", created.ID, scenario.ID)
	}
	if scenario.Name != "Test Plan" {
		t.Errorf("Expected name 'Test Plan', got '%s'", scenario.Name)
	}
}

func TestGetScenario_UnauthorizedAccess(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	owner := "test-user-owner-1"
	attacker := "test-user-attacker-1"
	account.CreateTestUser(t, db, owner)
	account.CreateTestUser(t, db, attacker)
	service := SetupProjectionService(t, db)

	ownerCtx := CreateAuthContext(owner)
	config := DefaultTestConfig()
	created, _ := service.CreateScenario(ownerCtx, &CreateScenarioRequest{
		Name:   "Owner Plan",
		Config: config,
	})

	// Act - attacker tries to get owner's scenario
	attackerCtx := CreateAuthContext(attacker)
	scenario, err := service.GetScenario(attackerCtx, created.ID)

	// Assert
	if err == nil {
		t.Fatal("Expected error for unauthorized access, got nil")
	}
	if scenario != nil {
		t.Error("Expected nil scenario for unauthorized access")
	}
}

func TestUpdateScenario_Success(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-update-1"
	account.CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	service := SetupProjectionService(t, db)

	config := DefaultTestConfig()
	created, _ := service.CreateScenario(ctx, &CreateScenarioRequest{
		Name:   "Original Name",
		Config: config,
	})

	newName := "Updated Name"
	updateReq := &UpdateScenarioRequest{
		Name: &newName,
	}

	// Act
	updated, err := service.UpdateScenario(ctx, created.ID, updateReq)

	// Assert
	if err != nil {
		t.Fatalf("UpdateScenario failed: %v", err)
	}
	if updated.Name != "Updated Name" {
		t.Errorf("Expected name 'Updated Name', got '%s'", updated.Name)
	}
}

func TestUpdateScenario_SetDefault(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-update-default-1"
	account.CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	service := SetupProjectionService(t, db)

	config := DefaultTestConfig()

	// Create two scenarios, first one is default
	service.CreateScenario(ctx, &CreateScenarioRequest{
		Name:      "Plan A",
		IsDefault: true,
		Config:    config,
	})
	planB, _ := service.CreateScenario(ctx, &CreateScenarioRequest{
		Name:   "Plan B",
		Config: config,
	})

	// Act - Set Plan B as default
	isDefault := true
	service.UpdateScenario(ctx, planB.ID, &UpdateScenarioRequest{
		IsDefault: &isDefault,
	})

	// Assert - Check only Plan B is default
	scenarios, _ := service.ListScenarios(ctx)
	defaultCount := 0
	for _, s := range scenarios.Scenarios {
		if s.IsDefault {
			defaultCount++
			if s.ID != planB.ID {
				t.Errorf("Expected Plan B to be default, got %s", s.Name)
			}
		}
	}

	if defaultCount != 1 {
		t.Errorf("Expected exactly 1 default scenario, got %d", defaultCount)
	}
}

func TestUpdateScenario_UnauthorizedAccess(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	owner := "test-user-owner-update-1"
	attacker := "test-user-attacker-update-1"
	account.CreateTestUser(t, db, owner)
	account.CreateTestUser(t, db, attacker)
	service := SetupProjectionService(t, db)

	ownerCtx := CreateAuthContext(owner)
	config := DefaultTestConfig()
	created, _ := service.CreateScenario(ownerCtx, &CreateScenarioRequest{
		Name:   "Owner Plan",
		Config: config,
	})

	// Act - attacker tries to update
	attackerCtx := CreateAuthContext(attacker)
	newName := "Hacked Name"
	updated, err := service.UpdateScenario(attackerCtx, created.ID, &UpdateScenarioRequest{
		Name: &newName,
	})

	// Assert
	if err == nil {
		t.Fatal("Expected error for unauthorized update, got nil")
	}
	if updated != nil {
		t.Error("Expected nil for unauthorized update")
	}
}

func TestDeleteScenario_Success(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-delete-1"
	account.CreateTestUser(t, db, userID)
	ctx := CreateAuthContext(userID)
	service := SetupProjectionService(t, db)

	config := DefaultTestConfig()
	created, _ := service.CreateScenario(ctx, &CreateScenarioRequest{
		Name:   "To Delete",
		Config: config,
	})

	// Act
	resp, err := service.DeleteScenario(ctx, created.ID)

	// Assert
	if err != nil {
		t.Fatalf("DeleteScenario failed: %v", err)
	}
	if resp == nil {
		t.Fatal("Expected response, got nil")
	}

	// Verify it's deleted
	_, err = service.GetScenario(ctx, created.ID)
	if err == nil {
		t.Error("Expected error when getting deleted scenario")
	}
}

func TestDeleteScenario_UnauthorizedAccess(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	owner := "test-user-owner-delete-1"
	attacker := "test-user-attacker-delete-1"
	account.CreateTestUser(t, db, owner)
	account.CreateTestUser(t, db, attacker)
	service := SetupProjectionService(t, db)

	ownerCtx := CreateAuthContext(owner)
	config := DefaultTestConfig()
	created, _ := service.CreateScenario(ownerCtx, &CreateScenarioRequest{
		Name:   "Owner Plan",
		Config: config,
	})

	// Act - attacker tries to delete
	attackerCtx := CreateAuthContext(attacker)
	_, err := service.DeleteScenario(attackerCtx, created.ID)

	// Assert
	if err == nil {
		t.Fatal("Expected error for unauthorized delete, got nil")
	}

	// Verify it still exists
	scenario, err := service.GetScenario(ownerCtx, created.ID)
	if err != nil {
		t.Error("Scenario should still exist after unauthorized delete attempt")
	}
	if scenario == nil {
		t.Error("Expected scenario to still exist")
	}
}

func TestConfig_MarshalUnmarshal(t *testing.T) {
	// Arrange
	config := DefaultTestConfig()
	config.Events = []Event{
		{
			ID:          "event-1",
			Type:        EventOneTimeIncome,
			Date:        time.Now(),
			Description: "Bonus",
			Parameters: EventParameters{
				Amount:   5000.00,
				Category: "bonus",
			},
		},
	}

	// Act - Marshal
	data, err := json.Marshal(config)
	if err != nil {
		t.Fatalf("Marshal failed: %v", err)
	}

	// Act - Unmarshal
	var decoded Config
	err = json.Unmarshal(data, &decoded)
	if err != nil {
		t.Fatalf("Unmarshal failed: %v", err)
	}

	// Assert
	if decoded.TimeHorizonYears != config.TimeHorizonYears {
		t.Errorf("Expected TimeHorizonYears %d, got %d", config.TimeHorizonYears, decoded.TimeHorizonYears)
	}
	if decoded.AnnualSalary != config.AnnualSalary {
		t.Errorf("Expected AnnualSalary %.2f, got %.2f", config.AnnualSalary, decoded.AnnualSalary)
	}
	if len(decoded.FederalTaxBrackets) != len(config.FederalTaxBrackets) {
		t.Errorf("Expected %d federal tax brackets, got %d", len(config.FederalTaxBrackets), len(decoded.FederalTaxBrackets))
	}
	if len(decoded.Events) != len(config.Events) {
		t.Errorf("Expected %d events, got %d", len(config.Events), len(decoded.Events))
	}
}
