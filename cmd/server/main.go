package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"money/internal/account"
	"money/internal/balance"
	"money/internal/config"
	"money/internal/currency"
	"money/internal/database"
	"money/internal/holdings"
	"money/internal/logger"
	"money/internal/projections"
	"money/internal/server/handlers"
	"money/internal/sync"
	"money/internal/transaction"
)

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// Initialize logger
	logger.Init(cfg.Logging)
	logger.Info("Starting Money API server")

	// Connect to all databases
	dbManager, err := database.NewManager(cfg.Databases)
	if err != nil {
		log.Fatalf("Failed to connect to databases: %v", err)
	}
	defer dbManager.Close()

	// Run migrations for all databases
	logger.Info("Running database migrations")
	if err := dbManager.MigrateAll(); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}
	logger.Info("Database migrations completed")

	// Initialize services with dependency injection
	logger.Info("Initializing services")

	// Balance service (no dependencies)
	balanceSvc := balance.NewService(dbManager.DB("balance"))

	// Currency service (no dependencies)
	currencySvc := currency.NewService(dbManager.DB("currency"))

	// Holdings service (no dependencies)
	holdingsSvc := holdings.NewService(dbManager.DB("holdings"))

	// Transaction service (no dependencies)
	transactionSvc := transaction.NewService(dbManager.DB("transaction"))

	// Account service (depends on balance service)
	accountSvc := account.NewService(
		dbManager.DB("account"),
		dbManager.DB("balance"),
		balanceSvc,
	)

	// Projections service (depends on account and transaction)
	projectionsSvc := projections.NewService(
		dbManager.DB("account"),
		dbManager.DB("transaction"),
		accountSvc,
		transactionSvc,
	)

	// Sync service (depends on account, balance, and holdings)
	syncSvc := sync.NewService(
		dbManager.DB("sync"),
		accountSvc,
		balanceSvc,
		holdingsSvc,
		cfg.Secrets.EncryptionMasterKey,
	)

	logger.Info("All services initialized successfully")

	// Setup HTTP router
	r := chi.NewRouter()

	// Middleware
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(60 * time.Second))

	// CORS configuration
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   cfg.CORS.AllowedOrigins,
		AllowedMethods:   cfg.CORS.AllowedMethods,
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Health check endpoint
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	})

	// Register service handlers
	logger.Info("Registering HTTP handlers")
	handlers.NewAccountHandler(accountSvc).RegisterRoutes(r)
	handlers.NewBalanceHandler(balanceSvc).RegisterRoutes(r)
	handlers.NewCurrencyHandler(currencySvc).RegisterRoutes(r)
	handlers.NewHoldingsHandler(holdingsSvc).RegisterRoutes(r)
	handlers.NewProjectionsHandler(projectionsSvc).RegisterRoutes(r)
	handlers.NewSyncHandler(syncSvc).RegisterRoutes(r)
	handlers.NewTransactionHandler(transactionSvc).RegisterRoutes(r)

	// Create HTTP server
	addr := fmt.Sprintf(":%d", cfg.Server.Port)
	srv := &http.Server{
		Addr:         addr,
		Handler:      r,
		ReadTimeout:  cfg.Server.ReadTimeout,
		WriteTimeout: cfg.Server.WriteTimeout,
		IdleTimeout:  cfg.Server.IdleTimeout,
	}

	// Start server in a goroutine
	go func() {
		logger.Info("Server starting", "address", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	// Wait for interrupt signal for graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("Server shutting down...")

	// Graceful shutdown with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	logger.Info("Server stopped")
}
