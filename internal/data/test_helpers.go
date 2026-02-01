package data

import (
	"archive/zip"
	"bytes"
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
	"github.com/golang-migrate/migrate/v4/database/sqlite3"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	_ "modernc.org/sqlite"
)

// TestDB holds the SQLite test database connection
type TestDB struct {
	DB      *sql.DB
	TempDir string
}

var (
	// Package-level database - shared across all tests in the package
	sharedDB     *TestDB
	dbMu         sync.Mutex
	dbOnce       sync.Once
	sharedDBErr  error
)

// GetSharedDB returns the shared test database, creating it if necessary
func GetSharedDB(t *testing.T) *TestDB {
	t.Helper()

	dbOnce.Do(func() {
		// Create a temporary directory for the test database
		tempDir, err := os.MkdirTemp("", "moneyy-data-test-*")
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

		// Run migrations
		if err := runMigrations(db); err != nil {
			db.Close()
			sharedDBErr = fmt.Errorf("failed to run migrations: %w", err)
			return
		}

		sharedDB = &TestDB{
			DB:      db,
			TempDir: tempDir,
		}
	})

	if sharedDBErr != nil {
		t.Fatalf("Failed to setup shared database: %v", sharedDBErr)
	}

	return sharedDB
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
func runMigrations(db *sql.DB) error {
	// Get migrations directory path by finding project root
	migrationsPath, err := findMigrationsPath()
	if err != nil {
		return fmt.Errorf("failed to get migrations path: %w", err)
	}

	driver, err := sqlite3.WithInstance(db, &sqlite3.Config{})
	if err != nil {
		return fmt.Errorf("failed to create migrate driver: %w", err)
	}

	// Create migrate instance
	m, err := migrate.NewWithDatabaseInstance(
		"file://"+migrationsPath,
		"sqlite3",
		driver,
	)
	if err != nil {
		return fmt.Errorf("failed to create migrate instance: %w", err)
	}

	// Run migrations
	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		return fmt.Errorf("failed to run migrations: %w", err)
	}

	return nil
}

// SetupTestDB creates a test database connection using the shared database
func SetupTestDB(t *testing.T) *sql.DB {
	t.Helper()

	tc := GetSharedDB(t)

	// Clean up test data after this test completes
	t.Cleanup(func() {
		CleanupTestDB(t, tc.DB)
	})

	return tc.DB
}

// CleanupTestDB removes test data (but doesn't close the DB)
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
		1, // SQLite uses 1/0 for boolean
		1,
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

// Legacy types for backwards compatibility
type TestContainer = TestDB

// GetSharedContainer is an alias for GetSharedDB for backwards compatibility
func GetSharedContainer(t *testing.T) *TestContainer {
	return GetSharedDB(t)
}
