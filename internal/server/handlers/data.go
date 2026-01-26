package handlers

import (
	"fmt"
	"io"
	"net/http"
	"time"

	"money/internal/data"
	"money/internal/server"

	"github.com/go-chi/chi/v5"
)

const (
	// MaxUploadSize is 100MB
	MaxUploadSize = 100 << 20
	// Default user ID (single-user application)
	DefaultUserID = "default-user"
)

// DataHandler handles data export/import HTTP requests
type DataHandler struct {
	exportService *data.ExportService
	importService *data.ImportService
}

// NewDataHandler creates a new data handler
func NewDataHandler(exportService *data.ExportService, importService *data.ImportService) *DataHandler {
	return &DataHandler{
		exportService: exportService,
		importService: importService,
	}
}

// RegisterRoutes registers all data routes
func (h *DataHandler) RegisterRoutes(r chi.Router) {
	r.Route("/data", func(r chi.Router) {
		r.Post("/export", h.HandleExport)
		r.Post("/import", h.HandleImport)
		r.Post("/validate", h.HandleValidate)
	})
}

// HandleExport handles data export requests
func (h *DataHandler) HandleExport(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Export data for default user
	archive, err := h.exportService.ExportData(ctx, DefaultUserID)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, fmt.Errorf("export failed: %w", err))
		return
	}

	// Generate filename with timestamp
	filename := fmt.Sprintf("money-export-%s.zip", time.Now().Format("2006-01-02T15-04-05"))

	// Set headers for file download
	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
	w.Header().Set("Content-Length", fmt.Sprintf("%d", len(archive)))

	// Write archive to response
	w.WriteHeader(http.StatusOK)
	if _, err := w.Write(archive); err != nil {
		// Log error but can't send error response as headers are already written
		fmt.Printf("Error writing response: %v\n", err)
	}
}

// HandleImport handles data import requests
func (h *DataHandler) HandleImport(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Limit request body size
	r.Body = http.MaxBytesReader(w, r.Body, MaxUploadSize)

	// Parse multipart form
	if err := r.ParseMultipartForm(MaxUploadSize); err != nil {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("failed to parse form: %w", err))
		return
	}

	// Get uploaded file
	file, _, err := r.FormFile("file")
	if err != nil {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("failed to get file: %w", err))
		return
	}
	defer file.Close()

	// Read file contents
	archive, err := io.ReadAll(file)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, fmt.Errorf("failed to read file: %w", err))
		return
	}

	// Get import mode from form (default to "merge")
	mode := r.FormValue("mode")
	if mode == "" {
		mode = "merge"
	}

	// Import data
	opts := data.ImportOptions{
		Mode:         mode,
		ValidateOnly: false,
	}

	result, err := h.importService.ImportData(ctx, DefaultUserID, archive, opts)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, fmt.Errorf("import failed: %w", err))
		return
	}

	// Return result
	if result.Success {
		server.RespondJSON(w, http.StatusOK, result)
	} else {
		server.RespondJSON(w, http.StatusBadRequest, result)
	}
}

// HandleValidate handles archive validation requests
func (h *DataHandler) HandleValidate(w http.ResponseWriter, r *http.Request) {
	// Limit request body size
	r.Body = http.MaxBytesReader(w, r.Body, MaxUploadSize)

	// Parse multipart form
	if err := r.ParseMultipartForm(MaxUploadSize); err != nil {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("failed to parse form: %w", err))
		return
	}

	// Get uploaded file
	file, _, err := r.FormFile("file")
	if err != nil {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("failed to get file: %w", err))
		return
	}
	defer file.Close()

	// Read file contents
	archive, err := io.ReadAll(file)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, fmt.Errorf("failed to read file: %w", err))
		return
	}

	// Validate archive
	result, err := h.importService.ValidateArchive(archive)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, fmt.Errorf("validation failed: %w", err))
		return
	}

	// Return validation result
	server.RespondJSON(w, http.StatusOK, result)
}
