package account

import (
	"context"
	"database/sql"
	"fmt"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/testcontainers/testcontainers-go"
	testpostgres "github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"

	"money/internal/auth"
	"money/internal/balance"
)

var (
	sharedContainer     *TestContainer
	sharedContainerOnce sync.Once
	sharedContainerErr  error
)

// TestContainer holds the test container and connection info
type TestContainer struct {
	Container  *testpostgres.PostgresContainer
	ConnString string
}

// GetSharedContainer returns a shared test container across all tests
func GetSharedContainer(t *testing.T) *TestContainer {
	t.Helper()

	sharedContainerOnce.Do(func() {
		ctx := context.Background()

		container, err := testpostgres.Run(ctx,
			"postgres:15-alpine",
			testpostgres.WithDatabase("testdb"),
			testpostgres.WithUsername("testuser"),
			testpostgres.WithPassword("testpass"),
			testcontainers.WithWaitStrategy(
				wait.ForLog("database system is ready to accept connections").
					WithOccurrence(2).
					WithStartupTimeout(5*time.Minute)),
		)

		if err != nil {
			sharedContainerErr = fmt.Errorf("failed to start container: %w", err)
			return
		}

		connStr, err := container.ConnectionString(ctx, "sslmode=disable")
		if err != nil {
			sharedContainerErr = fmt.Errorf("failed to get connection string: %w", err)
			return
		}

		sharedContainer = &TestContainer{
			Container:  container,
			ConnString: connStr,
		}

		// Run migrations on shared container
		if err := runMigrations(connStr); err != nil {
			sharedContainerErr = fmt.Errorf("failed to run migrations: %w", err)
			return
		}
	})

	if sharedContainerErr != nil {
		t.Fatalf("Failed to setup shared container: %v", sharedContainerErr)
	}

	return sharedContainer
}

// SetupTestDB sets up a test database connection
func SetupTestDB(t *testing.T) *sql.DB {
	t.Helper()

	container := GetSharedContainer(t)

	db, err := sql.Open("postgres", container.ConnString)
	if err != nil {
		t.Fatalf("Failed to open database: %v", err)
	}

	if err := db.Ping(); err != nil {
		t.Fatalf("Failed to ping database: %v", err)
	}

	return db
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

		// Silently ignore cleanup errors - test containers are ephemeral
		_, _ = db.Exec(query)
	}

	db.Close()
}

// runMigrations runs database migrations
func runMigrations(connStr string) error {
	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return err
	}
	defer db.Close()

	driver, err := postgres.WithInstance(db, &postgres.Config{})
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
		"postgres", driver)
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
		if _, err := filepath.Abs(filepath.Join(currentDir, "go.mod")); err == nil {
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

	accountID := fmt.Sprintf("test-account-%d", time.Now().UnixNano())
	_, err := db.Exec(`
		INSERT INTO accounts (id, user_id, name, type, currency, is_asset, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`, accountID, userID, "Test Account", accountType, "CAD", isAsset, true, time.Now(), time.Now())

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
