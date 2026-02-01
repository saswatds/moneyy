package balance

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

	"money/internal/auth"
)

var (
	sharedDB     *sql.DB
	sharedDBOnce sync.Once
	sharedDBErr  error
)

// GetSharedDB returns a shared test database across all tests
func GetSharedDB(t *testing.T) *sql.DB {
	t.Helper()

	sharedDBOnce.Do(func() {
		// Create a temporary directory for the test database
		tempDir, err := os.MkdirTemp("", "moneyy-test-*")
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

		// SQLite works better with limited concurrency
		db.SetMaxOpenConns(1)
		db.SetMaxIdleConns(1)

		if err := db.Ping(); err != nil {
			sharedDBErr = fmt.Errorf("failed to ping database: %w", err)
			return
		}

		sharedDB = db

		// Run migrations on shared database
		if err := runMigrations(db); err != nil {
			sharedDBErr = fmt.Errorf("failed to run migrations: %w", err)
			return
		}
	})

	if sharedDBErr != nil {
		t.Fatalf("Failed to setup shared database: %v", sharedDBErr)
	}

	return sharedDB
}

// SetupTestDB sets up a test database connection
func SetupTestDB(t *testing.T) *sql.DB {
	t.Helper()
	return GetSharedDB(t)
}

// CleanupTestDB cleans up test data after tests
func CleanupTestDB(t *testing.T, db *sql.DB) {
	t.Helper()

	// Clean up test data
	tables := []string{"balances", "accounts", "users"}
	for _, table := range tables {
		var query string
		if table == "balances" {
			query = "DELETE FROM balances WHERE account_id LIKE 'test-%'"
		} else {
			query = fmt.Sprintf("DELETE FROM %s WHERE id LIKE 'test-%%'", table)
		}
		if _, err := db.Exec(query); err != nil {
			t.Logf("Warning: failed to clean %s: %v", table, err)
		}
	}

	// Note: Don't close the shared database
}

// runMigrations runs database migrations
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

// findMigrationsDir finds the migrations directory
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
		currentDir = filepath.Join(currentDir, "..")
	}
	return "", fmt.Errorf("migrations directory not found")
}

// CreateTestUser creates a test user
func CreateTestUser(t *testing.T, db *sql.DB, userID string) {
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

// CreateTestAccount creates a test account
func CreateTestAccount(t *testing.T, db *sql.DB, userID string) string {
	t.Helper()

	accountID := fmt.Sprintf("test-account-%d", time.Now().UnixNano())
	_, err := db.Exec(`
		INSERT INTO accounts (id, user_id, name, type, currency, is_asset, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`, accountID, userID, "Test Account", "savings", "CAD", 1, 1, time.Now(), time.Now())

	if err != nil {
		t.Fatalf("Failed to create test account: %v", err)
	}

	return accountID
}

// CreateAuthContext creates a context with user ID for testing
func CreateAuthContext(userID string) context.Context {
	return context.WithValue(context.Background(), auth.UserIDKey, userID)
}

func TestGetAccountBalances_WithNullNotes(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-null-notes-1"
	CreateTestUser(t, db, userID)
	accountID := CreateTestAccount(t, db, userID)
	service := NewService(db)

	// Insert a balance with NULL notes directly
	balanceID := fmt.Sprintf("test-balance-%d", time.Now().UnixNano())
	_, err := db.Exec(`
		INSERT INTO balances (id, account_id, amount, date, notes, created_at)
		VALUES ($1, $2, $3, $4, NULL, $5)
	`, balanceID, accountID, 1000.00, time.Now(), time.Now())
	if err != nil {
		t.Fatalf("Failed to insert balance with NULL notes: %v", err)
	}

	// Act
	resp, err := service.GetAccountBalances(context.Background(), accountID)

	// Assert
	if err != nil {
		t.Fatalf("GetAccountBalances failed with NULL notes: %v", err)
	}
	if resp == nil {
		t.Fatal("Expected response, got nil")
	}
	if len(resp.Balances) != 1 {
		t.Fatalf("Expected 1 balance, got %d", len(resp.Balances))
	}
	if resp.Balances[0].Notes != nil {
		t.Errorf("Expected nil notes, got %v", resp.Balances[0].Notes)
	}
}

func TestGetAccountBalances_WithNotes(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-with-notes-1"
	CreateTestUser(t, db, userID)
	accountID := CreateTestAccount(t, db, userID)
	service := NewService(db)

	// Insert a balance with notes
	balanceID := fmt.Sprintf("test-balance-%d", time.Now().UnixNano())
	expectedNotes := "Monthly deposit"
	_, err := db.Exec(`
		INSERT INTO balances (id, account_id, amount, date, notes, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, balanceID, accountID, 1500.00, time.Now(), expectedNotes, time.Now())
	if err != nil {
		t.Fatalf("Failed to insert balance with notes: %v", err)
	}

	// Act
	resp, err := service.GetAccountBalances(context.Background(), accountID)

	// Assert
	if err != nil {
		t.Fatalf("GetAccountBalances failed: %v", err)
	}
	if resp == nil {
		t.Fatal("Expected response, got nil")
	}
	if len(resp.Balances) != 1 {
		t.Fatalf("Expected 1 balance, got %d", len(resp.Balances))
	}
	if resp.Balances[0].Notes == nil {
		t.Fatal("Expected notes, got nil")
	}
	if *resp.Balances[0].Notes != expectedNotes {
		t.Errorf("Expected notes '%s', got '%s'", expectedNotes, *resp.Balances[0].Notes)
	}
}

func TestGet_WithNullNotes(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-get-null-notes-1"
	CreateTestUser(t, db, userID)
	accountID := CreateTestAccount(t, db, userID)
	service := NewService(db)

	// Insert a balance with NULL notes
	balanceID := fmt.Sprintf("test-balance-%d", time.Now().UnixNano())
	_, err := db.Exec(`
		INSERT INTO balances (id, account_id, amount, date, notes, created_at)
		VALUES ($1, $2, $3, $4, NULL, $5)
	`, balanceID, accountID, 2000.00, time.Now(), time.Now())
	if err != nil {
		t.Fatalf("Failed to insert balance: %v", err)
	}

	// Act
	balance, err := service.Get(context.Background(), balanceID)

	// Assert
	if err != nil {
		t.Fatalf("Get failed with NULL notes: %v", err)
	}
	if balance == nil {
		t.Fatal("Expected balance, got nil")
	}
	if balance.Notes != nil {
		t.Errorf("Expected nil notes, got %v", balance.Notes)
	}
}

func TestCreate_WithEmptyNotes(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-create-empty-notes-1"
	CreateTestUser(t, db, userID)
	accountID := CreateTestAccount(t, db, userID)
	service := NewService(db)

	req := &CreateBalanceRequest{
		AccountID: accountID,
		Amount:    500.00,
		Date:      time.Now(),
		Notes:     "", // empty notes
	}

	// Act
	resp, err := service.Create(context.Background(), req)

	// Assert
	if err != nil {
		t.Fatalf("Create failed: %v", err)
	}
	if resp == nil {
		t.Fatal("Expected response, got nil")
	}
	if resp.Balance.Notes != nil {
		t.Errorf("Expected nil notes for empty string, got %v", resp.Balance.Notes)
	}
}

func TestCreate_WithNotes(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Arrange
	userID := "test-user-create-with-notes-1"
	CreateTestUser(t, db, userID)
	accountID := CreateTestAccount(t, db, userID)
	service := NewService(db)

	expectedNotes := "Initial deposit"
	req := &CreateBalanceRequest{
		AccountID: accountID,
		Amount:    1000.00,
		Date:      time.Now(),
		Notes:     expectedNotes,
	}

	// Act
	resp, err := service.Create(context.Background(), req)

	// Assert
	if err != nil {
		t.Fatalf("Create failed: %v", err)
	}
	if resp == nil {
		t.Fatal("Expected response, got nil")
	}
	if resp.Balance.Notes == nil {
		t.Fatal("Expected notes, got nil")
	}
	if *resp.Balance.Notes != expectedNotes {
		t.Errorf("Expected notes '%s', got '%s'", expectedNotes, *resp.Balance.Notes)
	}
}
