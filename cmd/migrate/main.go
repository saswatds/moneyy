package main

import (
	"flag"
	"fmt"
	"log"
	"os"

	"money/internal/config"
	"money/internal/database"
)

func main() {
	// Define flags
	direction := flag.String("direction", "up", "Migration direction: up or down")
	steps := flag.Int("steps", 0, "Number of steps to migrate (0 = all)")
	dbName := flag.String("db", "", "Database name (leave empty for all databases)")
	flag.Parse()

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// Connect to databases
	dbManager, err := database.NewManager(cfg.Databases)
	if err != nil {
		log.Fatalf("Failed to connect to databases: %v", err)
	}
	defer dbManager.Close()

	// Run migrations based on direction
	if *direction == "up" {
		if *dbName != "" {
			// Migrate specific database
			log.Printf("Running migrations UP for database: %s", *dbName)
			if err := dbManager.Migrate(*dbName); err != nil {
				log.Fatalf("Failed to migrate database %s: %v", *dbName, err)
			}
			log.Printf("Successfully migrated database: %s", *dbName)
		} else {
			// Migrate all databases
			log.Println("Running migrations UP for all databases")
			if err := dbManager.MigrateAll(); err != nil {
				log.Fatalf("Failed to migrate databases: %v", err)
			}
			log.Println("Successfully migrated all databases")
		}
	} else if *direction == "down" {
		if *dbName == "" {
			log.Fatal("Must specify --db when migrating down")
		}
		log.Printf("Running migrations DOWN for database: %s (steps: %d)", *dbName, *steps)
		if err := dbManager.MigrateDown(*dbName, *steps); err != nil {
			log.Fatalf("Failed to rollback database %s: %v", *dbName, err)
		}
		log.Printf("Successfully rolled back database: %s", *dbName)
	} else {
		fmt.Fprintf(os.Stderr, "Invalid direction: %s (must be 'up' or 'down')\n", *direction)
		flag.Usage()
		os.Exit(1)
	}
}
