package env

import (
	"fmt"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

// Load loads environment variables from .env file if it exists
func Load() error {
	// Load .env file if it exists (ignore error if file doesn't exist)
	_ = godotenv.Load()
	return nil
}

// MustLoad loads environment variables or panics
func MustLoad() {
	if err := Load(); err != nil {
		panic(fmt.Sprintf("failed to load environment: %v", err))
	}
}

// Get returns an environment variable or default value
func Get(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// MustGet returns an environment variable or panics if not set
func MustGet(key string) string {
	value := os.Getenv(key)
	if value == "" {
		panic(fmt.Sprintf("environment variable %s is required", key))
	}
	return value
}

// GetInt returns an environment variable as int or default value
func GetInt(key string, defaultValue int) int {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	intValue, err := strconv.Atoi(value)
	if err != nil {
		return defaultValue
	}
	return intValue
}

// GetBool returns an environment variable as bool or default value
func GetBool(key string, defaultValue bool) bool {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	boolValue, err := strconv.ParseBool(value)
	if err != nil {
		return defaultValue
	}
	return boolValue
}
