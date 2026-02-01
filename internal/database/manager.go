package database

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"money/internal/env"
	"money/internal/logger"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/sqlite3"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	_ "modernc.org/sqlite"
)

// Manager manages the database connection
type Manager struct {
	db *sql.DB
}

// NewManager creates a new database manager from environment variables
func NewManager() (*Manager, error) {
	// Get database path from environment
	dbPath := env.Get("DB_PATH", "data/moneyy.db")

	// Ensure the directory exists
	dir := filepath.Dir(dbPath)
	if dir != "" && dir != "." {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return nil, fmt.Errorf("failed to create database directory: %w", err)
		}
	}

	// Build SQLite connection string with pragmas for better performance
	dsn := fmt.Sprintf("%s?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)&_pragma=foreign_keys(ON)", dbPath)

	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to open database connection: %w", err)
	}

	// Configure connection pool (SQLite with WAL can handle concurrent readers)
	maxOpenConns := env.GetInt("DB_MAX_OPEN_CONNS", 10)
	maxIdleConns := env.GetInt("DB_MAX_IDLE_CONNS", 5)
	connMaxLifetime := time.Duration(env.GetInt("DB_CONN_MAX_LIFETIME_MINUTES", 0)) * time.Minute

	db.SetMaxOpenConns(maxOpenConns)
	db.SetMaxIdleConns(maxIdleConns)
	if connMaxLifetime > 0 {
		db.SetConnMaxLifetime(connMaxLifetime)
	}

	// Verify connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	m := &Manager{db: db}
	logger.Info("Connected to database", "path", dbPath)

	return m, nil
}

// DB returns the database connection
func (m *Manager) DB() *sql.DB {
	return m.db
}

// Close closes the database connection
func (m *Manager) Close() error {
	if err := m.db.Close(); err != nil {
		logger.Error("Failed to close database", "error", err)
		return err
	}
	logger.Info("Closed database connection")
	return nil
}

// HealthCheck checks the health of the database connection
func (m *Manager) HealthCheck(ctx context.Context) error {
	if err := m.db.PingContext(ctx); err != nil {
		return fmt.Errorf("database health check failed: %w", err)
	}
	return nil
}

// Migrate runs all pending migrations
func (m *Manager) Migrate() error {
	migrationPath := "file://migrations"

	// Create sqlite3 driver instance
	driver, err := sqlite3.WithInstance(m.db, &sqlite3.Config{})
	if err != nil {
		return fmt.Errorf("failed to create migration driver: %w", err)
	}

	// Create migrate instance
	migrator, err := migrate.NewWithDatabaseInstance(
		migrationPath,
		"sqlite3",
		driver,
	)
	if err != nil {
		return fmt.Errorf("failed to create migrator: %w", err)
	}
	// Note: Don't close migrator as it will close the underlying database connection

	// Run migrations
	if err := migrator.Up(); err != nil && err != migrate.ErrNoChange {
		return fmt.Errorf("failed to run migrations: %w", err)
	}

	logger.Info("Migrations completed")
	return nil
}

// MigrateDown rolls back N migrations
func (m *Manager) MigrateDown(steps int) error {
	migrationPath := "file://migrations"

	driver, err := sqlite3.WithInstance(m.db, &sqlite3.Config{})
	if err != nil {
		return fmt.Errorf("failed to create migration driver: %w", err)
	}

	migrator, err := migrate.NewWithDatabaseInstance(
		migrationPath,
		"sqlite3",
		driver,
	)
	if err != nil {
		return fmt.Errorf("failed to create migrator: %w", err)
	}

	if steps == 0 {
		// Rollback all migrations
		if err := migrator.Down(); err != nil && err != migrate.ErrNoChange {
			return fmt.Errorf("failed to rollback migrations: %w", err)
		}
	} else {
		// Rollback N steps
		if err := migrator.Steps(-steps); err != nil && err != migrate.ErrNoChange {
			return fmt.Errorf("failed to rollback %d steps: %w", steps, err)
		}
	}

	logger.Info("Rollback completed", "steps", steps)
	return nil
}
