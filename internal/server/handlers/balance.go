package handlers

import (
	"fmt"
	"net/http"

	"money/internal/balance"
	"money/internal/server"

	"github.com/go-chi/chi/v5"
)

// BalanceHandler handles balance-related HTTP requests
type BalanceHandler struct {
	service *balance.Service
}

// NewBalanceHandler creates a new balance handler
func NewBalanceHandler(service *balance.Service) *BalanceHandler {
	return &BalanceHandler{
		service: service,
	}
}

// RegisterRoutes registers all balance routes
func (h *BalanceHandler) RegisterRoutes(r chi.Router) {
	r.Get("/account-balances/{accountId}", h.GetAccountBalances)

	r.Route("/balances", func(r chi.Router) {
		r.Post("/", h.Create)
		r.Post("/bulk", h.BulkImport)
		r.Get("/{id}", h.Get)
		r.Put("/{id}", h.Update)
		r.Delete("/{id}", h.Delete)
	})
}

// Create creates a new balance entry
func (h *BalanceHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req balance.CreateBalanceRequest
	if err := server.ParseJSON(r, &req); err != nil {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("invalid request body: %w", err))
		return
	}

	bal, err := h.service.Create(r.Context(), &req)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusCreated, bal)
}

// Get retrieves a single balance entry by ID
func (h *BalanceHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("balance ID is required"))
		return
	}

	bal, err := h.service.Get(r.Context(), id)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, bal)
}

// Update updates an existing balance entry
func (h *BalanceHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("balance ID is required"))
		return
	}

	var req balance.UpdateBalanceRequest
	if err := server.ParseJSON(r, &req); err != nil {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("invalid request body: %w", err))
		return
	}

	bal, err := h.service.Update(r.Context(), id, &req)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, bal)
}

// Delete deletes a balance entry
func (h *BalanceHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("balance ID is required"))
		return
	}

	resp, err := h.service.Delete(r.Context(), id)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, resp)
}

// GetAccountBalances retrieves all balance entries for a specific account
func (h *BalanceHandler) GetAccountBalances(w http.ResponseWriter, r *http.Request) {
	accountID := chi.URLParam(r, "accountId")
	if accountID == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("account ID is required"))
		return
	}

	resp, err := h.service.GetAccountBalances(r.Context(), accountID)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, resp)
}

// BulkImport imports multiple balance entries
func (h *BalanceHandler) BulkImport(w http.ResponseWriter, r *http.Request) {
	var req balance.BulkImportRequest
	if err := server.ParseJSON(r, &req); err != nil {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("invalid request body: %w", err))
		return
	}

	resp, err := h.service.BulkImport(r.Context(), &req)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, resp)
}
