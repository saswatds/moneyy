package database

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"money/internal/env"
	"money/internal/logger"

	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
)

// Manager manages the database connection
type Manager struct {
	db *sql.DB
}

// NewManager creates a new database manager from environment variables
func NewManager() (*Manager, error) {
	// Build connection string from environment
	host := env.Get("DB_HOST", "localhost")
	port := env.GetInt("DB_PORT", 5432)
	name := env.Get("DB_NAME", "money")
	user := env.Get("DB_USER", "postgres")
	password := env.MustGet("DB_PASSWORD")

	dsn := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=disable",
		host, port, user, password, name)

	db, err := sql.Open("pgx", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to open database connection: %w", err)
	}

	// Configure connection pool
	maxOpenConns := env.GetInt("DB_MAX_OPEN_CONNS", 25)
	maxIdleConns := env.GetInt("DB_MAX_IDLE_CONNS", 5)
	connMaxLifetime := time.Duration(env.GetInt("DB_CONN_MAX_LIFETIME_MINUTES", 5)) * time.Minute

	db.SetMaxOpenConns(maxOpenConns)
	db.SetMaxIdleConns(maxIdleConns)
	db.SetConnMaxLifetime(connMaxLifetime)

	// Verify connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	m := &Manager{db: db}
	logger.Info("Connected to database", "name", name, "host", host)

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

	// Create postgres driver instance
	driver, err := postgres.WithInstance(m.db, &postgres.Config{})
	if err != nil {
		return fmt.Errorf("failed to create migration driver: %w", err)
	}

	dbName := env.Get("DB_NAME", "money")

	// Create migrate instance
	migrator, err := migrate.NewWithDatabaseInstance(
		migrationPath,
		dbName,
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

	driver, err := postgres.WithInstance(m.db, &postgres.Config{})
	if err != nil {
		return fmt.Errorf("failed to create migration driver: %w", err)
	}

	dbName := env.Get("DB_NAME", "money")

	migrator, err := migrate.NewWithDatabaseInstance(
		migrationPath,
		dbName,
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
