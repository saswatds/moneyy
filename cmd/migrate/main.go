package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"money/internal/database"
	"money/internal/env"
	"money/internal/logger"

	"github.com/fsnotify/fsnotify"
)

func main() {
	// Load environment variables
	env.MustLoad()

	// Define flags
	direction := flag.String("direction", "up", "Migration direction: up or down")
	steps := flag.Int("steps", 0, "Number of steps to migrate (0 = all)")
	watch := flag.Bool("watch", false, "Watch migrations directory and auto-migrate on changes")
	flag.Parse()

	// Initialize logger
	logger.Init()

	// Connect to database
	dbManager, err := database.NewManager()
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer dbManager.Close()

	// Watch mode for continuous migration monitoring
	if *watch {
		runWatchMode(dbManager)
		return
	}

	// One-time migration execution
	if *direction == "up" {
		log.Println("Running migrations UP")
		if err := dbManager.Migrate(); err != nil {
			log.Fatalf("Failed to migrate database: %v", err)
		}
		log.Println("Successfully migrated database")
	} else if *direction == "down" {
		log.Printf("Running migrations DOWN (steps: %d)", *steps)
		if err := dbManager.MigrateDown(*steps); err != nil {
			log.Fatalf("Failed to rollback database: %v", err)
		}
		log.Printf("Successfully rolled back database")
	} else {
		fmt.Fprintf(os.Stderr, "Invalid direction: %s (must be 'up' or 'down')\n", *direction)
		flag.Usage()
		os.Exit(1)
	}
}

func runWatchMode(dbManager *database.Manager) {
	logger.Info("Starting migration watcher")

	// Run initial migrations
	logger.Info("Running initial migrations")
	if err := dbManager.Migrate(); err != nil {
		logger.Error("Failed to run initial migrations", "error", err)
		// Don't exit - keep watching for fixes
	} else {
		logger.Info("Initial migrations completed successfully")
	}

	// Create file watcher
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		log.Fatalf("Failed to create file watcher: %v", err)
	}
	defer watcher.Close()

	// Watch migrations directory
	migrationsPath := "migrations"

	// Create directory if it doesn't exist
	if err := os.MkdirAll(migrationsPath, 0755); err != nil {
		logger.Warn("Failed to create migrations directory", "error", err)
	}

	if err := watcher.Add(migrationsPath); err != nil {
		logger.Error("Failed to watch migrations directory", "error", err)
	} else {
		logger.Info("Watching migrations directory", "path", migrationsPath)
	}

	// Debounce timer to avoid running migrations multiple times for rapid changes
	var debounceTimer *time.Timer
	const debounceDelay = 2 * time.Second

	// Setup signal handling for graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	logger.Info("Migration watcher started - watching for changes in migrations directory")

	// Watch loop
	for {
		select {
		case event, ok := <-watcher.Events:
			if !ok {
				return
			}

			// Only watch for SQL files
			if filepath.Ext(event.Name) != ".sql" {
				continue
			}

			// Only process write and create events
			if event.Op&fsnotify.Write == fsnotify.Write || event.Op&fsnotify.Create == fsnotify.Create {
				logger.Info("Migration file changed", "file", event.Name, "op", event.Op.String())

				// Reset debounce timer
				if debounceTimer != nil {
					debounceTimer.Stop()
				}

				debounceTimer = time.AfterFunc(debounceDelay, func() {
					logger.Info("Running migrations after file changes")
					if err := dbManager.Migrate(); err != nil {
						logger.Error("Failed to run migrations", "error", err)
					} else {
						logger.Info("Migrations completed successfully")
					}
				})
			}

		case err, ok := <-watcher.Errors:
			if !ok {
				return
			}
			logger.Error("File watcher error", "error", err)

		case sig := <-sigChan:
			logger.Info("Received signal, shutting down", "signal", sig)
			return
		}
	}
}
