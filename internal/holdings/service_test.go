package holdings

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/sqlite3"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	_ "modernc.org/sqlite"
)

var (
	sharedDB     *sql.DB
	sharedDBOnce sync.Once
	sharedDBErr  error
)

func getSharedDB(t *testing.T) *sql.DB {
	t.Helper()

	sharedDBOnce.Do(func() {
		tempDir, err := os.MkdirTemp("", "moneyy-holdings-test-*")
		if err != nil {
			sharedDBErr = fmt.Errorf("failed to create temp dir: %w", err)
			return
		}

		dbPath := filepath.Join(tempDir, "test.db")
		dsn := fmt.Sprintf("%s?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)&_pragma=foreign_keys(ON)", dbPath)

		db, err := sql.Open("sqlite", dsn)
		if err != nil {
			sharedDBErr = fmt.Errorf("failed to open database: %w", err)
			return
		}

		db.SetMaxOpenConns(1)
		db.SetMaxIdleConns(1)

		if err := db.Ping(); err != nil {
			sharedDBErr = fmt.Errorf("failed to ping database: %w", err)
			return
		}

		if err := runMigrations(db); err != nil {
			db.Close()
			sharedDBErr = fmt.Errorf("failed to run migrations: %w", err)
			return
		}

		sharedDB = db
	})

	if sharedDBErr != nil {
		t.Fatalf("Failed to setup shared database: %v", sharedDBErr)
	}

	return sharedDB
}

func runMigrations(db *sql.DB) error {
	driver, err := sqlite3.WithInstance(db, &sqlite3.Config{})
	if err != nil {
		return err
	}

	migrationsPath, err := findMigrationsDir()
	if err != nil {
		return err
	}

	m, err := migrate.NewWithDatabaseInstance(
		fmt.Sprintf("file://%s", migrationsPath),
		"sqlite3", driver)
	if err != nil {
		return err
	}

	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		return err
	}

	return nil
}

func findMigrationsDir() (string, error) {
	currentDir, err := filepath.Abs(".")
	if err != nil {
		return "", err
	}

	for i := 0; i < 10; i++ {
		migrationsPath := filepath.Join(currentDir, "migrations")
		files, err := filepath.Glob(filepath.Join(migrationsPath, "*.sql"))
		if err == nil && len(files) > 0 {
			return migrationsPath, nil
		}

		if _, err := os.Stat(filepath.Join(currentDir, "go.mod")); err == nil {
			migrationsPath := filepath.Join(currentDir, "migrations")
			files, _ := filepath.Glob(filepath.Join(migrationsPath, "*.sql"))
			if len(files) > 0 {
				return migrationsPath, nil
			}
		}

		currentDir = filepath.Join(currentDir, "..")
	}
	return "", fmt.Errorf("migrations directory not found")
}

func setupTestDB(t *testing.T) *sql.DB {
	t.Helper()
	return getSharedDB(t)
}

func cleanupTestDB(t *testing.T, db *sql.DB) {
	t.Helper()
	_, _ = db.Exec("DELETE FROM holdings WHERE id LIKE 'test-%' OR account_id LIKE 'test-%'")
	_, _ = db.Exec("DELETE FROM accounts WHERE id LIKE 'test-%' OR user_id LIKE 'test-%'")
	_, _ = db.Exec("DELETE FROM users WHERE id LIKE 'test-%'")
}

func createTestUser(t *testing.T, db *sql.DB, userID string) {
	t.Helper()
	_, err := db.Exec(`
		INSERT INTO users (id, email, created_at, updated_at)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (id) DO NOTHING
	`, userID, userID+"@test.com", time.Now(), time.Now())
	if err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}
}

func createTestAccount(t *testing.T, db *sql.DB, userID string) string {
	t.Helper()
	accountID := fmt.Sprintf("test-account-%d", time.Now().UnixNano())
	_, err := db.Exec(`
		INSERT INTO accounts (id, user_id, name, type, currency, is_asset, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`, accountID, userID, "Test Brokerage", "brokerage", "CAD", 1, 1, time.Now(), time.Now())
	if err != nil {
		t.Fatalf("Failed to create test account: %v", err)
	}
	return accountID
}

func TestCreate_Success(t *testing.T) {
	db := setupTestDB(t)
	defer cleanupTestDB(t, db)

	// Arrange
	userID := "test-user-holdings-1"
	createTestUser(t, db, userID)
	accountID := createTestAccount(t, db, userID)
	service := NewService(db)

	symbol := "AAPL"
	quantity := 100.0
	costBasis := 15000.0
	req := &CreateHoldingRequest{
		AccountID: accountID,
		Type:      HoldingTypeStock,
		Symbol:    &symbol,
		Quantity:  &quantity,
		CostBasis: &costBasis,
	}

	// Act
	resp, err := service.Create(context.Background(), req)

	// Assert
	if err != nil {
		t.Fatalf("Create failed: %v", err)
	}
	if resp == nil || resp.Holding == nil {
		t.Fatal("Expected holding, got nil")
	}
	if *resp.Holding.Symbol != "AAPL" {
		t.Errorf("Expected symbol AAPL, got %s", *resp.Holding.Symbol)
	}
	if *resp.Holding.Quantity != 100.0 {
		t.Errorf("Expected quantity 100, got %f", *resp.Holding.Quantity)
	}
	if resp.Holding.ID == "" {
		t.Error("Expected non-empty holding ID")
	}
}

func TestCreate_Upsert(t *testing.T) {
	db := setupTestDB(t)
	defer cleanupTestDB(t, db)

	// Arrange
	userID := "test-user-holdings-upsert-1"
	createTestUser(t, db, userID)
	accountID := createTestAccount(t, db, userID)
	service := NewService(db)

	symbol := "GOOGL"
	quantity1 := 50.0
	costBasis1 := 5000.0
	req1 := &CreateHoldingRequest{
		AccountID: accountID,
		Type:      HoldingTypeStock,
		Symbol:    &symbol,
		Quantity:  &quantity1,
		CostBasis: &costBasis1,
	}

	// Create first holding
	resp1, _ := service.Create(context.Background(), req1)
	firstID := resp1.Holding.ID

	// Create second holding with same symbol (should upsert)
	quantity2 := 75.0
	costBasis2 := 7500.0
	req2 := &CreateHoldingRequest{
		AccountID: accountID,
		Type:      HoldingTypeStock,
		Symbol:    &symbol,
		Quantity:  &quantity2,
		CostBasis: &costBasis2,
	}

	// Act
	resp2, err := service.Create(context.Background(), req2)

	// Assert
	if err != nil {
		t.Fatalf("Upsert failed: %v", err)
	}
	if resp2 == nil || resp2.Holding == nil {
		t.Fatal("Expected holding, got nil")
	}
	if !resp2.WasUpdate {
		t.Error("Expected WasUpdate to be true")
	}
	if resp2.Holding.ID != firstID {
		t.Errorf("Expected same ID %s, got %s", firstID, resp2.Holding.ID)
	}
	if *resp2.Holding.Quantity != 75.0 {
		t.Errorf("Expected updated quantity 75, got %f", *resp2.Holding.Quantity)
	}
}

func TestCreate_CashHolding(t *testing.T) {
	db := setupTestDB(t)
	defer cleanupTestDB(t, db)

	// Arrange
	userID := "test-user-holdings-cash-1"
	createTestUser(t, db, userID)
	accountID := createTestAccount(t, db, userID)
	service := NewService(db)

	currency := "USD"
	amount := 5000.0
	req := &CreateHoldingRequest{
		AccountID: accountID,
		Type:      HoldingTypeCash,
		Currency:  &currency,
		Amount:    &amount,
	}

	// Act
	resp, err := service.Create(context.Background(), req)

	// Assert
	if err != nil {
		t.Fatalf("Create cash holding failed: %v", err)
	}
	if resp == nil || resp.Holding == nil {
		t.Fatal("Expected holding, got nil")
	}
	if resp.Holding.Type != HoldingTypeCash {
		t.Errorf("Expected type cash, got %s", resp.Holding.Type)
	}
	if *resp.Holding.Amount != 5000.0 {
		t.Errorf("Expected amount 5000, got %f", *resp.Holding.Amount)
	}
}

func TestGetAccountHoldings_Success(t *testing.T) {
	db := setupTestDB(t)
	defer cleanupTestDB(t, db)

	// Arrange
	userID := "test-user-holdings-list-1"
	createTestUser(t, db, userID)
	accountID := createTestAccount(t, db, userID)
	service := NewService(db)

	// Create multiple holdings
	symbols := []string{"AAPL", "GOOGL", "MSFT"}
	for i, sym := range symbols {
		symbol := sym
		quantity := float64((i + 1) * 10)
		costBasis := float64((i + 1) * 1000)
		service.Create(context.Background(), &CreateHoldingRequest{
			AccountID: accountID,
			Type:      HoldingTypeStock,
			Symbol:    &symbol,
			Quantity:  &quantity,
			CostBasis: &costBasis,
		})
	}

	// Act
	resp, err := service.GetAccountHoldings(context.Background(), accountID)

	// Assert
	if err != nil {
		t.Fatalf("GetAccountHoldings failed: %v", err)
	}
	if resp == nil {
		t.Fatal("Expected response, got nil")
	}
	if len(resp.Holdings) != 3 {
		t.Errorf("Expected 3 holdings, got %d", len(resp.Holdings))
	}
}

func TestGet_Success(t *testing.T) {
	db := setupTestDB(t)
	defer cleanupTestDB(t, db)

	// Arrange
	userID := "test-user-holdings-get-1"
	createTestUser(t, db, userID)
	accountID := createTestAccount(t, db, userID)
	service := NewService(db)

	symbol := "TSLA"
	quantity := 25.0
	costBasis := 2500.0
	createResp, _ := service.Create(context.Background(), &CreateHoldingRequest{
		AccountID: accountID,
		Type:      HoldingTypeStock,
		Symbol:    &symbol,
		Quantity:  &quantity,
		CostBasis: &costBasis,
	})

	// Act
	holding, err := service.Get(context.Background(), createResp.Holding.ID)

	// Assert
	if err != nil {
		t.Fatalf("Get failed: %v", err)
	}
	if holding == nil {
		t.Fatal("Expected holding, got nil")
	}
	if holding.ID != createResp.Holding.ID {
		t.Errorf("Expected ID %s, got %s", createResp.Holding.ID, holding.ID)
	}
	if *holding.Symbol != "TSLA" {
		t.Errorf("Expected symbol TSLA, got %s", *holding.Symbol)
	}
}

func TestUpdate_Success(t *testing.T) {
	db := setupTestDB(t)
	defer cleanupTestDB(t, db)

	// Arrange
	userID := "test-user-holdings-update-1"
	createTestUser(t, db, userID)
	accountID := createTestAccount(t, db, userID)
	service := NewService(db)

	symbol := "NVDA"
	quantity := 50.0
	costBasis := 5000.0
	createResp, _ := service.Create(context.Background(), &CreateHoldingRequest{
		AccountID: accountID,
		Type:      HoldingTypeStock,
		Symbol:    &symbol,
		Quantity:  &quantity,
		CostBasis: &costBasis,
	})

	newQuantity := 75.0
	newCostBasis := 7500.0
	req := &UpdateHoldingRequest{
		Quantity:  &newQuantity,
		CostBasis: &newCostBasis,
	}

	// Act
	holding, err := service.Update(context.Background(), createResp.Holding.ID, req)

	// Assert
	if err != nil {
		t.Fatalf("Update failed: %v", err)
	}
	if holding == nil {
		t.Fatal("Expected holding, got nil")
	}
	if *holding.Quantity != 75.0 {
		t.Errorf("Expected quantity 75, got %f", *holding.Quantity)
	}
	if *holding.CostBasis != 7500.0 {
		t.Errorf("Expected cost basis 7500, got %f", *holding.CostBasis)
	}
}

func TestDelete_Success(t *testing.T) {
	db := setupTestDB(t)
	defer cleanupTestDB(t, db)

	// Arrange
	userID := "test-user-holdings-delete-1"
	createTestUser(t, db, userID)
	accountID := createTestAccount(t, db, userID)
	service := NewService(db)

	symbol := "AMD"
	quantity := 30.0
	costBasis := 3000.0
	createResp, _ := service.Create(context.Background(), &CreateHoldingRequest{
		AccountID: accountID,
		Type:      HoldingTypeStock,
		Symbol:    &symbol,
		Quantity:  &quantity,
		CostBasis: &costBasis,
	})

	// Act
	deleteResp, err := service.Delete(context.Background(), createResp.Holding.ID)

	// Assert
	if err != nil {
		t.Fatalf("Delete failed: %v", err)
	}
	if deleteResp == nil || !deleteResp.Success {
		t.Error("Expected successful deletion")
	}

	// Verify deletion
	_, err = service.Get(context.Background(), createResp.Holding.ID)
	if err == nil {
		t.Error("Expected error when getting deleted holding")
	}
}
