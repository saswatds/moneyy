package handlers

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"money/internal/account"
	"money/internal/balance"

	"github.com/go-chi/chi/v5"
)

// setupHandler creates a handler for testing
func setupHandler(db *sql.DB) *AccountHandler {
	balanceSvc := balance.NewService(db)
	accountSvc := account.NewService(db, db, balanceSvc)
	return NewAccountHandler(accountSvc)
}

func TestHandleCreate_Success(t *testing.T) {
	db := account.SetupTestDB(t)
	defer account.CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-handler-create-1"
	account.CreateTestUser(t, db, userID)
	handler := setupHandler(db)

	reqBody := map[string]interface{}{
		"name":     "Test Account",
		"type":     "savings",
		"currency": "CAD",
		"is_asset": true,
	}
	body, _ := json.Marshal(reqBody)

	req := httptest.NewRequest("POST", "/accounts", bytes.NewReader(body))
	req = req.WithContext(account.CreateAuthContext(userID))
	w := httptest.NewRecorder()

	// Act
	handler.Create(w, req)

	// Assert
	resp := w.Result()
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		t.Errorf("Expected status 201, got %d", resp.StatusCode)
	}

	var acc account.Account
	json.NewDecoder(resp.Body).Decode(&acc)
	if acc.Name != "Test Account" {
		t.Errorf("Expected name 'Test Account', got '%s'", acc.Name)
	}
}

func TestHandleCreate_Unauthorized(t *testing.T) {
	db := account.SetupTestDB(t)
	defer account.CleanupTestDB(t, db)

	// Arrange
	handler := setupHandler(db)

	reqBody := map[string]interface{}{
		"name":     "Test Account",
		"type":     "savings",
		"currency": "CAD",
		"is_asset": true,
	}
	body, _ := json.Marshal(reqBody)

	req := httptest.NewRequest("POST", "/accounts", bytes.NewReader(body))
	// No auth context
	w := httptest.NewRecorder()

	// Act
	handler.Create(w, req)

	// Assert
	resp := w.Result()
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusInternalServerError {
		t.Errorf("Expected status 500, got %d", resp.StatusCode)
	}
}

func TestHandleList_Success(t *testing.T) {
	db := account.SetupTestDB(t)
	defer account.CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-handler-list-1"
	account.CreateTestUser(t, db, userID)
	handler := setupHandler(db)

	// Create test accounts
	account.CreateTestAccount(t, db, userID, account.AccountTypeSavings)
	account.CreateTestAccount(t, db, userID, account.AccountTypeChecking)

	req := httptest.NewRequest("GET", "/accounts", nil)
	req = req.WithContext(account.CreateAuthContext(userID))
	w := httptest.NewRecorder()

	// Act
	handler.List(w, req)

	// Assert
	resp := w.Result()
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected status 200, got %d", resp.StatusCode)
	}

	var listResp account.ListAccountsResponse
	json.NewDecoder(resp.Body).Decode(&listResp)
	if len(listResp.Accounts) != 2 {
		t.Errorf("Expected 2 accounts, got %d", len(listResp.Accounts))
	}
}

func TestHandleGet_Success(t *testing.T) {
	db := account.SetupTestDB(t)
	defer account.CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-handler-get-1"
	account.CreateTestUser(t, db, userID)
	accountID := account.CreateTestAccount(t, db, userID, account.AccountTypeSavings)
	handler := setupHandler(db)

	req := httptest.NewRequest("GET", "/accounts/"+accountID, nil)
	req = req.WithContext(account.CreateAuthContext(userID))

	// Setup chi context for URL params
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("id", accountID)
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

	w := httptest.NewRecorder()

	// Act
	handler.Get(w, req)

	// Assert
	resp := w.Result()
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected status 200, got %d", resp.StatusCode)
	}

	var acc account.Account
	json.NewDecoder(resp.Body).Decode(&acc)
	if acc.ID != accountID {
		t.Errorf("Expected ID %s, got %s", accountID, acc.ID)
	}
}

func TestHandleGet_UnauthorizedAccess(t *testing.T) {
	db := account.SetupTestDB(t)
	defer account.CleanupTestDB(t, db)

	// Arrange
	owner := "test-user-owner-handler-1"
	attacker := "test-user-attacker-handler-1"
	account.CreateTestUser(t, db, owner)
	account.CreateTestUser(t, db, attacker)
	accountID := account.CreateTestAccount(t, db, owner, account.AccountTypeSavings)
	handler := setupHandler(db)

	req := httptest.NewRequest("GET", "/accounts/"+accountID, nil)
	req = req.WithContext(account.CreateAuthContext(attacker)) // Attacker context

	// Setup chi context for URL params
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("id", accountID)
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

	w := httptest.NewRecorder()

	// Act
	handler.Get(w, req)

	// Assert
	resp := w.Result()
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		t.Error("Expected non-200 status for unauthorized access")
	}
}

func TestHandleCreateAssetDetails_Success(t *testing.T) {
	db := account.SetupTestDB(t)
	defer account.CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-handler-asset-1"
	account.CreateTestUser(t, db, userID)
	accountID := account.CreateTestAccount(t, db, userID, account.AccountTypeVehicle)
	handler := setupHandler(db)

	usefulLife := 10
	reqBody := map[string]interface{}{
		"account_id":          accountID,
		"asset_type":          "vehicle",
		"purchase_price":      25000.00,
		"purchase_date":       time.Now().Format("2006-01-02"),
		"depreciation_method": "straight_line",
		"useful_life_years":   usefulLife,
		"salvage_value":       5000.00,
		"type_specific_data":  map[string]interface{}{},
	}
	body, _ := json.Marshal(reqBody)

	req := httptest.NewRequest("POST", "/accounts/"+accountID+"/asset", bytes.NewReader(body))
	req = req.WithContext(account.CreateAuthContext(userID))

	// Setup chi context for URL params
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("id", accountID)
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

	w := httptest.NewRecorder()

	// Act
	handler.CreateAssetDetails(w, req)

	// Assert
	resp := w.Result()
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		t.Errorf("Expected status 201, got %d", resp.StatusCode)
	}
}

func TestHandleCreateAssetDetails_UnauthorizedAccess(t *testing.T) {
	db := account.SetupTestDB(t)
	defer account.CleanupTestDB(t, db)

	// Arrange
	owner := "test-user-owner-asset-handler-1"
	attacker := "test-user-attacker-asset-handler-1"
	account.CreateTestUser(t, db, owner)
	account.CreateTestUser(t, db, attacker)
	accountID := account.CreateTestAccount(t, db, owner, account.AccountTypeVehicle)
	handler := setupHandler(db)

	usefulLife := 10
	reqBody := map[string]interface{}{
		"account_id":          accountID,
		"asset_type":          "vehicle",
		"purchase_price":      25000.00,
		"purchase_date":       time.Now().Format("2006-01-02"),
		"depreciation_method": "straight_line",
		"useful_life_years":   usefulLife,
		"salvage_value":       5000.00,
		"type_specific_data":  map[string]interface{}{},
	}
	body, _ := json.Marshal(reqBody)

	req := httptest.NewRequest("POST", "/accounts/"+accountID+"/asset", bytes.NewReader(body))
	req = req.WithContext(account.CreateAuthContext(attacker)) // Attacker context

	// Setup chi context for URL params
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("id", accountID)
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

	w := httptest.NewRecorder()

	// Act
	handler.CreateAssetDetails(w, req)

	// Assert
	resp := w.Result()
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusCreated {
		t.Error("Expected non-201 status for unauthorized access")
	}
}

func TestHandleGetAssetsSummary_Success(t *testing.T) {
	db := account.SetupTestDB(t)
	defer account.CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-handler-assets-summary-1"
	account.CreateTestUser(t, db, userID)
	handler := setupHandler(db)

	// Create asset via service
	accountID := account.CreateTestAccount(t, db, userID, account.AccountTypeVehicle)
	ctx := account.CreateAuthContext(userID)
	balanceSvc := balance.NewService(db)
	accountSvc := account.NewService(db, db, balanceSvc)

	usefulLife := 10
	_, err := accountSvc.CreateAssetDetails(ctx, accountID, &account.CreateAssetDetailsRequest{
		AccountID:          accountID,
		AssetType:          "vehicle",
		PurchasePrice:      25000.00,
		PurchaseDate:       account.Date{Time: time.Now()},
		DepreciationMethod: "straight_line",
		UsefulLifeYears:    &usefulLife,
		SalvageValue:       5000.00,
		TypeSpecificData:   json.RawMessage("{}"),
	})
	if err != nil {
		t.Fatalf("Failed to create asset details: %v", err)
	}

	req := httptest.NewRequest("GET", "/assets/summary", nil)
	req = req.WithContext(ctx)
	w := httptest.NewRecorder()

	// Act
	handler.GetAssetsSummary(w, req)

	// Assert
	resp := w.Result()
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected status 200, got %d", resp.StatusCode)
	}

	var summary account.AssetsSummaryResponse
	json.NewDecoder(resp.Body).Decode(&summary)
	if len(summary.Assets) != 1 {
		t.Errorf("Expected 1 asset, got %d", len(summary.Assets))
	}
}

func TestHandleGetAssetsSummary_IsolationBetweenUsers(t *testing.T) {
	db := account.SetupTestDB(t)
	defer account.CleanupTestDB(t, db)

	// Arrange
	user1 := "test-user-handler-isolation-1"
	user2 := "test-user-handler-isolation-2"
	account.CreateTestUser(t, db, user1)
	account.CreateTestUser(t, db, user2)
	handler := setupHandler(db)

	balanceSvc := balance.NewService(db)
	accountSvc := account.NewService(db, db, balanceSvc)

	// Create assets for both users
	accountID1 := account.CreateTestAccount(t, db, user1, account.AccountTypeVehicle)
	accountID2 := account.CreateTestAccount(t, db, user2, account.AccountTypeVehicle)

	usefulLife := 10
	ctx1 := account.CreateAuthContext(user1)
	_, err := accountSvc.CreateAssetDetails(ctx1, accountID1, &account.CreateAssetDetailsRequest{
		AccountID:          accountID1,
		AssetType:          "vehicle",
		PurchasePrice:      25000.00,
		PurchaseDate:       account.Date{Time: time.Now()},
		DepreciationMethod: "straight_line",
		UsefulLifeYears:    &usefulLife,
		SalvageValue:       5000.00,
		TypeSpecificData:   json.RawMessage("{}"),
	})
	if err != nil {
		t.Fatalf("Failed to create asset details for user1: %v", err)
	}

	ctx2 := account.CreateAuthContext(user2)
	_, err = accountSvc.CreateAssetDetails(ctx2, accountID2, &account.CreateAssetDetailsRequest{
		AccountID:          accountID2,
		AssetType:          "vehicle",
		PurchasePrice:      30000.00,
		PurchaseDate:       account.Date{Time: time.Now()},
		DepreciationMethod: "straight_line",
		UsefulLifeYears:    &usefulLife,
		SalvageValue:       6000.00,
		TypeSpecificData:   json.RawMessage("{}"),
	})
	if err != nil {
		t.Fatalf("Failed to create asset details for user2: %v", err)
	}

	// Act - user1 requests summary
	req1 := httptest.NewRequest("GET", "/assets/summary", nil)
	req1 = req1.WithContext(ctx1)
	w1 := httptest.NewRecorder()
	handler.GetAssetsSummary(w1, req1)

	// Act - user2 requests summary
	req2 := httptest.NewRequest("GET", "/assets/summary", nil)
	req2 = req2.WithContext(ctx2)
	w2 := httptest.NewRecorder()
	handler.GetAssetsSummary(w2, req2)

	// Assert
	resp1 := w1.Result()
	defer resp1.Body.Close()
	resp2 := w2.Result()
	defer resp2.Body.Close()

	var summary1 account.AssetsSummaryResponse
	json.NewDecoder(resp1.Body).Decode(&summary1)
	var summary2 account.AssetsSummaryResponse
	json.NewDecoder(resp2.Body).Decode(&summary2)

	if len(summary1.Assets) != 1 {
		t.Errorf("Expected user1 to have 1 asset, got %d", len(summary1.Assets))
	}
	if len(summary2.Assets) != 1 {
		t.Errorf("Expected user2 to have 1 asset, got %d", len(summary2.Assets))
	}

	// Verify user1 doesn't see user2's asset
	if summary1.Assets[0].PurchasePrice == 30000.00 {
		t.Error("User1 should not see user2's asset")
	}
}

func TestHandleCreateLoanDetails_Success(t *testing.T) {
	db := account.SetupTestDB(t)
	defer account.CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-handler-loan-1"
	account.CreateTestUser(t, db, userID)
	accountID := account.CreateTestAccount(t, db, userID, account.AccountTypeLoan)
	handler := setupHandler(db)

	reqBody := map[string]interface{}{
		"account_id":        accountID,
		"original_amount":   10000.00,
		"interest_rate":     0.05,
		"rate_type":         "fixed",
		"start_date":        time.Now().Format("2006-01-02"),
		"term_months":       36,
		"payment_amount":    299.71,
		"payment_frequency": "monthly",
	}
	body, _ := json.Marshal(reqBody)

	req := httptest.NewRequest("POST", "/accounts/"+accountID+"/loan", bytes.NewReader(body))
	req = req.WithContext(account.CreateAuthContext(userID))

	// Setup chi context for URL params
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("id", accountID)
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

	w := httptest.NewRecorder()

	// Act
	handler.CreateLoanDetails(w, req)

	// Assert
	resp := w.Result()
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		t.Errorf("Expected status 201, got %d", resp.StatusCode)
	}
}

func TestHandleCreateLoanDetails_UnauthorizedAccess(t *testing.T) {
	db := account.SetupTestDB(t)
	defer account.CleanupTestDB(t, db)

	// Arrange
	owner := "test-user-owner-loan-handler-1"
	attacker := "test-user-attacker-loan-handler-1"
	account.CreateTestUser(t, db, owner)
	account.CreateTestUser(t, db, attacker)
	accountID := account.CreateTestAccount(t, db, owner, account.AccountTypeLoan)
	handler := setupHandler(db)

	reqBody := map[string]interface{}{
		"account_id":        accountID,
		"original_amount":   10000.00,
		"interest_rate":     0.05,
		"rate_type":         "fixed",
		"start_date":        time.Now().Format("2006-01-02"),
		"term_months":       36,
		"payment_amount":    299.71,
		"payment_frequency": "monthly",
	}
	body, _ := json.Marshal(reqBody)

	req := httptest.NewRequest("POST", "/accounts/"+accountID+"/loan", bytes.NewReader(body))
	req = req.WithContext(account.CreateAuthContext(attacker)) // Attacker context

	// Setup chi context for URL params
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("id", accountID)
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

	w := httptest.NewRecorder()

	// Act
	handler.CreateLoanDetails(w, req)

	// Assert
	resp := w.Result()
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusCreated {
		t.Error("Expected non-201 status for unauthorized access")
	}
}

func TestHandleCreateMortgageDetails_Success(t *testing.T) {
	db := account.SetupTestDB(t)
	defer account.CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-handler-mortgage-1"
	account.CreateTestUser(t, db, userID)
	accountID := account.CreateTestAccount(t, db, userID, account.AccountTypeMortgage)
	handler := setupHandler(db)

	reqBody := map[string]interface{}{
		"account_id":           accountID,
		"original_amount":      400000.00,
		"interest_rate":        0.03,
		"rate_type":            "fixed",
		"start_date":           time.Now().Format("2006-01-02"),
		"term_months":          60,
		"amortization_months":  300,
		"payment_amount":       1896.00,
		"payment_frequency":    "monthly",
		"property_address":     "123 Main St",
		"property_city":        "Toronto",
		"property_province":    "ON",
		"property_postal_code": "M1A 1A1",
	}
	body, _ := json.Marshal(reqBody)

	req := httptest.NewRequest("POST", "/accounts/"+accountID+"/mortgage", bytes.NewReader(body))
	req = req.WithContext(account.CreateAuthContext(userID))

	// Setup chi context for URL params
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("id", accountID)
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

	w := httptest.NewRecorder()

	// Act
	handler.CreateMortgageDetails(w, req)

	// Assert
	resp := w.Result()
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		body := make([]byte, 100)
		resp.Body.Read(body)
		t.Errorf("Expected status 201, got %d. Body: %s", resp.StatusCode, string(body))
	}
}

func TestHandleCreateMortgageDetails_UnauthorizedAccess(t *testing.T) {
	db := account.SetupTestDB(t)
	defer account.CleanupTestDB(t, db)

	// Arrange
	owner := "test-user-owner-mortgage-handler-1"
	attacker := "test-user-attacker-mortgage-handler-1"
	account.CreateTestUser(t, db, owner)
	account.CreateTestUser(t, db, attacker)
	accountID := account.CreateTestAccount(t, db, owner, account.AccountTypeMortgage)
	handler := setupHandler(db)

	reqBody := map[string]interface{}{
		"account_id":          accountID,
		"original_amount":     400000.00,
		"interest_rate":       0.03,
		"rate_type":           "fixed",
		"start_date":          time.Now().Format("2006-01-02"),
		"term_months":         60,
		"amortization_months": 300,
		"payment_amount":      1896.00,
		"payment_frequency":   "monthly",
	}
	body, _ := json.Marshal(reqBody)

	req := httptest.NewRequest("POST", "/accounts/"+accountID+"/mortgage", bytes.NewReader(body))
	req = req.WithContext(account.CreateAuthContext(attacker)) // Attacker context

	// Setup chi context for URL params
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("id", accountID)
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

	w := httptest.NewRecorder()

	// Act
	handler.CreateMortgageDetails(w, req)

	// Assert
	resp := w.Result()
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusCreated {
		t.Error("Expected non-201 status for unauthorized access")
	}
}

// Helper function to print response body for debugging
func printResponseBody(t *testing.T, resp *http.Response) {
	t.Helper()
	body := make([]byte, 1024)
	n, _ := resp.Body.Read(body)
	t.Logf("Response body: %s", string(body[:n]))
}
