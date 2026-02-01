package income

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

func getSharedDB(t *testing.T) *sql.DB {
	t.Helper()

	sharedDBOnce.Do(func() {
		tempDir, err := os.MkdirTemp("", "moneyy-income-test-*")
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
	_, _ = db.Exec("DELETE FROM income_records WHERE id LIKE 'test-%' OR user_id LIKE 'test-%'")
	_, _ = db.Exec("DELETE FROM tax_configurations WHERE id LIKE 'test-%' OR user_id LIKE 'test-%'")
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

func createAuthContext(userID string) context.Context {
	return context.WithValue(context.Background(), auth.UserIDKey, userID)
}

func TestCreateIncomeRecord_Success(t *testing.T) {
	db := setupTestDB(t)
	defer cleanupTestDB(t, db)

	// Arrange
	userID := "test-user-income-1"
	createTestUser(t, db, userID)
	ctx := createAuthContext(userID)
	service := NewService(db)

	isTaxable := true
	dateReceived := time.Now().Format("2006-01-02")
	description := "Monthly salary"
	req := &CreateIncomeRecordRequest{
		Source:       "Employer Inc",
		Category:     CategoryEmployment,
		Amount:       5000.00,
		Currency:     CurrencyCAD,
		Frequency:    FrequencyMonthly,
		TaxYear:      2024,
		DateReceived: &dateReceived,
		Description:  &description,
		IsTaxable:    &isTaxable,
	}

	// Act
	record, err := service.CreateIncomeRecord(ctx, req)

	// Assert
	if err != nil {
		t.Fatalf("CreateIncomeRecord failed: %v", err)
	}
	if record == nil {
		t.Fatal("Expected record, got nil")
	}
	if record.Source != "Employer Inc" {
		t.Errorf("Expected source 'Employer Inc', got '%s'", record.Source)
	}
	if record.Amount != 5000.00 {
		t.Errorf("Expected amount 5000, got %f", record.Amount)
	}
	if record.ID == "" {
		t.Error("Expected non-empty record ID")
	}
}

func TestCreateIncomeRecord_Unauthenticated(t *testing.T) {
	db := setupTestDB(t)
	defer cleanupTestDB(t, db)

	// Arrange
	service := NewService(db)
	req := &CreateIncomeRecordRequest{
		Source:    "Employer Inc",
		Category:  CategoryEmployment,
		Amount:    5000.00,
		Currency:  CurrencyCAD,
		Frequency: FrequencyMonthly,
		TaxYear:   2024,
	}

	// Act - no user in context
	record, err := service.CreateIncomeRecord(context.Background(), req)

	// Assert
	if err == nil {
		t.Fatal("Expected error for unauthenticated user, got nil")
	}
	if record != nil {
		t.Error("Expected nil record for unauthenticated user")
	}
}

func TestCreateIncomeRecord_InvalidCategory(t *testing.T) {
	db := setupTestDB(t)
	defer cleanupTestDB(t, db)

	// Arrange
	userID := "test-user-income-invalid-cat-1"
	createTestUser(t, db, userID)
	ctx := createAuthContext(userID)
	service := NewService(db)

	req := &CreateIncomeRecordRequest{
		Source:    "Test",
		Category:  "invalid_category",
		Amount:    1000.00,
		Currency:  CurrencyCAD,
		Frequency: FrequencyMonthly,
		TaxYear:   2024,
	}

	// Act
	record, err := service.CreateIncomeRecord(ctx, req)

	// Assert
	if err == nil {
		t.Fatal("Expected error for invalid category, got nil")
	}
	if record != nil {
		t.Error("Expected nil record for invalid category")
	}
}

func TestGetIncomeRecord_Success(t *testing.T) {
	db := setupTestDB(t)
	defer cleanupTestDB(t, db)

	// Arrange
	userID := "test-user-income-get-1"
	createTestUser(t, db, userID)
	ctx := createAuthContext(userID)
	service := NewService(db)

	created, _ := service.CreateIncomeRecord(ctx, &CreateIncomeRecordRequest{
		Source:    "Freelance",
		Category:  CategoryBusiness,
		Amount:    2000.00,
		Currency:  CurrencyUSD,
		Frequency: FrequencyOneTime,
		TaxYear:   2024,
	})

	// Act
	record, err := service.GetIncomeRecord(ctx, created.ID)

	// Assert
	if err != nil {
		t.Fatalf("GetIncomeRecord failed: %v", err)
	}
	if record == nil {
		t.Fatal("Expected record, got nil")
	}
	if record.ID != created.ID {
		t.Errorf("Expected ID %s, got %s", created.ID, record.ID)
	}
}

func TestListIncomeRecords_Success(t *testing.T) {
	db := setupTestDB(t)
	defer cleanupTestDB(t, db)

	// Arrange
	userID := "test-user-income-list-1"
	createTestUser(t, db, userID)
	ctx := createAuthContext(userID)
	service := NewService(db)

	// Create multiple income records
	sources := []string{"Employer A", "Investment B", "Rental C"}
	categories := []IncomeCategory{CategoryEmployment, CategoryInvestment, CategoryRental}
	for i, src := range sources {
		service.CreateIncomeRecord(ctx, &CreateIncomeRecordRequest{
			Source:    src,
			Category:  categories[i],
			Amount:    float64((i + 1) * 1000),
			Currency:  CurrencyCAD,
			Frequency: FrequencyMonthly,
			TaxYear:   2024,
		})
	}

	// Act
	resp, err := service.ListIncomeRecords(ctx, nil)

	// Assert
	if err != nil {
		t.Fatalf("ListIncomeRecords failed: %v", err)
	}
	if resp == nil {
		t.Fatal("Expected response, got nil")
	}
	if len(resp.Records) != 3 {
		t.Errorf("Expected 3 records, got %d", len(resp.Records))
	}
}

func TestListIncomeRecords_FilterByYear(t *testing.T) {
	db := setupTestDB(t)
	defer cleanupTestDB(t, db)

	// Arrange
	userID := "test-user-income-filter-year-1"
	createTestUser(t, db, userID)
	ctx := createAuthContext(userID)
	service := NewService(db)

	// Create records for different years
	service.CreateIncomeRecord(ctx, &CreateIncomeRecordRequest{
		Source:    "Employer 2024",
		Category:  CategoryEmployment,
		Amount:    5000.00,
		Currency:  CurrencyCAD,
		Frequency: FrequencyMonthly,
		TaxYear:   2024,
	})
	service.CreateIncomeRecord(ctx, &CreateIncomeRecordRequest{
		Source:    "Employer 2023",
		Category:  CategoryEmployment,
		Amount:    4500.00,
		Currency:  CurrencyCAD,
		Frequency: FrequencyMonthly,
		TaxYear:   2023,
	})

	// Act
	year := 2024
	resp, err := service.ListIncomeRecords(ctx, &ListIncomeRecordsRequest{Year: &year})

	// Assert
	if err != nil {
		t.Fatalf("ListIncomeRecords with filter failed: %v", err)
	}
	if resp == nil {
		t.Fatal("Expected response, got nil")
	}
	if len(resp.Records) != 1 {
		t.Errorf("Expected 1 record for 2024, got %d", len(resp.Records))
	}
	if len(resp.Records) > 0 && resp.Records[0].TaxYear != 2024 {
		t.Errorf("Expected year 2024, got %d", resp.Records[0].TaxYear)
	}
}

func TestUpdateIncomeRecord_Success(t *testing.T) {
	db := setupTestDB(t)
	defer cleanupTestDB(t, db)

	// Arrange
	userID := "test-user-income-update-1"
	createTestUser(t, db, userID)
	ctx := createAuthContext(userID)
	service := NewService(db)

	created, _ := service.CreateIncomeRecord(ctx, &CreateIncomeRecordRequest{
		Source:    "Old Employer",
		Category:  CategoryEmployment,
		Amount:    3000.00,
		Currency:  CurrencyCAD,
		Frequency: FrequencyMonthly,
		TaxYear:   2024,
	})

	newSource := "New Employer"
	newAmount := 4000.00
	req := &UpdateIncomeRecordRequest{
		Source: &newSource,
		Amount: &newAmount,
	}

	// Act
	record, err := service.UpdateIncomeRecord(ctx, created.ID, req)

	// Assert
	if err != nil {
		t.Fatalf("UpdateIncomeRecord failed: %v", err)
	}
	if record == nil {
		t.Fatal("Expected record, got nil")
	}
	if record.Source != "New Employer" {
		t.Errorf("Expected source 'New Employer', got '%s'", record.Source)
	}
	if record.Amount != 4000.00 {
		t.Errorf("Expected amount 4000, got %f", record.Amount)
	}
}

func TestDeleteIncomeRecord_Success(t *testing.T) {
	db := setupTestDB(t)
	defer cleanupTestDB(t, db)

	// Arrange
	userID := "test-user-income-delete-1"
	createTestUser(t, db, userID)
	ctx := createAuthContext(userID)
	service := NewService(db)

	created, _ := service.CreateIncomeRecord(ctx, &CreateIncomeRecordRequest{
		Source:    "Temp Income",
		Category:  CategoryOther,
		Amount:    500.00,
		Currency:  CurrencyCAD,
		Frequency: FrequencyOneTime,
		TaxYear:   2024,
	})

	// Act
	resp, err := service.DeleteIncomeRecord(ctx, created.ID)

	// Assert
	if err != nil {
		t.Fatalf("DeleteIncomeRecord failed: %v", err)
	}
	if resp == nil || !resp.Success {
		t.Error("Expected successful deletion")
	}

	// Verify deletion
	_, err = service.GetIncomeRecord(ctx, created.ID)
	if err == nil {
		t.Error("Expected error when getting deleted record")
	}
}

func TestGetAnnualSummary_Success(t *testing.T) {
	db := setupTestDB(t)
	defer cleanupTestDB(t, db)

	// Arrange
	userID := "test-user-income-summary-1"
	createTestUser(t, db, userID)
	ctx := createAuthContext(userID)
	service := NewService(db)

	// Create income records
	service.CreateIncomeRecord(ctx, &CreateIncomeRecordRequest{
		Source:    "Employer",
		Category:  CategoryEmployment,
		Amount:    5000.00,
		Currency:  CurrencyCAD,
		Frequency: FrequencyMonthly,
		TaxYear:   2024,
	})
	service.CreateIncomeRecord(ctx, &CreateIncomeRecordRequest{
		Source:    "Dividends",
		Category:  CategoryInvestment,
		Amount:    1000.00,
		Currency:  CurrencyCAD,
		Frequency: FrequencyAnnually,
		TaxYear:   2024,
	})

	// Act
	summary, err := service.GetAnnualSummary(ctx, 2024)

	// Assert
	if err != nil {
		t.Fatalf("GetAnnualSummary failed: %v", err)
	}
	if summary == nil {
		t.Fatal("Expected summary, got nil")
	}
	// Employment: 5000 * 12 = 60000
	if summary.EmploymentIncome != 60000.00 {
		t.Errorf("Expected employment income 60000, got %f", summary.EmploymentIncome)
	}
	// Investment: 1000 (annually)
	if summary.InvestmentIncome != 1000.00 {
		t.Errorf("Expected investment income 1000, got %f", summary.InvestmentIncome)
	}
	// Total: 61000
	if summary.TotalGrossIncome != 61000.00 {
		t.Errorf("Expected total gross income 61000, got %f", summary.TotalGrossIncome)
	}
}
