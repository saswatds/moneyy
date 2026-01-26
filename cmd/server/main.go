package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"money/internal/account"
	"money/internal/balance"
	"money/internal/currency"
	"money/internal/data"
	"money/internal/database"
	"money/internal/env"
	"money/internal/holdings"
	"money/internal/logger"
	"money/internal/projections"
	"money/internal/server/handlers"
	"money/internal/sync"
	"money/internal/transaction"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

func main() {
	// Load environment variables
	env.MustLoad()

	// Initialize logger
	logger.Init()
	logger.Info("Starting Money API server")

	// Connect to database
	dbManager, err := database.NewManager()
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer dbManager.Close()

	// Get the single database connection
	db := dbManager.DB()

	// Note: Migrations are handled by the separate migrate container
	// Initialize services with dependency injection
	logger.Info("Initializing services")

	// Balance service (no dependencies)
	balanceSvc := balance.NewService(db)

	// Currency service (no dependencies)
	currencySvc := currency.NewService(db)

	// Holdings service (no dependencies)
	holdingsSvc := holdings.NewService(db)

	// Transaction service (no dependencies)
	transactionSvc := transaction.NewService(db)

	// Account service (depends on balance service)
	accountSvc := account.NewService(
		db,
		db,  // balance DB is same now
		balanceSvc,
	)

	// Projections service (depends on account and transaction)
	projectionsSvc := projections.NewService(
		db,
		db,  // all same DB now
		accountSvc,
		transactionSvc,
	)

	// Sync service (depends on account, balance, and holdings)
	encryptionKey := env.MustGet("ENC_MASTER_KEY")
	syncSvc := sync.NewService(
		db,
		accountSvc,
		balanceSvc,
		holdingsSvc,
		encryptionKey,
	)

	// Data export/import services (no dependencies)
	exportSvc := data.NewExportService(db)
	importSvc := data.NewImportService(db)

	logger.Info("All services initialized successfully")

	// Setup HTTP router
	logger.Info("Registering HTTP handlers")
	r := chi.NewRouter()

	// Middleware
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)

	// CORS middleware
	corsOrigins := env.Get("CORS_ORIGINS", "http://localhost:5173")
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{corsOrigins},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	// API routes under /api prefix
	r.Route("/api", func(r chi.Router) {
		handlers.NewAccountHandler(accountSvc).RegisterRoutes(r)
		handlers.NewBalanceHandler(balanceSvc).RegisterRoutes(r)
		handlers.NewCurrencyHandler(currencySvc).RegisterRoutes(r)
		handlers.NewHoldingsHandler(holdingsSvc).RegisterRoutes(r)
		handlers.NewProjectionsHandler(projectionsSvc).RegisterRoutes(r)
		handlers.NewSyncHandler(syncSvc).RegisterRoutes(r)
		handlers.NewTransactionHandler(transactionSvc).RegisterRoutes(r)
		handlers.NewDataHandler(exportSvc, importSvc).RegisterRoutes(r)

		// Health check endpoint
		r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"status":"ok"}`))
		})
	})

	// Serve static files from ./static directory (production)
	staticDir := "./static"
	if _, err := os.Stat(staticDir); err == nil {
		logger.Info("Serving static files", "path", staticDir)

		// Serve static assets
		r.Handle("/assets/*", http.StripPrefix("/", http.FileServer(http.Dir(staticDir))))

		// Serve other static files (favicon, etc)
		r.Handle("/favicon.ico", http.FileServer(http.Dir(staticDir)))
		r.Handle("/vite.svg", http.FileServer(http.Dir(staticDir)))

		// SPA fallback - serve index.html for all other routes
		r.Get("/*", func(w http.ResponseWriter, r *http.Request) {
			http.ServeFile(w, r, staticDir+"/index.html")
		})
	} else {
		logger.Warn("Static directory not found, serving API only", "path", staticDir)
		// Root health check for when static files aren't available
		r.Get("/", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"status":"ok","message":"API server running"}`))
		})
	}

	// Start server
	port := env.Get("SERVER_PORT", "4000")
	addr := ":" + port

	srv := &http.Server{
		Addr:         addr,
		Handler:      r,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	logger.Info("Server starting", "address", addr)

	// Start server in a goroutine
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		logger.Error("Server forced to shutdown", "error", err)
	}

	logger.Info("Server stopped")
}
