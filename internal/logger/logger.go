package logger

import (
	"context"
	"log/slog"
	"os"

	"money/internal/env"
)

var defaultLogger *slog.Logger

// Init initializes the global logger from environment variables
func Init() {
	logLevel := env.Get("LOG_LEVEL", "info")
	logFormat := env.Get("LOG_FORMAT", "json")

	var level slog.Level
	switch logLevel {
	case "debug":
		level = slog.LevelDebug
	case "info":
		level = slog.LevelInfo
	case "warn":
		level = slog.LevelWarn
	case "error":
		level = slog.LevelError
	default:
		level = slog.LevelInfo
	}

	opts := &slog.HandlerOptions{
		Level: level,
	}

	var handler slog.Handler
	if logFormat == "json" {
		handler = slog.NewJSONHandler(os.Stdout, opts)
	} else {
		handler = slog.NewTextHandler(os.Stdout, opts)
	}

	defaultLogger = slog.New(handler)
	slog.SetDefault(defaultLogger)
}

// Get returns the default logger
func Get() *slog.Logger {
	if defaultLogger == nil {
		// Initialize with default settings if not already initialized
		defaultLogger = slog.Default()
	}
	return defaultLogger
}

// FromContext returns a logger from context with additional fields
func FromContext(ctx context.Context) *slog.Logger {
	return Get()
}

// Debug logs a debug message
func Debug(msg string, args ...any) {
	Get().Debug(msg, args...)
}

// Info logs an info message
func Info(msg string, args ...any) {
	Get().Info(msg, args...)
}

// Warn logs a warning message
func Warn(msg string, args ...any) {
	Get().Warn(msg, args...)
}

// Error logs an error message
func Error(msg string, args ...any) {
	Get().Error(msg, args...)
}

// With returns a logger with additional fields
func With(args ...any) *slog.Logger {
	return Get().With(args...)
}
