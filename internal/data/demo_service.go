package data

import (
	"context"
	"database/sql"
	"embed"
	"fmt"
	"log"
)

//go:embed demo_seed.zip
var demoSeedData embed.FS

// DemoService handles demo data operations
type DemoService struct {
	db          *sql.DB
	importSvc   *ImportService
	exportSvc   *ExportService
}

// NewDemoService creates a new demo service
func NewDemoService(db *sql.DB) *DemoService {
	return &DemoService{
		db:        db,
		importSvc: NewImportService(db),
		exportSvc: NewExportService(db),
	}
}

// HasDemoData checks if demo data exists for the given user
func (s *DemoService) HasDemoData(ctx context.Context, userID string) (bool, error) {
	var count int
	query := "SELECT COUNT(*) FROM accounts WHERE user_id = $1"
	err := s.db.QueryRowContext(ctx, query, userID).Scan(&count)
	if err != nil {
		return false, fmt.Errorf("failed to check demo data: %w", err)
	}
	return count > 0, nil
}

// SeedDemoData imports demo data for the given user
func (s *DemoService) SeedDemoData(ctx context.Context, userID string) error {
	// Check if demo data already exists
	hasData, err := s.HasDemoData(ctx, userID)
	if err != nil {
		return err
	}

	if hasData {
		log.Printf("Demo data already exists for user %s, skipping seed", userID)
		return nil
	}

	// Read embedded demo seed archive
	archiveData, err := demoSeedData.ReadFile("demo_seed.zip")
	if err != nil {
		return fmt.Errorf("failed to read demo seed data: %w", err)
	}

	// Import demo data using ImportService
	opts := ImportOptions{
		Mode:         "merge", // Use merge mode to avoid conflicts
		ValidateOnly: false,
	}

	result, err := s.importSvc.ImportData(ctx, userID, archiveData, opts)
	if err != nil {
		return fmt.Errorf("failed to import demo data: %w", err)
	}

	if !result.Success {
		return fmt.Errorf("demo data import failed: %v", result.Errors)
	}

	log.Printf("Demo data seeded successfully for user %s", userID)
	return nil
}

// ResetDemoData deletes all data for the given user and re-imports demo data
func (s *DemoService) ResetDemoData(ctx context.Context, userID string) error {
	// Start transaction
	tx, err := s.db.BeginTx(ctx, &sql.TxOptions{
		Isolation: sql.LevelSerializable,
	})
	if err != nil {
		return fmt.Errorf("failed to start transaction: %w", err)
	}

	defer func() {
		if err != nil {
			tx.Rollback()
		}
	}()

	// Delete all data for the user in correct order (respecting foreign keys)
	tables := []string{
		"asset_depreciation_entries",
		"asset_details",
		"loan_payments",
		"loan_details",
		"mortgage_payments",
		"mortgage_details",
		"holding_transactions",
		"holdings",
		"synced_accounts",
		"sync_credentials",
		"balances",
		"accounts",
		"projection_scenarios",
		"recurring_expenses",
	}

	for _, table := range tables {
		query := fmt.Sprintf("DELETE FROM %s WHERE user_id = $1", table)
		if table == "asset_depreciation_entries" || table == "loan_payments" || table == "mortgage_payments" || table == "balances" || table == "holding_transactions" || table == "synced_accounts" {
			// These tables don't have user_id, need to join with parent tables
			switch table {
			case "asset_depreciation_entries":
				query = "DELETE FROM asset_depreciation_entries WHERE account_id IN (SELECT id FROM accounts WHERE user_id = $1)"
			case "loan_payments":
				query = "DELETE FROM loan_payments WHERE account_id IN (SELECT id FROM accounts WHERE user_id = $1)"
			case "mortgage_payments":
				query = "DELETE FROM mortgage_payments WHERE account_id IN (SELECT id FROM accounts WHERE user_id = $1)"
			case "balances":
				query = "DELETE FROM balances WHERE account_id IN (SELECT id FROM accounts WHERE user_id = $1)"
			case "holding_transactions":
				query = "DELETE FROM holding_transactions WHERE holding_id IN (SELECT id FROM holdings WHERE account_id IN (SELECT id FROM accounts WHERE user_id = $1))"
			case "synced_accounts":
				query = "DELETE FROM synced_accounts WHERE credential_id IN (SELECT id FROM sync_credentials WHERE user_id = $1)"
			}
		}

		_, err := tx.ExecContext(ctx, query, userID)
		if err != nil {
			return fmt.Errorf("failed to delete from %s: %w", table, err)
		}
	}

	// Commit transaction
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	log.Printf("Deleted all data for user %s", userID)

	// Re-seed demo data
	return s.SeedDemoData(ctx, userID)
}
