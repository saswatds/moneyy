package handlers

import (
	"fmt"
	"net/http"

	"money/internal/server"
	"money/internal/transaction"

	"github.com/go-chi/chi/v5"
)

// TransactionHandler handles transaction-related HTTP requests
type TransactionHandler struct {
	service *transaction.Service
}

// NewTransactionHandler creates a new transaction handler
func NewTransactionHandler(service *transaction.Service) *TransactionHandler {
	return &TransactionHandler{
		service: service,
	}
}

// RegisterRoutes registers all transaction routes
func (h *TransactionHandler) RegisterRoutes(r chi.Router) {
	r.Route("/recurring-expenses", func(r chi.Router) {
		r.Post("/", h.CreateRecurringExpense)
		r.Get("/", h.ListRecurringExpenses)
		r.Get("/{id}", h.GetRecurringExpense)
		r.Put("/{id}", h.UpdateRecurringExpense)
		r.Delete("/{id}", h.DeleteRecurringExpense)
	})
}

// CreateRecurringExpense creates a new recurring expense
func (h *TransactionHandler) CreateRecurringExpense(w http.ResponseWriter, r *http.Request) {
	var req transaction.CreateRecurringExpenseRequest
	if err := server.ParseJSON(r, &req); err != nil {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("invalid request body: %w", err))
		return
	}

	expense, err := h.service.CreateRecurringExpense(r.Context(), &req)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusCreated, expense)
}

// ListRecurringExpenses retrieves all recurring expenses
func (h *TransactionHandler) ListRecurringExpenses(w http.ResponseWriter, r *http.Request) {
	resp, err := h.service.ListRecurringExpenses(r.Context())
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, resp)
}

// GetRecurringExpense retrieves a specific recurring expense
func (h *TransactionHandler) GetRecurringExpense(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("expense ID is required"))
		return
	}

	expense, err := h.service.GetRecurringExpense(r.Context(), id)
	if err != nil {
		if err == transaction.ErrNotFound {
			server.RespondError(w, http.StatusNotFound, err)
			return
		}
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, expense)
}

// UpdateRecurringExpense updates an existing recurring expense
func (h *TransactionHandler) UpdateRecurringExpense(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("expense ID is required"))
		return
	}

	var req transaction.UpdateRecurringExpenseRequest
	if err := server.ParseJSON(r, &req); err != nil {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("invalid request body: %w", err))
		return
	}

	expense, err := h.service.UpdateRecurringExpense(r.Context(), id, &req)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, expense)
}

// DeleteRecurringExpense deletes a recurring expense
func (h *TransactionHandler) DeleteRecurringExpense(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("expense ID is required"))
		return
	}

	err := h.service.DeleteRecurringExpense(r.Context(), id)
	if err != nil {
		if err == transaction.ErrNotFound {
			server.RespondError(w, http.StatusNotFound, err)
			return
		}
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, map[string]bool{"success": true})
}
