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

		// Stock Options routes
		r.Post("/{id}/options/grants", h.CreateEquityGrant)
		r.Get("/{id}/options/grants", h.GetEquityGrants)
		r.Get("/{id}/options/grants/{grantId}", h.GetEquityGrant)
		r.Put("/{id}/options/grants/{grantId}", h.UpdateEquityGrant)
		r.Delete("/{id}/options/grants/{grantId}", h.DeleteEquityGrant)

		r.Post("/{id}/options/grants/{grantId}/vesting-schedule", h.SetVestingSchedule)
		r.Get("/{id}/options/grants/{grantId}/vesting-schedule", h.GetVestingSchedule)
		r.Get("/{id}/options/grants/{grantId}/vesting-events", h.GetVestingEvents)

		r.Post("/{id}/options/grants/{grantId}/exercises", h.RecordExercise)
		r.Get("/{id}/options/grants/{grantId}/exercises", h.GetExercises)

		r.Get("/{id}/options/exercises", h.GetAllExercises)
		r.Put("/{id}/options/exercises/{exerciseId}", h.UpdateExercise)
		r.Delete("/{id}/options/exercises/{exerciseId}", h.DeleteExercise)

		r.Post("/{id}/options/sales", h.RecordSale)
		r.Get("/{id}/options/sales", h.GetSales)
		r.Put("/{id}/options/sales/{saleId}", h.UpdateSale)
		r.Delete("/{id}/options/sales/{saleId}", h.DeleteSale)

		r.Post("/{id}/options/fmv", h.RecordFMV)
		r.Get("/{id}/options/fmv", h.GetFMVHistory)
		r.Get("/{id}/options/fmv/current", h.GetCurrentFMV)

		r.Get("/{id}/options/summary", h.GetOptionsSummary)
		r.Get("/{id}/options/tax-summary", h.GetTaxSummary)
		r.Get("/{id}/options/vesting-timeline", h.GetUpcomingVestingEvents)
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

// Stock Options handlers

// CreateEquityGrant creates a new equity grant
func (h *AccountHandler) CreateEquityGrant(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("account ID is required"))
		return
	}

	var req account.CreateEquityGrantRequest
	if err := server.ParseJSON(r, &req); err != nil {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("invalid request body: %w", err))
		return
	}

	req.AccountID = id
	grant, err := h.service.CreateEquityGrant(r.Context(), id, &req)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusCreated, grant)
}

// GetEquityGrants retrieves all equity grants for an account
func (h *AccountHandler) GetEquityGrants(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("account ID is required"))
		return
	}

	grants, err := h.service.GetEquityGrants(r.Context(), id)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, grants)
}

// GetEquityGrant retrieves a single equity grant
func (h *AccountHandler) GetEquityGrant(w http.ResponseWriter, r *http.Request) {
	grantID := chi.URLParam(r, "grantId")
	if grantID == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("grant ID is required"))
		return
	}

	grant, err := h.service.GetEquityGrant(r.Context(), grantID)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, grant)
}

// UpdateEquityGrant updates an equity grant
func (h *AccountHandler) UpdateEquityGrant(w http.ResponseWriter, r *http.Request) {
	grantID := chi.URLParam(r, "grantId")
	if grantID == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("grant ID is required"))
		return
	}

	var req account.UpdateEquityGrantRequest
	if err := server.ParseJSON(r, &req); err != nil {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("invalid request body: %w", err))
		return
	}

	grant, err := h.service.UpdateEquityGrant(r.Context(), grantID, &req)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, grant)
}

// DeleteEquityGrant deletes an equity grant
func (h *AccountHandler) DeleteEquityGrant(w http.ResponseWriter, r *http.Request) {
	grantID := chi.URLParam(r, "grantId")
	if grantID == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("grant ID is required"))
		return
	}

	err := h.service.DeleteEquityGrant(r.Context(), grantID)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, map[string]bool{"success": true})
}

// SetVestingSchedule sets the vesting schedule for a grant
func (h *AccountHandler) SetVestingSchedule(w http.ResponseWriter, r *http.Request) {
	grantID := chi.URLParam(r, "grantId")
	if grantID == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("grant ID is required"))
		return
	}

	var req account.SetVestingScheduleRequest
	if err := server.ParseJSON(r, &req); err != nil {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("invalid request body: %w", err))
		return
	}

	req.GrantID = grantID
	schedule, err := h.service.SetVestingSchedule(r.Context(), grantID, &req)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusCreated, schedule)
}

// GetVestingSchedule retrieves the vesting schedule for a grant
func (h *AccountHandler) GetVestingSchedule(w http.ResponseWriter, r *http.Request) {
	grantID := chi.URLParam(r, "grantId")
	if grantID == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("grant ID is required"))
		return
	}

	schedule, err := h.service.GetVestingSchedule(r.Context(), grantID)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, schedule)
}

// GetVestingEvents retrieves computed vesting events for a grant
func (h *AccountHandler) GetVestingEvents(w http.ResponseWriter, r *http.Request) {
	grantID := chi.URLParam(r, "grantId")
	if grantID == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("grant ID is required"))
		return
	}

	events, err := h.service.GetVestingEvents(r.Context(), grantID)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, events)
}

// RecordExercise records an exercise of options
func (h *AccountHandler) RecordExercise(w http.ResponseWriter, r *http.Request) {
	grantID := chi.URLParam(r, "grantId")
	if grantID == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("grant ID is required"))
		return
	}

	var req account.RecordExerciseRequest
	if err := server.ParseJSON(r, &req); err != nil {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("invalid request body: %w", err))
		return
	}

	req.GrantID = grantID
	exercise, err := h.service.RecordExercise(r.Context(), grantID, &req)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusCreated, exercise)
}

// GetExercises retrieves all exercises for a grant
func (h *AccountHandler) GetExercises(w http.ResponseWriter, r *http.Request) {
	grantID := chi.URLParam(r, "grantId")
	if grantID == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("grant ID is required"))
		return
	}

	exercises, err := h.service.GetExercises(r.Context(), grantID)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, exercises)
}

// GetAllExercises retrieves all exercises for an account
func (h *AccountHandler) GetAllExercises(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("account ID is required"))
		return
	}

	exercises, err := h.service.GetAllExercises(r.Context(), id)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, exercises)
}

// UpdateExercise updates an exercise
func (h *AccountHandler) UpdateExercise(w http.ResponseWriter, r *http.Request) {
	exerciseID := chi.URLParam(r, "exerciseId")
	if exerciseID == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("exercise ID is required"))
		return
	}

	var req account.UpdateExerciseRequest
	if err := server.ParseJSON(r, &req); err != nil {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("invalid request body: %w", err))
		return
	}

	exercise, err := h.service.UpdateExercise(r.Context(), exerciseID, &req)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, exercise)
}

// DeleteExercise deletes an exercise
func (h *AccountHandler) DeleteExercise(w http.ResponseWriter, r *http.Request) {
	exerciseID := chi.URLParam(r, "exerciseId")
	if exerciseID == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("exercise ID is required"))
		return
	}

	err := h.service.DeleteExercise(r.Context(), exerciseID)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, map[string]bool{"success": true})
}

// RecordSale records a sale of shares
func (h *AccountHandler) RecordSale(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("account ID is required"))
		return
	}

	var req account.RecordSaleRequest
	if err := server.ParseJSON(r, &req); err != nil {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("invalid request body: %w", err))
		return
	}

	req.AccountID = id
	sale, err := h.service.RecordSale(r.Context(), id, &req)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusCreated, sale)
}

// GetSales retrieves all sales for an account
func (h *AccountHandler) GetSales(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("account ID is required"))
		return
	}

	sales, err := h.service.GetSales(r.Context(), id)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, sales)
}

// UpdateSale updates a sale
func (h *AccountHandler) UpdateSale(w http.ResponseWriter, r *http.Request) {
	saleID := chi.URLParam(r, "saleId")
	if saleID == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("sale ID is required"))
		return
	}

	var req account.UpdateSaleRequest
	if err := server.ParseJSON(r, &req); err != nil {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("invalid request body: %w", err))
		return
	}

	sale, err := h.service.UpdateSale(r.Context(), saleID, &req)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, sale)
}

// DeleteSale deletes a sale
func (h *AccountHandler) DeleteSale(w http.ResponseWriter, r *http.Request) {
	saleID := chi.URLParam(r, "saleId")
	if saleID == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("sale ID is required"))
		return
	}

	err := h.service.DeleteSale(r.Context(), saleID)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, map[string]bool{"success": true})
}

// RecordFMV records a manual FMV entry
func (h *AccountHandler) RecordFMV(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("account ID is required"))
		return
	}

	var req account.RecordFMVRequest
	if err := server.ParseJSON(r, &req); err != nil {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("invalid request body: %w", err))
		return
	}

	req.AccountID = id
	entry, err := h.service.RecordFMV(r.Context(), id, &req)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusCreated, entry)
}

// GetFMVHistory retrieves all FMV entries for an account
func (h *AccountHandler) GetFMVHistory(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("account ID is required"))
		return
	}

	history, err := h.service.GetFMVHistory(r.Context(), id)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, history)
}

// GetCurrentFMV retrieves the current FMV for an account
func (h *AccountHandler) GetCurrentFMV(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("account ID is required"))
		return
	}

	entry, err := h.service.GetCurrentFMV(r.Context(), id)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	if entry == nil {
		server.RespondJSON(w, http.StatusOK, map[string]interface{}{"fmv": nil})
		return
	}

	server.RespondJSON(w, http.StatusOK, entry)
}

// GetOptionsSummary retrieves the options summary for an account
func (h *AccountHandler) GetOptionsSummary(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("account ID is required"))
		return
	}

	summary, err := h.service.GetOptionsSummary(r.Context(), id)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, summary)
}

// GetTaxSummary retrieves tax summary for an account and year
func (h *AccountHandler) GetTaxSummary(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("account ID is required"))
		return
	}

	yearStr := r.URL.Query().Get("year")
	year := 2024 // default
	if yearStr != "" {
		fmt.Sscanf(yearStr, "%d", &year)
	}

	summary, err := h.service.GetTaxSummary(r.Context(), id, year)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, summary)
}

// GetUpcomingVestingEvents retrieves upcoming vesting events for an account
func (h *AccountHandler) GetUpcomingVestingEvents(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("account ID is required"))
		return
	}

	daysStr := r.URL.Query().Get("days")
	days := 365 // default to 1 year
	if daysStr != "" {
		fmt.Sscanf(daysStr, "%d", &days)
	}

	events, err := h.service.GetUpcomingVestingEvents(r.Context(), id, days)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, events)
}
