package handlers

import (
	"fmt"
	"net/http"

	"money/internal/auth"
	"money/internal/data"
	"money/internal/server"

	"github.com/go-chi/chi/v5"
)

// DemoHandler handles demo data HTTP requests
type DemoHandler struct {
	demoService *data.DemoService
}

// NewDemoHandler creates a new demo handler
func NewDemoHandler(demoService *data.DemoService) *DemoHandler {
	return &DemoHandler{
		demoService: demoService,
	}
}

// RegisterRoutes registers all demo routes
func (h *DemoHandler) RegisterRoutes(r chi.Router) {
	r.Route("/demo", func(r chi.Router) {
		r.Post("/seed", h.HandleSeed)
		r.Post("/reset", h.HandleReset)
		r.Get("/status", h.HandleStatus)
	})
}

// HandleSeed handles demo data seeding requests
func (h *DemoHandler) HandleSeed(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Verify user is authenticated
	userID := auth.GetUserID(ctx)
	if userID == "" {
		server.RespondError(w, http.StatusUnauthorized, fmt.Errorf("user not authenticated"))
		return
	}

	// Always seed demo data for demo-user, not the authenticated user
	// This ensures demo mode works correctly
	const demoUserID = "demo-user"
	err := h.demoService.SeedDemoData(ctx, demoUserID)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, fmt.Errorf("failed to seed demo data: %w", err))
		return
	}

	server.RespondJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Demo data seeded successfully",
	})
}

// HandleReset handles demo data reset requests
func (h *DemoHandler) HandleReset(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Verify user is authenticated
	userID := auth.GetUserID(ctx)
	if userID == "" {
		server.RespondError(w, http.StatusUnauthorized, fmt.Errorf("user not authenticated"))
		return
	}

	// Always reset demo data for demo-user
	const demoUserID = "demo-user"
	err := h.demoService.ResetDemoData(ctx, demoUserID)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, fmt.Errorf("failed to reset demo data: %w", err))
		return
	}

	server.RespondJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Demo data reset successfully",
	})
}

// HandleStatus handles demo data status check requests
func (h *DemoHandler) HandleStatus(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Verify user is authenticated
	userID := auth.GetUserID(ctx)
	if userID == "" {
		server.RespondError(w, http.StatusUnauthorized, fmt.Errorf("user not authenticated"))
		return
	}

	// Always check demo data for demo-user
	const demoUserID = "demo-user"
	hasData, err := h.demoService.HasDemoData(ctx, demoUserID)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, fmt.Errorf("failed to check demo data status: %w", err))
		return
	}

	server.RespondJSON(w, http.StatusOK, map[string]interface{}{
		"has_data": hasData,
	})
}
