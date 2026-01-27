package data

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"
)

// TestContainer holds the PostgreSQL test container and database connection
type TestContainer struct {
	Container *postgres.PostgresContainer
	DB        *sql.DB
	ConnStr   string
}

var (
	// Package-level container - shared across all tests in the package
	sharedContainer *TestContainer
	containerMu     sync.Mutex
	containerOnce   sync.Once
)

// GetSharedContainer returns the shared test container, creating it if necessary
func GetSharedContainer(t *testing.T) *TestContainer {
	t.Helper()

	containerOnce.Do(func() {
		ctx := context.Background()

		// Create PostgreSQL container
		pgContainer, err := postgres.Run(ctx,
			"postgres:15-alpine",
			postgres.WithDatabase("testdb"),
			postgres.WithUsername("testuser"),
			postgres.WithPassword("testpass"),
			testcontainers.WithWaitStrategy(
				wait.ForLog("database system is ready to accept connections").
					WithOccurrence(2).
					WithStartupTimeout(60*time.Second)),
		)
		if err != nil {
			t.Fatalf("Failed to start PostgreSQL container: %v", err)
		}

		// Get connection string
		connStr, err := pgContainer.ConnectionString(ctx, "sslmode=disable")
		if err != nil {
			t.Fatalf("Failed to get connection string: %v", err)
		}

		// Connect to database
		db, err := sql.Open("pgx", connStr)
		if err != nil {
			pgContainer.Terminate(ctx)
			t.Fatalf("Failed to connect to test database: %v", err)
		}

		// Verify connection
		if err := db.Ping(); err != nil {
			db.Close()
			pgContainer.Terminate(ctx)
			t.Fatalf("Failed to ping test database: %v", err)
		}

		// Run migrations
		if err := runMigrations(connStr); err != nil {
			db.Close()
			pgContainer.Terminate(ctx)
			t.Fatalf("Failed to run migrations: %v", err)
		}

		sharedContainer = &TestContainer{
			Container: pgContainer,
			DB:        db,
			ConnStr:   connStr,
		}
	})

	return sharedContainer
}

// SetupTestContainer creates a PostgreSQL container and runs migrations
// Deprecated: Use GetSharedContainer instead for better performance
func SetupTestContainer(t *testing.T) *TestContainer {
	t.Helper()

	ctx := context.Background()

	// Create PostgreSQL container
	pgContainer, err := postgres.Run(ctx,
		"postgres:15-alpine",
		postgres.WithDatabase("testdb"),
		postgres.WithUsername("testuser"),
		postgres.WithPassword("testpass"),
		testcontainers.WithWaitStrategy(
			wait.ForLog("database system is ready to accept connections").
				WithOccurrence(2).
				WithStartupTimeout(60*time.Second)),
	)
	if err != nil {
		t.Fatalf("Failed to start PostgreSQL container: %v", err)
	}

	// Get connection string
	connStr, err := pgContainer.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		t.Fatalf("Failed to get connection string: %v", err)
	}

	// Connect to database
	db, err := sql.Open("pgx", connStr)
	if err != nil {
		pgContainer.Terminate(ctx)
		t.Fatalf("Failed to connect to test database: %v", err)
	}

	// Verify connection
	if err := db.Ping(); err != nil {
		db.Close()
		pgContainer.Terminate(ctx)
		t.Fatalf("Failed to ping test database: %v", err)
	}

	// Run migrations
	if err := runMigrations(connStr); err != nil {
		db.Close()
		pgContainer.Terminate(ctx)
		t.Fatalf("Failed to run migrations: %v", err)
	}

	return &TestContainer{
		Container: pgContainer,
		DB:        db,
		ConnStr:   connStr,
	}
}

// findMigrationsPath finds the migrations directory by searching up from the current directory
func findMigrationsPath() (string, error) {
	// Start from current working directory
	dir, err := filepath.Abs(".")
	if err != nil {
		return "", err
	}

	// Search up the directory tree for go.mod (project root marker)
	for {
		goModPath := filepath.Join(dir, "go.mod")
		if _, err := os.Stat(goModPath); err == nil {
			// Found go.mod, return migrations path
			migrationsPath := filepath.Join(dir, "migrations")
			return migrationsPath, nil
		}

		// Move up one directory
		parent := filepath.Dir(dir)
		if parent == dir {
			// Reached root without finding go.mod
			break
		}
		dir = parent
	}

	return "", fmt.Errorf("could not find migrations directory")
}

// runMigrations runs database migrations on the test database
func runMigrations(connStr string) error {
	// Get migrations directory path by finding project root
	// Look for go.mod to identify project root
	migrationsPath, err := findMigrationsPath()
	if err != nil {
		return fmt.Errorf("failed to get migrations path: %w", err)
	}

	// Create migrate instance
	m, err := migrate.New(
		"file://"+migrationsPath,
		connStr,
	)
	if err != nil {
		return fmt.Errorf("failed to create migrate instance: %w", err)
	}
	defer m.Close()

	// Run migrations
	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		return fmt.Errorf("failed to run migrations: %w", err)
	}

	return nil
}

// CleanupTestContainer stops the container and closes the database connection
func CleanupTestContainer(t *testing.T, tc *TestContainer) {
	t.Helper()

	if tc.DB != nil {
		tc.DB.Close()
	}

	if tc.Container != nil {
		ctx := context.Background()
		if err := tc.Container.Terminate(ctx); err != nil {
			t.Logf("Warning: Failed to terminate container: %v", err)
		}
	}
}

// SetupTestDB creates a test database connection using the shared container
func SetupTestDB(t *testing.T) *sql.DB {
	t.Helper()

	tc := GetSharedContainer(t)

	// Clean up test data after this test completes
	t.Cleanup(func() {
		CleanupTestDB(t, tc.DB)
	})

	return tc.DB
}

// CleanupTestDB removes test data (but doesn't close the DB or kill container)
func CleanupTestDB(t *testing.T, db *sql.DB) {
	t.Helper()

	// Clean up tables in dependency order
	// holding_transactions references holdings (holding_id)
	db.Exec("DELETE FROM holding_transactions WHERE holding_id IN (SELECT id FROM holdings WHERE account_id IN (SELECT id FROM accounts WHERE user_id LIKE 'test-%' OR user_id LIKE 'empty-%'))")

	// synced_accounts references sync_credentials (credential_id) and accounts (local_account_id)
	db.Exec("DELETE FROM synced_accounts WHERE credential_id IN (SELECT id FROM sync_credentials WHERE user_id LIKE 'test-%' OR user_id LIKE 'empty-%')")
	db.Exec("DELETE FROM synced_accounts WHERE local_account_id IN (SELECT id FROM accounts WHERE user_id LIKE 'test-%' OR user_id LIKE 'empty-%')")

	// Tables with account_id
	tablesWithAccountID := []string{
		"asset_depreciation_entries",
		"asset_details",
		"loan_payments",
		"loan_details",
		"mortgage_payments",
		"mortgage_details",
		"holdings",
		"balances",
	}

	for _, table := range tablesWithAccountID {
		db.Exec("DELETE FROM " + table + " WHERE account_id IN (SELECT id FROM accounts WHERE user_id LIKE 'test-%' OR user_id LIKE 'empty-%')")
	}

	// Tables with user_id
	tablesWithUserID := []string{
		"sync_credentials",
		"projection_scenarios",
		"recurring_expenses",
		"accounts",
	}

	for _, table := range tablesWithUserID {
		db.Exec("DELETE FROM " + table + " WHERE user_id LIKE 'test-%' OR user_id LIKE 'empty-%'")
	}
}

// CreateTestAccount creates a test account in the database
func CreateTestAccount(t *testing.T, db *sql.DB, userID string) string {
	t.Helper()

	// Use nanoseconds + random suffix for uniqueness
	accountID := fmt.Sprintf("acc-%d-%s", time.Now().UnixNano(), userID)
	query := `
		INSERT INTO accounts (id, user_id, name, type, currency, is_asset, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`

	now := time.Now()
	_, err := db.Exec(query,
		accountID,
		userID,
		"Test Account",
		"checking",
		"USD",
		true,
		true,
		now,
		now,
	)
	if err != nil {
		t.Fatalf("Failed to create test account: %v", err)
	}

	return accountID
}

// CreateTestBalance creates a test balance in the database
func CreateTestBalance(t *testing.T, db *sql.DB, accountID string) string {
	t.Helper()

	balanceID := fmt.Sprintf("bal-%d", time.Now().UnixNano())
	query := `
		INSERT INTO balances (id, account_id, amount, date, created_at)
		VALUES ($1, $2, $3, $4, $5)
	`

	now := time.Now()
	_, err := db.Exec(query,
		balanceID,
		accountID,
		1000.50,
		now,
		now,
	)
	if err != nil {
		t.Fatalf("Failed to create test balance: %v", err)
	}

	return balanceID
}

// CreateTestManifest creates a test export manifest
func CreateTestManifest(userID string, tables map[string][]byte) ExportManifest {
	tableMetadata := make(map[string]TableMetadata)

	for tableName, data := range tables {
		var records []any
		json.Unmarshal(data, &records)

		hash := sha256.Sum256(data)
		checksum := hex.EncodeToString(hash[:])

		tableMetadata[tableName] = TableMetadata{
			Count:    len(records),
			Checksum: checksum,
		}
	}

	return ExportManifest{
		Version:    ExportVersion,
		AppVersion: AppVersion,
		ExportedAt: time.Now(),
		UserID:     userID,
		Tables:     tableMetadata,
	}
}

// CreateTestZip creates a test ZIP archive
func CreateTestZip(t *testing.T, manifestData []byte, tables map[string][]byte) []byte {
	t.Helper()

	buf := new(bytes.Buffer)
	zipWriter := zip.NewWriter(buf)

	// Add manifest
	manifestFile, err := zipWriter.Create("manifest.json")
	if err != nil {
		t.Fatalf("Failed to create manifest file: %v", err)
	}
	if _, err := manifestFile.Write(manifestData); err != nil {
		t.Fatalf("Failed to write manifest: %v", err)
	}

	// Add table files
	for tableName, data := range tables {
		file, err := zipWriter.Create(tableName + ".json")
		if err != nil {
			t.Fatalf("Failed to create file %s: %v", tableName, err)
		}
		if _, err := file.Write(data); err != nil {
			t.Fatalf("Failed to write file %s: %v", tableName, err)
		}
	}

	if err := zipWriter.Close(); err != nil {
		t.Fatalf("Failed to close zip writer: %v", err)
	}

	return buf.Bytes()
}

// CreateValidTestArchive creates a valid test archive with minimal data
func CreateValidTestArchive(t *testing.T, userID string) []byte {
	t.Helper()

	// Create test account
	accounts := []Account{
		{
			ID:        "test-acc-1",
			UserID:    userID,
			Name:      "Test Account",
			Type:      "checking",
			Currency:  "USD",
			IsAsset:   true,
			IsActive:  true,
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		},
	}

	balances := []Balance{
		{
			ID:        "test-bal-1",
			AccountID: "test-acc-1",
			Amount:    1000.00,
			Date:      time.Now(),
			CreatedAt: time.Now(),
		},
	}

	// Create tables map
	tables := make(map[string][]byte)
	tables["accounts"], _ = json.Marshal(accounts)
	tables["balances"], _ = json.Marshal(balances)

	// Add empty arrays for required tables
	requiredTables := []string{
		"holdings", "holding_transactions",
		"mortgage_details", "mortgage_payments",
		"loan_details", "loan_payments",
		"asset_details", "asset_depreciation_entries",
		"recurring_expenses", "projection_scenarios",
		"sync_credentials", "synced_accounts",
	}

	for _, table := range requiredTables {
		tables[table] = []byte("[]")
	}

	// Create manifest
	manifest := CreateTestManifest(userID, tables)
	manifestData, _ := json.MarshalIndent(manifest, "", "  ")

	// Create ZIP archive
	return CreateTestZip(t, manifestData, tables)
}
