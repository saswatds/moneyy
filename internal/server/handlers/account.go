package handlers

import (
	"fmt"
	"net/http"

	"money/internal/account"
	"money/internal/server"

	"github.com/go-chi/chi/v5"
)

// AccountHandler handles account-related HTTP requests
type AccountHandler struct {
	service *account.Service
}

// NewAccountHandler creates a new account handler
func NewAccountHandler(service *account.Service) *AccountHandler {
	return &AccountHandler{
		service: service,
	}
}

// RegisterRoutes registers all account routes
func (h *AccountHandler) RegisterRoutes(r chi.Router) {
	r.Get("/accounts-with-balance", h.ListWithBalance)
	r.Get("/summary/accounts", h.Summary)
	r.Get("/assets/summary", h.GetAssetsSummary)

	r.Route("/accounts", func(r chi.Router) {
		r.Post("/", h.Create)
		r.Get("/", h.List)
		r.Get("/{id}", h.Get)
		r.Put("/{id}", h.Update)
		r.Delete("/{id}", h.Delete)

		// Mortgage routes
		r.Post("/{id}/mortgage", h.CreateMortgageDetails)
		r.Get("/{id}/mortgage", h.GetMortgageDetails)
		r.Get("/{id}/mortgage/amortization", h.GetAmortizationSchedule)
		r.Post("/{id}/mortgage/payments", h.RecordMortgagePayment)
		r.Get("/{id}/mortgage/payments", h.GetMortgagePayments)

		// Loan routes
		r.Post("/{id}/loan", h.CreateLoanDetails)
		r.Get("/{id}/loan", h.GetLoanDetails)
		r.Get("/{id}/loan/amortization", h.GetLoanAmortizationSchedule)
		r.Post("/{id}/loan/payments", h.RecordLoanPayment)
		r.Get("/{id}/loan/payments", h.GetLoanPayments)

		// Asset routes
		r.Post("/{id}/asset", h.CreateAssetDetails)
		r.Get("/{id}/asset", h.GetAssetDetails)
		r.Put("/{id}/asset", h.UpdateAssetDetails)
		r.Get("/{id}/asset/valuation", h.GetAssetValuation)
		r.Get("/{id}/asset/depreciation", h.GetDepreciationHistory)
		r.Post("/{id}/asset/depreciation", h.RecordDepreciation)
		r.Get("/{id}/asset/depreciation-schedule", h.GetDepreciationSchedule)
	})
}

// Create creates a new account
func (h *AccountHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req account.CreateAccountRequest
	if err := server.ParseJSON(r, &req); err != nil {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("invalid request body: %w", err))
		return
	}

	acc, err := h.service.Create(r.Context(), &req)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusCreated, acc)
}

// List retrieves all accounts
func (h *AccountHandler) List(w http.ResponseWriter, r *http.Request) {
	resp, err := h.service.List(r.Context())
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, resp)
}

// ListWithBalance retrieves all accounts with their current balances
func (h *AccountHandler) ListWithBalance(w http.ResponseWriter, r *http.Request) {
	resp, err := h.service.ListWithBalance(r.Context())
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, resp)
}

// Summary retrieves account summary statistics
func (h *AccountHandler) Summary(w http.ResponseWriter, r *http.Request) {
	summary, err := h.service.Summary(r.Context())
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, summary)
}

// Get retrieves a single account by ID
func (h *AccountHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("account ID is required"))
		return
	}

	acc, err := h.service.Get(r.Context(), id)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, acc)
}

// Update updates an existing account
func (h *AccountHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("account ID is required"))
		return
	}

	var req account.UpdateAccountRequest
	if err := server.ParseJSON(r, &req); err != nil {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("invalid request body: %w", err))
		return
	}

	acc, err := h.service.Update(r.Context(), id, &req)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, acc)
}

// Delete deletes an account
func (h *AccountHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("account ID is required"))
		return
	}

	resp, err := h.service.Delete(r.Context(), id)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, resp)
}

// Mortgage handlers

// CreateMortgageDetails creates mortgage details for an account
func (h *AccountHandler) CreateMortgageDetails(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("account ID is required"))
		return
	}

	var req account.CreateMortgageDetailsRequest
	if err := server.ParseJSON(r, &req); err != nil {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("invalid request body: %w", err))
		return
	}

	req.AccountID = id
	details, err := h.service.CreateMortgageDetails(r.Context(), id, &req)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusCreated, details)
}

// GetMortgageDetails retrieves mortgage details for an account
func (h *AccountHandler) GetMortgageDetails(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("account ID is required"))
		return
	}

	details, err := h.service.GetMortgageDetails(r.Context(), id)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, details)
}

// GetAmortizationSchedule retrieves the mortgage amortization schedule
func (h *AccountHandler) GetAmortizationSchedule(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("account ID is required"))
		return
	}

	schedule, err := h.service.GetAmortizationSchedule(r.Context(), id)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, schedule)
}

// RecordMortgagePayment records a mortgage payment
func (h *AccountHandler) RecordMortgagePayment(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("account ID is required"))
		return
	}

	var req account.CreateMortgagePaymentRequest
	if err := server.ParseJSON(r, &req); err != nil {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("invalid request body: %w", err))
		return
	}

	req.AccountID = id
	payment, err := h.service.RecordMortgagePayment(r.Context(), id, &req)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusCreated, payment)
}

// GetMortgagePayments retrieves all mortgage payments
func (h *AccountHandler) GetMortgagePayments(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("account ID is required"))
		return
	}

	payments, err := h.service.GetMortgagePayments(r.Context(), id)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, payments)
}

// Loan handlers

// CreateLoanDetails creates loan details for an account
func (h *AccountHandler) CreateLoanDetails(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("account ID is required"))
		return
	}

	var req account.CreateLoanDetailsRequest
	if err := server.ParseJSON(r, &req); err != nil {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("invalid request body: %w", err))
		return
	}

	req.AccountID = id
	details, err := h.service.CreateLoanDetails(r.Context(), id, &req)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusCreated, details)
}

// GetLoanDetails retrieves loan details for an account
func (h *AccountHandler) GetLoanDetails(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("account ID is required"))
		return
	}

	details, err := h.service.GetLoanDetails(r.Context(), id)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, details)
}

// GetLoanAmortizationSchedule retrieves the loan amortization schedule
func (h *AccountHandler) GetLoanAmortizationSchedule(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("account ID is required"))
		return
	}

	schedule, err := h.service.GetLoanAmortizationSchedule(r.Context(), id)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, schedule)
}

// RecordLoanPayment records a loan payment
func (h *AccountHandler) RecordLoanPayment(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("account ID is required"))
		return
	}

	var req account.CreateLoanPaymentRequest
	if err := server.ParseJSON(r, &req); err != nil {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("invalid request body: %w", err))
		return
	}

	req.AccountID = id
	payment, err := h.service.RecordLoanPayment(r.Context(), id, &req)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusCreated, payment)
}

// GetLoanPayments retrieves all loan payments
func (h *AccountHandler) GetLoanPayments(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("account ID is required"))
		return
	}

	payments, err := h.service.GetLoanPayments(r.Context(), id)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, payments)
}

// Asset handlers

// CreateAssetDetails creates asset details for an account
func (h *AccountHandler) CreateAssetDetails(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("account ID is required"))
		return
	}

	var req account.CreateAssetDetailsRequest
	if err := server.ParseJSON(r, &req); err != nil {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("invalid request body: %w", err))
		return
	}

	req.AccountID = id
	details, err := h.service.CreateAssetDetails(r.Context(), id, &req)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusCreated, details)
}

// GetAssetDetails retrieves asset details for an account
func (h *AccountHandler) GetAssetDetails(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("account ID is required"))
		return
	}

	details, err := h.service.GetAssetDetails(r.Context(), id)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, details)
}

// UpdateAssetDetails updates asset details for an account
func (h *AccountHandler) UpdateAssetDetails(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("account ID is required"))
		return
	}

	var req account.UpdateAssetDetailsRequest
	if err := server.ParseJSON(r, &req); err != nil {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("invalid request body: %w", err))
		return
	}

	details, err := h.service.UpdateAssetDetails(r.Context(), id, &req)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, details)
}

// GetAssetValuation retrieves asset valuation with current value
func (h *AccountHandler) GetAssetValuation(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("account ID is required"))
		return
	}

	valuation, err := h.service.GetAssetValuation(r.Context(), id)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, valuation)
}

// GetDepreciationHistory retrieves depreciation history for an asset
func (h *AccountHandler) GetDepreciationHistory(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("account ID is required"))
		return
	}

	history, err := h.service.GetDepreciationHistory(r.Context(), id)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, history)
}

// RecordDepreciation records a manual depreciation entry
func (h *AccountHandler) RecordDepreciation(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("account ID is required"))
		return
	}

	var req account.CreateDepreciationEntryRequest
	if err := server.ParseJSON(r, &req); err != nil {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("invalid request body: %w", err))
		return
	}

	req.AccountID = id
	entry, err := h.service.RecordDepreciation(r.Context(), id, &req)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusCreated, entry)
}

// GetDepreciationSchedule retrieves the depreciation schedule
func (h *AccountHandler) GetDepreciationSchedule(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("account ID is required"))
		return
	}

	schedule, err := h.service.GetDepreciationSchedule(r.Context(), id)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, schedule)
}

// GetAssetsSummary retrieves all assets with calculated current values
func (h *AccountHandler) GetAssetsSummary(w http.ResponseWriter, r *http.Request) {
	summary, err := h.service.GetAssetsSummary(r.Context())
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, summary)
}
