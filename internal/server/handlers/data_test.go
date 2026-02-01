package handlers

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"io"
	"mime/multipart"
	"money/internal/auth"
	"money/internal/data"
	"net/http"
	"net/http/httptest"
	"testing"

	_ "modernc.org/sqlite"
)

// TestHandleExport_Success tests successful export
func TestHandleExport_Success(t *testing.T) {
	db := setupTestDB(t)
	defer cleanupTestDB(t, db)

	// Create test data
	userID := "test-export-user"
	createTestAccount(t, db, userID)

	// Create handler
	exportService := data.NewExportService(db)
	importService := data.NewImportService(db)
	handler := NewDataHandler(exportService, importService)

	// Create request with authenticated user
	req := httptest.NewRequest("POST", "/api/data/export", nil)
	ctx := context.WithValue(req.Context(), auth.UserIDKey, userID)
	req = req.WithContext(ctx)

	// Create response recorder
	w := httptest.NewRecorder()

	// Call handler
	handler.HandleExport(w, req)

	// Verify response
	resp := w.Result()
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected status 200, got %d", resp.StatusCode)
	}

	// Verify content type
	contentType := resp.Header.Get("Content-Type")
	if contentType != "application/zip" {
		t.Errorf("Expected Content-Type 'application/zip', got '%s'", contentType)
	}

	// Verify content disposition
	contentDisposition := resp.Header.Get("Content-Disposition")
	if contentDisposition == "" {
		t.Error("Expected Content-Disposition header")
	}

	// Verify response body is not empty
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("Failed to read response body: %v", err)
	}

	if len(body) == 0 {
		t.Error("Expected non-empty response body")
	}
}

// TestHandleExport_Unauthorized tests export without authentication
func TestHandleExport_Unauthorized(t *testing.T) {
	db := setupTestDB(t)
	defer cleanupTestDB(t, db)

	exportService := data.NewExportService(db)
	importService := data.NewImportService(db)
	handler := NewDataHandler(exportService, importService)

	// Create request without user context
	req := httptest.NewRequest("POST", "/api/data/export", nil)
	w := httptest.NewRecorder()

	handler.HandleExport(w, req)

	resp := w.Result()
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("Expected status 401, got %d", resp.StatusCode)
	}
}

// TestHandleImport_Success tests successful import
func TestHandleImport_Success(t *testing.T) {
	db := setupTestDB(t)
	defer cleanupTestDB(t, db)

	exportService := data.NewExportService(db)
	importService := data.NewImportService(db)
	handler := NewDataHandler(exportService, importService)

	userID := "test-import-user"

	// Create valid archive
	archive := createValidTestArchive(t)

	// Create multipart form
	body, contentType := createMultipartForm(t, archive)

	// Create request
	req := httptest.NewRequest("POST", "/api/data/import", body)
	req.Header.Set("Content-Type", contentType)
	ctx := context.WithValue(req.Context(), auth.UserIDKey, userID)
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()

	handler.HandleImport(w, req)

	resp := w.Result()
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		t.Errorf("Expected status 200, got %d. Body: %s", resp.StatusCode, string(body))
	}

	// Parse response
	var result data.ImportResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	if !result.Success {
		t.Errorf("Expected successful import, got errors: %v", result.Errors)
	}
}

// TestHandleImport_Unauthorized tests import without authentication
func TestHandleImport_Unauthorized(t *testing.T) {
	db := setupTestDB(t)
	defer cleanupTestDB(t, db)

	exportService := data.NewExportService(db)
	importService := data.NewImportService(db)
	handler := NewDataHandler(exportService, importService)

	archive := createValidTestArchive(t)
	body, contentType := createMultipartForm(t, archive)

	// Create request without user context
	req := httptest.NewRequest("POST", "/api/data/import", body)
	req.Header.Set("Content-Type", contentType)

	w := httptest.NewRecorder()

	handler.HandleImport(w, req)

	resp := w.Result()
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("Expected status 401, got %d", resp.StatusCode)
	}
}

// TestHandleImport_InvalidFile tests import with missing file
func TestHandleImport_InvalidFile(t *testing.T) {
	db := setupTestDB(t)
	defer cleanupTestDB(t, db)

	exportService := data.NewExportService(db)
	importService := data.NewImportService(db)
	handler := NewDataHandler(exportService, importService)

	userID := "test-import-user"

	// Create request without file
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	writer.Close()

	req := httptest.NewRequest("POST", "/api/data/import", body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	ctx := context.WithValue(req.Context(), auth.UserIDKey, userID)
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()

	handler.HandleImport(w, req)

	resp := w.Result()
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", resp.StatusCode)
	}
}

// TestHandleImport_InvalidArchive tests import with invalid archive
func TestHandleImport_InvalidArchive(t *testing.T) {
	db := setupTestDB(t)
	defer cleanupTestDB(t, db)

	exportService := data.NewExportService(db)
	importService := data.NewImportService(db)
	handler := NewDataHandler(exportService, importService)

	userID := "test-import-user"

	// Create invalid archive (just random bytes)
	invalidArchive := []byte("not a valid zip file")
	body, contentType := createMultipartForm(t, invalidArchive)

	req := httptest.NewRequest("POST", "/api/data/import", body)
	req.Header.Set("Content-Type", contentType)
	ctx := context.WithValue(req.Context(), auth.UserIDKey, userID)
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()

	handler.HandleImport(w, req)

	resp := w.Result()
	defer resp.Body.Close()

	// Should return bad request or internal error
	if resp.StatusCode != http.StatusBadRequest && resp.StatusCode != http.StatusInternalServerError {
		t.Errorf("Expected status 400 or 500, got %d", resp.StatusCode)
	}
}

// TestHandleImport_FileSizeLimit tests file size limit enforcement
func TestHandleImport_FileSizeLimit(t *testing.T) {
	db := setupTestDB(t)
	defer cleanupTestDB(t, db)

	exportService := data.NewExportService(db)
	importService := data.NewImportService(db)
	handler := NewDataHandler(exportService, importService)

	userID := "test-import-user"

	// Create a file larger than MaxUploadSize (100MB)
	// For testing, we'll create a smaller size that simulates the limit
	largeData := make([]byte, MaxUploadSize+1000)
	body, contentType := createMultipartForm(t, largeData)

	req := httptest.NewRequest("POST", "/api/data/import", body)
	req.Header.Set("Content-Type", contentType)
	ctx := context.WithValue(req.Context(), auth.UserIDKey, userID)
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()

	handler.HandleImport(w, req)

	resp := w.Result()
	defer resp.Body.Close()

	// Should return bad request due to size limit
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("Expected status 400 for oversized file, got %d", resp.StatusCode)
	}
}

// TestHandleValidate_Success tests successful validation
func TestHandleValidate_Success(t *testing.T) {
	db := setupTestDB(t)
	defer cleanupTestDB(t, db)

	exportService := data.NewExportService(db)
	importService := data.NewImportService(db)
	handler := NewDataHandler(exportService, importService)

	// Create valid archive
	archive := createValidTestArchive(t)
	body, contentType := createMultipartForm(t, archive)

	req := httptest.NewRequest("POST", "/api/data/validate", body)
	req.Header.Set("Content-Type", contentType)

	w := httptest.NewRecorder()

	handler.HandleValidate(w, req)

	resp := w.Result()
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected status 200, got %d", resp.StatusCode)
	}

	// Parse response
	var result data.ValidationResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	if !result.Valid {
		t.Errorf("Expected valid archive, got errors: %v", result.Errors)
	}
}

// TestHandleValidate_InvalidArchive tests validation of invalid archive
func TestHandleValidate_InvalidArchive(t *testing.T) {
	db := setupTestDB(t)
	defer cleanupTestDB(t, db)

	exportService := data.NewExportService(db)
	importService := data.NewImportService(db)
	handler := NewDataHandler(exportService, importService)

	// Create invalid archive
	invalidArchive := []byte("not a valid zip")
	body, contentType := createMultipartForm(t, invalidArchive)

	req := httptest.NewRequest("POST", "/api/data/validate", body)
	req.Header.Set("Content-Type", contentType)

	w := httptest.NewRecorder()

	handler.HandleValidate(w, req)

	resp := w.Result()
	defer resp.Body.Close()

	// Validation should still return 200, but with validation result showing invalid
	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected status 200, got %d", resp.StatusCode)
	}

	var result data.ValidationResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	if result.Valid {
		t.Error("Expected invalid archive")
	}

	if len(result.Errors) == 0 {
		t.Error("Expected validation errors")
	}
}

// Helper functions - use data package helpers

func setupTestDB(t *testing.T) *sql.DB {
	t.Helper()
	return data.SetupTestDB(t)
}

func cleanupTestDB(t *testing.T, db *sql.DB) {
	t.Helper()
	data.CleanupTestDB(t, db)
}

func createTestAccount(t *testing.T, db *sql.DB, userID string) string {
	t.Helper()
	return data.CreateTestAccount(t, db, userID)
}

func createValidTestArchive(t *testing.T) []byte {
	t.Helper()
	return data.CreateValidTestArchive(t, "test-user")
}

func createMultipartForm(t *testing.T, fileData []byte) (*bytes.Buffer, string) {
	t.Helper()

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	// Create file field
	part, err := writer.CreateFormFile("file", "test-archive.zip")
	if err != nil {
		t.Fatalf("Failed to create form file: %v", err)
	}

	if _, err := part.Write(fileData); err != nil {
		t.Fatalf("Failed to write file data: %v", err)
	}

	// Add mode field
	if err := writer.WriteField("mode", "merge"); err != nil {
		t.Fatalf("Failed to write mode field: %v", err)
	}

	writer.Close()

	return body, writer.FormDataContentType()
}

// Note: No longer need getTestDatabaseURL - testcontainers handles it
