package handlers

import (
	"fmt"
	"net/http"
	"strconv"

	"money/internal/income"
	"money/internal/server"

	"github.com/go-chi/chi/v5"
)

// IncomeHandler handles income-related HTTP requests
type IncomeHandler struct {
	service *income.Service
}

// NewIncomeHandler creates a new income handler
func NewIncomeHandler(service *income.Service) *IncomeHandler {
	return &IncomeHandler{
		service: service,
	}
}

// RegisterRoutes registers all income routes
func (h *IncomeHandler) RegisterRoutes(r chi.Router) {
	r.Route("/income", func(r chi.Router) {
		r.Get("/", h.ListIncomeRecords)
		r.Post("/", h.CreateIncomeRecord)
		r.Get("/{id}", h.GetIncomeRecord)
		r.Put("/{id}", h.UpdateIncomeRecord)
		r.Delete("/{id}", h.DeleteIncomeRecord)

		r.Get("/summary/{year}", h.GetAnnualSummary)
		r.Get("/comparison", h.GetMultiYearComparison)

		r.Get("/tax-config/{year}", h.GetTaxConfig)
		r.Post("/tax-config", h.SaveTaxConfig)
	})
}

// ListIncomeRecords lists all income records with optional filters
func (h *IncomeHandler) ListIncomeRecords(w http.ResponseWriter, r *http.Request) {
	req := &income.ListIncomeRecordsRequest{}

	// Parse optional query parameters
	if yearStr := r.URL.Query().Get("year"); yearStr != "" {
		year, err := strconv.Atoi(yearStr)
		if err != nil {
			server.RespondError(w, http.StatusBadRequest, fmt.Errorf("invalid year: %w", err))
			return
		}
		req.Year = &year
	}

	if categoryStr := r.URL.Query().Get("category"); categoryStr != "" {
		category := income.IncomeCategory(categoryStr)
		req.Category = &category
	}

	resp, err := h.service.ListIncomeRecords(r.Context(), req)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, resp)
}

// CreateIncomeRecord creates a new income record
func (h *IncomeHandler) CreateIncomeRecord(w http.ResponseWriter, r *http.Request) {
	var req income.CreateIncomeRecordRequest
	if err := server.ParseJSON(r, &req); err != nil {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("invalid request body: %w", err))
		return
	}

	record, err := h.service.CreateIncomeRecord(r.Context(), &req)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusCreated, record)
}

// GetIncomeRecord retrieves a single income record
func (h *IncomeHandler) GetIncomeRecord(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("income record ID is required"))
		return
	}

	record, err := h.service.GetIncomeRecord(r.Context(), id)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, record)
}

// UpdateIncomeRecord updates an existing income record
func (h *IncomeHandler) UpdateIncomeRecord(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("income record ID is required"))
		return
	}

	var req income.UpdateIncomeRecordRequest
	if err := server.ParseJSON(r, &req); err != nil {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("invalid request body: %w", err))
		return
	}

	record, err := h.service.UpdateIncomeRecord(r.Context(), id, &req)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, record)
}

// DeleteIncomeRecord deletes an income record
func (h *IncomeHandler) DeleteIncomeRecord(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("income record ID is required"))
		return
	}

	resp, err := h.service.DeleteIncomeRecord(r.Context(), id)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, resp)
}

// GetAnnualSummary retrieves the annual income summary with tax calculations
func (h *IncomeHandler) GetAnnualSummary(w http.ResponseWriter, r *http.Request) {
	yearStr := chi.URLParam(r, "year")
	if yearStr == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("year is required"))
		return
	}

	year, err := strconv.Atoi(yearStr)
	if err != nil {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("invalid year: %w", err))
		return
	}

	summary, err := h.service.GetAnnualSummary(r.Context(), year)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, summary)
}

// GetMultiYearComparison retrieves income comparison across multiple years
func (h *IncomeHandler) GetMultiYearComparison(w http.ResponseWriter, r *http.Request) {
	startYearStr := r.URL.Query().Get("start")
	endYearStr := r.URL.Query().Get("end")

	if startYearStr == "" || endYearStr == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("start and end years are required"))
		return
	}

	startYear, err := strconv.Atoi(startYearStr)
	if err != nil {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("invalid start year: %w", err))
		return
	}

	endYear, err := strconv.Atoi(endYearStr)
	if err != nil {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("invalid end year: %w", err))
		return
	}

	comparison, err := h.service.GetMultiYearComparison(r.Context(), startYear, endYear)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, comparison)
}

// GetTaxConfig retrieves tax configuration for a year
func (h *IncomeHandler) GetTaxConfig(w http.ResponseWriter, r *http.Request) {
	yearStr := chi.URLParam(r, "year")
	if yearStr == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("year is required"))
		return
	}

	year, err := strconv.Atoi(yearStr)
	if err != nil {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("invalid year: %w", err))
		return
	}

	config, err := h.service.GetTaxConfig(r.Context(), year)
	if err != nil {
		// Return default config if not found
		server.RespondJSON(w, http.StatusOK, map[string]any{
			"tax_year": year,
			"province": "ON",
			"federal_brackets": []map[string]any{
				{"up_to_income": 55867, "rate": 0.15},
				{"up_to_income": 111733, "rate": 0.205},
				{"up_to_income": 173205, "rate": 0.26},
				{"up_to_income": 246752, "rate": 0.29},
				{"up_to_income": 0, "rate": 0.33},
			},
			"provincial_brackets": []map[string]any{
				{"up_to_income": 51446, "rate": 0.0505},
				{"up_to_income": 102894, "rate": 0.0915},
				{"up_to_income": 150000, "rate": 0.1116},
				{"up_to_income": 220000, "rate": 0.1216},
				{"up_to_income": 0, "rate": 0.1316},
			},
			"cpp_rate":                      0.0595,
			"cpp_max_pensionable_earnings":  68500,
			"cpp_basic_exemption":           3500,
			"ei_rate":                       0.0163,
			"ei_max_insurable_earnings":     63200,
			"basic_personal_amount":         15705,
		})
		return
	}

	server.RespondJSON(w, http.StatusOK, config)
}

// SaveTaxConfig saves or updates tax configuration for a year
func (h *IncomeHandler) SaveTaxConfig(w http.ResponseWriter, r *http.Request) {
	var req income.SaveTaxConfigRequest
	if err := server.ParseJSON(r, &req); err != nil {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("invalid request body: %w", err))
		return
	}

	config, err := h.service.SaveTaxConfig(r.Context(), &req)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusCreated, config)
}
