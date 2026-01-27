package data

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"testing"

	_ "github.com/jackc/pgx/v5/stdlib"
)

// TestExportData_Success tests successful export of data
func TestExportData_Success(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Create test data
	userID := "test-user-1"
	accountID := CreateTestAccount(t, db, userID)
	CreateTestBalance(t, db, accountID)

	// Create export service
	service := NewExportService(db)

	// Export data
	ctx := context.Background()
	archive, err := service.ExportData(ctx, userID)
	if err != nil {
		t.Fatalf("ExportData failed: %v", err)
	}

	// Verify archive is not empty
	if len(archive) == 0 {
		t.Fatal("Export produced empty archive")
	}

	// Verify archive is valid ZIP
	reader, err := zip.NewReader(bytes.NewReader(archive), int64(len(archive)))
	if err != nil {
		t.Fatalf("Failed to open ZIP archive: %v", err)
	}

	// Verify manifest exists
	manifestFile := findFile(reader, "manifest.json")
	if manifestFile == nil {
		t.Fatal("manifest.json not found in archive")
	}

	// Read and verify manifest
	manifestData, err := readZipFile(manifestFile)
	if err != nil {
		t.Fatalf("Failed to read manifest: %v", err)
	}

	var manifest ExportManifest
	if err := json.Unmarshal(manifestData, &manifest); err != nil {
		t.Fatalf("Failed to parse manifest: %v", err)
	}

	// Verify manifest fields
	if manifest.Version != ExportVersion {
		t.Errorf("Expected version %s, got %s", ExportVersion, manifest.Version)
	}
	if manifest.UserID != userID {
		t.Errorf("Expected userID %s, got %s", userID, manifest.UserID)
	}
	if manifest.AppVersion != AppVersion {
		t.Errorf("Expected app version %s, got %s", AppVersion, manifest.AppVersion)
	}

	// Verify accounts table exists in manifest
	if _, ok := manifest.Tables["accounts"]; !ok {
		t.Error("accounts table not found in manifest")
	}

	// Verify accounts.json exists
	accountsFile := findFile(reader, "accounts.json")
	if accountsFile == nil {
		t.Fatal("accounts.json not found in archive")
	}

	// Read and verify accounts data
	accountsData, err := readZipFile(accountsFile)
	if err != nil {
		t.Fatalf("Failed to read accounts.json: %v", err)
	}

	var accounts []Account
	if err := json.Unmarshal(accountsData, &accounts); err != nil {
		t.Fatalf("Failed to parse accounts.json: %v", err)
	}

	if len(accounts) != 1 {
		t.Errorf("Expected 1 account, got %d", len(accounts))
	}

	if len(accounts) > 0 && accounts[0].ID != accountID {
		t.Errorf("Expected account ID %s, got %s", accountID, accounts[0].ID)
	}
}

// TestExportData_EmptyDatabase tests export with no data
func TestExportData_EmptyDatabase(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	service := NewExportService(db)
	userID := "empty-user"

	ctx := context.Background()
	archive, err := service.ExportData(ctx, userID)
	if err != nil {
		t.Fatalf("ExportData failed: %v", err)
	}

	// Verify archive still created with empty tables
	reader, err := zip.NewReader(bytes.NewReader(archive), int64(len(archive)))
	if err != nil {
		t.Fatalf("Failed to open ZIP archive: %v", err)
	}

	// Verify manifest exists
	manifestFile := findFile(reader, "manifest.json")
	if manifestFile == nil {
		t.Fatal("manifest.json not found in archive")
	}

	// Verify accounts.json exists but is empty array
	accountsFile := findFile(reader, "accounts.json")
	if accountsFile == nil {
		t.Fatal("accounts.json not found in archive")
	}

	accountsData, err := readZipFile(accountsFile)
	if err != nil {
		t.Fatalf("Failed to read accounts.json: %v", err)
	}

	var accounts []Account
	if err := json.Unmarshal(accountsData, &accounts); err != nil {
		t.Fatalf("Failed to parse accounts.json: %v", err)
	}

	if len(accounts) != 0 {
		t.Errorf("Expected 0 accounts, got %d", len(accounts))
	}
}

// TestExportData_MultipleRecords tests export with multiple records
func TestExportData_MultipleRecords(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	userID := "test-user-multi"

	// Create multiple accounts
	accountID1 := CreateTestAccount(t, db, userID)
	accountID2 := CreateTestAccount(t, db, userID)

	// Create balances for both accounts
	CreateTestBalance(t, db, accountID1)
	CreateTestBalance(t, db, accountID2)

	service := NewExportService(db)

	ctx := context.Background()
	archive, err := service.ExportData(ctx, userID)
	if err != nil {
		t.Fatalf("ExportData failed: %v", err)
	}

	reader, err := zip.NewReader(bytes.NewReader(archive), int64(len(archive)))
	if err != nil {
		t.Fatalf("Failed to open ZIP archive: %v", err)
	}

	// Verify accounts
	accountsFile := findFile(reader, "accounts.json")
	if accountsFile == nil {
		t.Fatal("accounts.json not found in archive")
	}

	accountsData, err := readZipFile(accountsFile)
	if err != nil {
		t.Fatalf("Failed to read accounts.json: %v", err)
	}

	var accounts []Account
	if err := json.Unmarshal(accountsData, &accounts); err != nil {
		t.Fatalf("Failed to parse accounts.json: %v", err)
	}

	if len(accounts) != 2 {
		t.Errorf("Expected 2 accounts, got %d", len(accounts))
	}

	// Verify balances
	balancesFile := findFile(reader, "balances.json")
	if balancesFile == nil {
		t.Fatal("balances.json not found in archive")
	}

	balancesData, err := readZipFile(balancesFile)
	if err != nil {
		t.Fatalf("Failed to read balances.json: %v", err)
	}

	var balances []Balance
	if err := json.Unmarshal(balancesData, &balances); err != nil {
		t.Fatalf("Failed to parse balances.json: %v", err)
	}

	if len(balances) != 2 {
		t.Errorf("Expected 2 balances, got %d", len(balances))
	}
}

// TestExportData_UserIsolation tests that only user's data is exported
func TestExportData_UserIsolation(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	userID1 := "test-user-1"
	userID2 := "test-user-2"

	// Create accounts for both users
	CreateTestAccount(t, db, userID1)
	CreateTestAccount(t, db, userID2)

	service := NewExportService(db)

	// Export for user1
	ctx := context.Background()
	archive, err := service.ExportData(ctx, userID1)
	if err != nil {
		t.Fatalf("ExportData failed: %v", err)
	}

	reader, err := zip.NewReader(bytes.NewReader(archive), int64(len(archive)))
	if err != nil {
		t.Fatalf("Failed to open ZIP archive: %v", err)
	}

	// Verify only user1's data is included
	accountsFile := findFile(reader, "accounts.json")
	accountsData, err := readZipFile(accountsFile)
	if err != nil {
		t.Fatalf("Failed to read accounts.json: %v", err)
	}

	var accounts []Account
	if err := json.Unmarshal(accountsData, &accounts); err != nil {
		t.Fatalf("Failed to parse accounts.json: %v", err)
	}

	if len(accounts) != 1 {
		t.Errorf("Expected 1 account for user1, got %d", len(accounts))
	}

	if len(accounts) > 0 && accounts[0].UserID != userID1 {
		t.Errorf("Expected userID %s, got %s", userID1, accounts[0].UserID)
	}
}

// TestCreateManifest tests manifest creation
func TestCreateManifest(t *testing.T) {
	service := &ExportService{}
	userID := "test-user"

	tables := map[string][]byte{
		"accounts": []byte(`[{"id":"1","user_id":"test-user","name":"Test"}]`),
		"balances": []byte(`[]`),
	}

	manifest := service.createManifest(userID, tables)

	// Verify manifest fields
	if manifest.Version != ExportVersion {
		t.Errorf("Expected version %s, got %s", ExportVersion, manifest.Version)
	}
	if manifest.UserID != userID {
		t.Errorf("Expected userID %s, got %s", userID, manifest.UserID)
	}
	if len(manifest.Tables) != 2 {
		t.Errorf("Expected 2 tables in manifest, got %d", len(manifest.Tables))
	}

	// Verify accounts table metadata
	accountsMeta, ok := manifest.Tables["accounts"]
	if !ok {
		t.Fatal("accounts table not found in manifest")
	}
	if accountsMeta.Count != 1 {
		t.Errorf("Expected 1 account record, got %d", accountsMeta.Count)
	}
	if accountsMeta.Checksum == "" {
		t.Error("Checksum should not be empty")
	}

	// Verify balances table metadata
	balancesMeta, ok := manifest.Tables["balances"]
	if !ok {
		t.Fatal("balances table not found in manifest")
	}
	if balancesMeta.Count != 0 {
		t.Errorf("Expected 0 balance records, got %d", balancesMeta.Count)
	}
}

// Note: Helper functions are now in test_helpers.go
