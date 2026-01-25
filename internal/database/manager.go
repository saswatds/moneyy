package database

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"money/internal/config"
	"money/internal/logger"

	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
)

// Manager manages multiple database connections
type Manager struct {
	dbs    map[string]*sql.DB
	config map[string]config.DatabaseConfig
}

// NewManager creates a new database manager
func NewManager(configs map[string]config.DatabaseConfig) (*Manager, error) {
	m := &Manager{
		dbs:    make(map[string]*sql.DB),
		config: configs,
	}

	for name, cfg := range configs {
		db, err := m.connect(name, cfg)
		if err != nil {
			// Close any already opened connections
			m.Close()
			return nil, fmt.Errorf("failed to connect to database %s: %w", name, err)
		}
		m.dbs[name] = db
		logger.Info("Connected to database", "name", name, "host", cfg.Host)
	}

	return m, nil
}

// connect establishes a connection to a database
func (m *Manager) connect(name string, cfg config.DatabaseConfig) (*sql.DB, error) {
	dsn := fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=disable",
		cfg.Host, cfg.Port, cfg.User, cfg.Password, cfg.Name,
	)

	db, err := sql.Open("pgx", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to open database connection: %w", err)
	}

	// Configure connection pool
	db.SetMaxOpenConns(cfg.MaxOpenConns)
	db.SetMaxIdleConns(cfg.MaxIdleConns)
	db.SetConnMaxLifetime(cfg.ConnMaxLifetime)

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	return db, nil
}

// DB returns the database connection for the given name
func (m *Manager) DB(name string) *sql.DB {
	return m.dbs[name]
}

// Close closes all database connections
func (m *Manager) Close() error {
	var lastErr error
	for name, db := range m.dbs {
		if err := db.Close(); err != nil {
			logger.Error("Failed to close database", "name", name, "error", err)
			lastErr = err
		} else {
			logger.Info("Closed database connection", "name", name)
		}
	}
	return lastErr
}

// HealthCheck checks the health of all database connections
func (m *Manager) HealthCheck(ctx context.Context) error {
	for name, db := range m.dbs {
		if err := db.PingContext(ctx); err != nil {
			return fmt.Errorf("database %s health check failed: %w", name, err)
		}
	}
	return nil
}

// Migrate runs migrations for a specific database
func (m *Manager) Migrate(dbName string) error {
	db := m.dbs[dbName]
	if db == nil {
		return fmt.Errorf("database %s not found", dbName)
	}

	cfg := m.config[dbName]
	migrationPath := fmt.Sprintf("file://migrations/%s", dbName)

	// Create postgres driver instance
	driver, err := postgres.WithInstance(db, &postgres.Config{})
	if err != nil {
		return fmt.Errorf("failed to create migration driver: %w", err)
	}

	// Create migrate instance
	migrator, err := migrate.NewWithDatabaseInstance(
		migrationPath,
		cfg.Name,
		driver,
	)
	if err != nil {
		return fmt.Errorf("failed to create migrator: %w", err)
	}
	defer migrator.Close()

	// Run migrations
	if err := migrator.Up(); err != nil && err != migrate.ErrNoChange {
		return fmt.Errorf("failed to run migrations: %w", err)
	}

	logger.Info("Migrations completed", "database", dbName)
	return nil
}

// MigrateAll runs migrations for all databases
func (m *Manager) MigrateAll() error {
	for name := range m.dbs {
		if err := m.Migrate(name); err != nil {
			return fmt.Errorf("failed to migrate database %s: %w", name, err)
		}
	}
	return nil
}

// MigrateDown rolls back migrations for a specific database
func (m *Manager) MigrateDown(dbName string, steps int) error {
	db := m.dbs[dbName]
	if db == nil {
		return fmt.Errorf("database %s not found", dbName)
	}

	cfg := m.config[dbName]
	migrationPath := fmt.Sprintf("file://migrations/%s", dbName)

	driver, err := postgres.WithInstance(db, &postgres.Config{})
	if err != nil {
		return fmt.Errorf("failed to create migration driver: %w", err)
	}

	migrator, err := migrate.NewWithDatabaseInstance(
		migrationPath,
		cfg.Name,
		driver,
	)
	if err != nil {
		return fmt.Errorf("failed to create migrator: %w", err)
	}
	defer migrator.Close()

	if steps > 0 {
		if err := migrator.Steps(-steps); err != nil && err != migrate.ErrNoChange {
			return fmt.Errorf("failed to rollback migrations: %w", err)
		}
	} else {
		if err := migrator.Down(); err != nil && err != migrate.ErrNoChange {
			return fmt.Errorf("failed to rollback all migrations: %w", err)
		}
	}

	logger.Info("Migrations rolled back", "database", dbName, "steps", steps)
	return nil
}
