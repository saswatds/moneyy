package transaction

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
		tempDir, err := os.MkdirTemp("", "moneyy-transaction-test-*")
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
	_, _ = db.Exec("DELETE FROM recurring_expenses WHERE id LIKE 'test-%' OR user_id LIKE 'test-%'")
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

func TestCreateRecurringExpense_Success(t *testing.T) {
	db := setupTestDB(t)
	defer cleanupTestDB(t, db)

	// Arrange
	userID := "test-user-expense-1"
	createTestUser(t, db, userID)
	ctx := createAuthContext(userID)
	service := NewService(db)

	dayOfMonth := 15
	req := &CreateRecurringExpenseRequest{
		Name:        "Netflix",
		Description: "Streaming subscription",
		Amount:      15.99,
		Currency:    "CAD",
		Category:    "entertainment",
		Frequency:   "monthly",
		DayOfMonth:  &dayOfMonth,
	}

	// Act
	expense, err := service.CreateRecurringExpense(ctx, req)

	// Assert
	if err != nil {
		t.Fatalf("CreateRecurringExpense failed: %v", err)
	}
	if expense == nil {
		t.Fatal("Expected expense, got nil")
	}
	if expense.Name != "Netflix" {
		t.Errorf("Expected name 'Netflix', got '%s'", expense.Name)
	}
	if expense.Amount != 15.99 {
		t.Errorf("Expected amount 15.99, got %f", expense.Amount)
	}
	if expense.ID == "" {
		t.Error("Expected non-empty expense ID")
	}
	if !expense.IsActive {
		t.Error("Expected expense to be active by default")
	}
}

func TestCreateRecurringExpense_Unauthenticated(t *testing.T) {
	db := setupTestDB(t)
	defer cleanupTestDB(t, db)

	// Arrange
	service := NewService(db)
	req := &CreateRecurringExpenseRequest{
		Name:      "Test",
		Amount:    10.00,
		Currency:  "CAD",
		Category:  "other",
		Frequency: "monthly",
	}

	// Act - no user in context
	expense, err := service.CreateRecurringExpense(context.Background(), req)

	// Assert
	if err == nil {
		t.Fatal("Expected error for unauthenticated user, got nil")
	}
	if expense != nil {
		t.Error("Expected nil expense for unauthenticated user")
	}
}

func TestListRecurringExpenses_Success(t *testing.T) {
	db := setupTestDB(t)
	defer cleanupTestDB(t, db)

	// Arrange
	userID := "test-user-expense-list-1"
	createTestUser(t, db, userID)
	ctx := createAuthContext(userID)
	service := NewService(db)

	// Create multiple expenses
	expenses := []struct {
		name     string
		amount   float64
		category string
	}{
		{"Netflix", 15.99, "entertainment"},
		{"Gym", 50.00, "health"},
		{"Insurance", 100.00, "insurance"},
	}

	for _, exp := range expenses {
		service.CreateRecurringExpense(ctx, &CreateRecurringExpenseRequest{
			Name:      exp.name,
			Amount:    exp.amount,
			Currency:  "CAD",
			Category:  exp.category,
			Frequency: "monthly",
		})
	}

	// Act
	resp, err := service.ListRecurringExpenses(ctx)

	// Assert
	if err != nil {
		t.Fatalf("ListRecurringExpenses failed: %v", err)
	}
	if resp == nil {
		t.Fatal("Expected response, got nil")
	}
	if len(resp.Expenses) != 3 {
		t.Errorf("Expected 3 expenses, got %d", len(resp.Expenses))
	}
}

func TestGetRecurringExpense_Success(t *testing.T) {
	db := setupTestDB(t)
	defer cleanupTestDB(t, db)

	// Arrange
	userID := "test-user-expense-get-1"
	createTestUser(t, db, userID)
	ctx := createAuthContext(userID)
	service := NewService(db)

	created, _ := service.CreateRecurringExpense(ctx, &CreateRecurringExpenseRequest{
		Name:      "Spotify",
		Amount:    9.99,
		Currency:  "CAD",
		Category:  "entertainment",
		Frequency: "monthly",
	})

	// Act
	expense, err := service.GetRecurringExpense(ctx, created.ID)

	// Assert
	if err != nil {
		t.Fatalf("GetRecurringExpense failed: %v", err)
	}
	if expense == nil {
		t.Fatal("Expected expense, got nil")
	}
	if expense.ID != created.ID {
		t.Errorf("Expected ID %s, got %s", created.ID, expense.ID)
	}
	if expense.Name != "Spotify" {
		t.Errorf("Expected name 'Spotify', got '%s'", expense.Name)
	}
}

func TestGetRecurringExpense_NotFound(t *testing.T) {
	db := setupTestDB(t)
	defer cleanupTestDB(t, db)

	// Arrange
	userID := "test-user-expense-not-found-1"
	createTestUser(t, db, userID)
	ctx := createAuthContext(userID)
	service := NewService(db)

	// Act
	expense, err := service.GetRecurringExpense(ctx, "nonexistent-id")

	// Assert
	if err == nil {
		t.Fatal("Expected error for nonexistent expense, got nil")
	}
	if expense != nil {
		t.Error("Expected nil expense")
	}
}

func TestUpdateRecurringExpense_Success(t *testing.T) {
	db := setupTestDB(t)
	defer cleanupTestDB(t, db)

	// Arrange
	userID := "test-user-expense-update-1"
	createTestUser(t, db, userID)
	ctx := createAuthContext(userID)
	service := NewService(db)

	created, _ := service.CreateRecurringExpense(ctx, &CreateRecurringExpenseRequest{
		Name:      "Old Subscription",
		Amount:    20.00,
		Currency:  "CAD",
		Category:  "other",
		Frequency: "monthly",
	})

	newName := "New Subscription"
	newAmount := 25.00
	isActive := false
	req := &UpdateRecurringExpenseRequest{
		Name:     &newName,
		Amount:   &newAmount,
		IsActive: &isActive,
	}

	// Act
	expense, err := service.UpdateRecurringExpense(ctx, created.ID, req)

	// Assert
	if err != nil {
		t.Fatalf("UpdateRecurringExpense failed: %v", err)
	}
	if expense == nil {
		t.Fatal("Expected expense, got nil")
	}
	if expense.Name != "New Subscription" {
		t.Errorf("Expected name 'New Subscription', got '%s'", expense.Name)
	}
	if expense.Amount != 25.00 {
		t.Errorf("Expected amount 25.00, got %f", expense.Amount)
	}
	if expense.IsActive {
		t.Error("Expected expense to be inactive")
	}
}

func TestDeleteRecurringExpense_Success(t *testing.T) {
	db := setupTestDB(t)
	defer cleanupTestDB(t, db)

	// Arrange
	userID := "test-user-expense-delete-1"
	createTestUser(t, db, userID)
	ctx := createAuthContext(userID)
	service := NewService(db)

	created, _ := service.CreateRecurringExpense(ctx, &CreateRecurringExpenseRequest{
		Name:      "Temp Expense",
		Amount:    5.00,
		Currency:  "CAD",
		Category:  "other",
		Frequency: "monthly",
	})

	// Act
	err := service.DeleteRecurringExpense(ctx, created.ID)

	// Assert
	if err != nil {
		t.Fatalf("DeleteRecurringExpense failed: %v", err)
	}

	// Verify deletion
	_, err = service.GetRecurringExpense(ctx, created.ID)
	if err == nil {
		t.Error("Expected error when getting deleted expense")
	}
}

func TestDeleteRecurringExpense_NotFound(t *testing.T) {
	db := setupTestDB(t)
	defer cleanupTestDB(t, db)

	// Arrange
	userID := "test-user-expense-delete-not-found-1"
	createTestUser(t, db, userID)
	ctx := createAuthContext(userID)
	service := NewService(db)

	// Act
	err := service.DeleteRecurringExpense(ctx, "nonexistent-id")

	// Assert
	if err == nil {
		t.Fatal("Expected error for nonexistent expense, got nil")
	}
	if err != ErrNotFound {
		t.Errorf("Expected ErrNotFound, got %v", err)
	}
}

func TestListRecurringExpenses_OtherUserCannotSee(t *testing.T) {
	db := setupTestDB(t)
	defer cleanupTestDB(t, db)

	// Arrange
	user1 := "test-user-expense-isolation-1"
	user2 := "test-user-expense-isolation-2"
	createTestUser(t, db, user1)
	createTestUser(t, db, user2)
	service := NewService(db)

	// User1 creates an expense
	ctx1 := createAuthContext(user1)
	service.CreateRecurringExpense(ctx1, &CreateRecurringExpenseRequest{
		Name:      "User1 Expense",
		Amount:    100.00,
		Currency:  "CAD",
		Category:  "other",
		Frequency: "monthly",
	})

	// Act - User2 lists expenses
	ctx2 := createAuthContext(user2)
	resp, err := service.ListRecurringExpenses(ctx2)

	// Assert
	if err != nil {
		t.Fatalf("ListRecurringExpenses failed: %v", err)
	}
	// User2 should not see User1's expenses
	if len(resp.Expenses) != 0 {
		t.Errorf("Expected 0 expenses for user2, got %d", len(resp.Expenses))
	}
}
