package account

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
	"money/internal/balance"
)

var (
	sharedDB     *sql.DB
	sharedDBOnce sync.Once
	sharedDBErr  error
	tempDir      string
)

// GetSharedDB returns a shared test database across all tests
func GetSharedDB(t *testing.T) *sql.DB {
	t.Helper()

	sharedDBOnce.Do(func() {
		// Create a temporary directory for the test database
		var err error
		tempDir, err = os.MkdirTemp("", "moneyy-account-test-*")
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

		// Run migrations on shared database
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

// SetupTestDB sets up a test database connection
func SetupTestDB(t *testing.T) *sql.DB {
	t.Helper()
	return GetSharedDB(t)
}

// CleanupTestDB cleans up test data after tests
func CleanupTestDB(t *testing.T, db *sql.DB) {
	t.Helper()

	// Clean up test data in reverse dependency order
	tables := []string{
		"asset_depreciation_entries",
		"mortgage_payments",
		"loan_payments",
		"asset_details",
		"mortgage_details",
		"loan_details",
		"balances",
		"accounts",
		"users",
	}

	for _, table := range tables {
		var query string
		switch table {
		case "balances", "asset_depreciation_entries", "mortgage_payments", "loan_payments",
			"asset_details", "mortgage_details", "loan_details":
			query = fmt.Sprintf("DELETE FROM %s WHERE account_id LIKE 'test-%%'", table)
		case "accounts":
			query = fmt.Sprintf("DELETE FROM %s WHERE id LIKE 'test-%%' OR user_id LIKE 'test-%%'", table)
		case "users":
			query = fmt.Sprintf("DELETE FROM %s WHERE id LIKE 'test-%%'", table)
		default:
			query = fmt.Sprintf("DELETE FROM %s WHERE id LIKE 'test-%%'", table)
		}

		// Silently ignore cleanup errors
		_, _ = db.Exec(query)
	}

	// Note: Don't close the shared database
}

// runMigrations runs database migrations
func runMigrations(db *sql.DB) error {
	driver, err := sqlite3.WithInstance(db, &sqlite3.Config{})
	if err != nil {
		return err
	}

	// Find migrations directory
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
	// Start from current directory and search up
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

		// Check for go.mod to find project root
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
func CreateTestAccount(t *testing.T, db *sql.DB, userID string, accountType AccountType) string {
	t.Helper()

	// Determine if account is an asset based on type
	isAsset := accountType == AccountTypeSavings ||
		accountType == AccountTypeChecking ||
		accountType == AccountTypeCash ||
		accountType == AccountTypeBrokerage ||
		accountType == AccountTypeTFSA ||
		accountType == AccountTypeRRSP ||
		accountType == AccountTypeCrypto ||
		accountType == AccountTypeRealEstate ||
		accountType == AccountTypeVehicle ||
		accountType == AccountTypeCollectible

	// SQLite uses 1/0 for boolean
	isAssetInt := 0
	if isAsset {
		isAssetInt = 1
	}

	accountID := fmt.Sprintf("test-account-%d", time.Now().UnixNano())
	_, err := db.Exec(`
		INSERT INTO accounts (id, user_id, name, type, currency, is_asset, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`, accountID, userID, "Test Account", accountType, "CAD", isAssetInt, 1, time.Now(), time.Now())

	if err != nil {
		t.Fatalf("Failed to create test account: %v", err)
	}

	return accountID
}

// CreateTestBalance creates a test balance entry
func CreateTestBalance(t *testing.T, db *sql.DB, accountID string, amount float64) {
	t.Helper()

	_, err := db.Exec(`
		INSERT INTO balances (id, account_id, amount, date, created_at)
		VALUES ($1, $2, $3, $4, $5)
	`, fmt.Sprintf("test-balance-%d", time.Now().UnixNano()), accountID, amount, time.Now(), time.Now())

	if err != nil {
		t.Fatalf("Failed to create test balance: %v", err)
	}
}

// CreateAuthContext creates a context with user ID for testing
func CreateAuthContext(userID string) context.Context {
	return context.WithValue(context.Background(), auth.UserIDKey, userID)
}

// SetupAccountService sets up account service for testing
func SetupAccountService(t *testing.T, db *sql.DB) *Service {
	t.Helper()

	balanceSvc := balance.NewService(db)
	return NewService(db, db, balanceSvc)
}

// Legacy types for backwards compatibility
type TestContainer struct {
	DB *sql.DB
}

// GetSharedContainer is an alias for GetSharedDB for backwards compatibility
func GetSharedContainer(t *testing.T) *TestContainer {
	db := GetSharedDB(t)
	return &TestContainer{DB: db}
}
