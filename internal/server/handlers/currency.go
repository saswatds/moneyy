package handlers

import (
	"net/http"

	"money/internal/currency"
	"money/internal/server"

	"github.com/go-chi/chi/v5"
)

// CurrencyHandler handles currency-related HTTP requests
type CurrencyHandler struct {
	service *currency.Service
}

// NewCurrencyHandler creates a new currency handler
func NewCurrencyHandler(service *currency.Service) *CurrencyHandler {
	return &CurrencyHandler{
		service: service,
	}
}

// RegisterRoutes registers all currency routes
func (h *CurrencyHandler) RegisterRoutes(r chi.Router) {
	r.Get("/currency/rates", h.GetLatestRates)
}

// GetLatestRates retrieves the latest exchange rates
func (h *CurrencyHandler) GetLatestRates(w http.ResponseWriter, r *http.Request) {
	rates, err := h.service.GetLatestRates(r.Context())
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, rates)
}
