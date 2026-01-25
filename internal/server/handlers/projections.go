package handlers

import (
	"fmt"
	"net/http"

	"money/internal/projections"
	"money/internal/server"

	"github.com/go-chi/chi/v5"
)

// ProjectionsHandler handles projections-related HTTP requests
type ProjectionsHandler struct {
	service *projections.Service
}

// NewProjectionsHandler creates a new projections handler
func NewProjectionsHandler(service *projections.Service) *ProjectionsHandler {
	return &ProjectionsHandler{
		service: service,
	}
}

// RegisterRoutes registers all projections routes
func (h *ProjectionsHandler) RegisterRoutes(r chi.Router) {
	r.Route("/projections", func(r chi.Router) {
		// Calculate projection based on config
		r.Post("/calculate", h.Calculate)

		// Manage projection scenarios
		r.Post("/scenarios", h.SaveConfig)
		r.Get("/scenarios", h.ListScenarios)
		r.Get("/scenarios/{id}", h.GetConfig)
		r.Put("/scenarios/{id}", h.UpdateConfig)
		r.Delete("/scenarios/{id}", h.DeleteConfig)
	})
}

// Calculate calculates projections based on provided configuration
func (h *ProjectionsHandler) Calculate(w http.ResponseWriter, r *http.Request) {
	var req projections.ProjectionRequest
	if err := server.ParseJSON(r, &req); err != nil {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("invalid request body: %w", err))
		return
	}

	resp, err := h.service.CalculateProjection(r.Context(), &req)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, resp)
}

// SaveConfig creates a new projection scenario
func (h *ProjectionsHandler) SaveConfig(w http.ResponseWriter, r *http.Request) {
	var req projections.CreateScenarioRequest
	if err := server.ParseJSON(r, &req); err != nil {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("invalid request body: %w", err))
		return
	}

	scenario, err := h.service.CreateScenario(r.Context(), &req)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusCreated, scenario)
}

// ListScenarios retrieves all projection scenarios
func (h *ProjectionsHandler) ListScenarios(w http.ResponseWriter, r *http.Request) {
	resp, err := h.service.ListScenarios(r.Context())
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, resp)
}

// GetConfig retrieves a specific projection scenario
func (h *ProjectionsHandler) GetConfig(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("scenario ID is required"))
		return
	}

	scenario, err := h.service.GetScenario(r.Context(), id)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, scenario)
}

// UpdateConfig updates an existing projection scenario
func (h *ProjectionsHandler) UpdateConfig(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("scenario ID is required"))
		return
	}

	var req projections.UpdateScenarioRequest
	if err := server.ParseJSON(r, &req); err != nil {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("invalid request body: %w", err))
		return
	}

	scenario, err := h.service.UpdateScenario(r.Context(), id, &req)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, scenario)
}

// DeleteConfig deletes a projection scenario
func (h *ProjectionsHandler) DeleteConfig(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("scenario ID is required"))
		return
	}

	resp, err := h.service.DeleteScenario(r.Context(), id)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, resp)
}
