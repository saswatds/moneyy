package handlers

import (
	"fmt"
	"net/http"

	"money/internal/holdings"
	"money/internal/server"

	"github.com/go-chi/chi/v5"
)

// HoldingsHandler handles holdings-related HTTP requests
type HoldingsHandler struct {
	service *holdings.Service
}

// NewHoldingsHandler creates a new holdings handler
func NewHoldingsHandler(service *holdings.Service) *HoldingsHandler {
	return &HoldingsHandler{
		service: service,
	}
}

// RegisterRoutes registers all holdings routes
func (h *HoldingsHandler) RegisterRoutes(r chi.Router) {
	r.Route("/holdings", func(r chi.Router) {
		r.Post("/", h.Create)
		r.Get("/{id}", h.Get)
		r.Put("/{id}", h.Update)
		r.Delete("/{id}", h.Delete)
	})

	// Account-specific holdings
	r.Get("/accounts/{accountId}/holdings", h.GetAccountHoldings)
}

// Create creates a new holding
func (h *HoldingsHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req holdings.CreateHoldingRequest
	if err := server.ParseJSON(r, &req); err != nil {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("invalid request body: %w", err))
		return
	}

	holding, err := h.service.Create(r.Context(), &req)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusCreated, holding)
}

// Get retrieves a single holding by ID
func (h *HoldingsHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("holding ID is required"))
		return
	}

	holding, err := h.service.Get(r.Context(), id)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, holding)
}

// Update updates an existing holding
func (h *HoldingsHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("holding ID is required"))
		return
	}

	var req holdings.UpdateHoldingRequest
	if err := server.ParseJSON(r, &req); err != nil {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("invalid request body: %w", err))
		return
	}

	holding, err := h.service.Update(r.Context(), id, &req)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, holding)
}

// Delete deletes a holding
func (h *HoldingsHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("holding ID is required"))
		return
	}

	resp, err := h.service.Delete(r.Context(), id)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, resp)
}

// GetAccountHoldings retrieves all holdings for a specific account
func (h *HoldingsHandler) GetAccountHoldings(w http.ResponseWriter, r *http.Request) {
	accountID := chi.URLParam(r, "accountId")
	if accountID == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("account ID is required"))
		return
	}

	resp, err := h.service.GetAccountHoldings(r.Context(), accountID)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, resp)
}
