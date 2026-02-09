package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"money/internal/apikeys"
	"money/internal/moneyy"
	"money/internal/server"

	"github.com/go-chi/chi/v5"
)

// APIKeysHandler handles API key-related HTTP requests
type APIKeysHandler struct {
	apiKeysSvc *apikeys.Service
	moneySvc   *moneyy.Service
}

// NewAPIKeysHandler creates a new API keys handler
func NewAPIKeysHandler(apiKeysSvc *apikeys.Service, moneySvc *moneyy.Service) *APIKeysHandler {
	return &APIKeysHandler{
		apiKeysSvc: apiKeysSvc,
		moneySvc:   moneySvc,
	}
}

// RegisterRoutes registers all API key routes
func (h *APIKeysHandler) RegisterRoutes(r chi.Router) {
	// API Keys routes
	r.Route("/api-keys", func(r chi.Router) {
		r.Get("/status/{provider}", h.GetAPIKeyStatus)
		r.Post("/", h.SaveAPIKey)
		r.Delete("/{provider}", h.DeleteAPIKey)
	})

	// Moneyy API routes
	r.Route("/moneyy", func(r chi.Router) {
		r.Get("/tax-brackets/{country}/{year}/{region}", h.FetchTaxBrackets)
		r.Get("/tax-params/{country}/{year}/{region}", h.FetchTaxParams)

		// Securities
		r.Get("/securities/quote/{symbol}", h.GetSecurityQuote)
		r.Get("/securities/quotes", h.GetBatchQuotes)
		r.Get("/securities/profile/{symbol}", h.GetSecurityProfile)

		// ETFs
		r.Get("/etfs/{symbol}/holdings", h.GetETFHoldings)
		r.Get("/etfs/{symbol}/sector", h.GetETFSector)
		r.Get("/etfs/{symbol}/country", h.GetETFCountry)
		r.Get("/etfs/{symbol}/profile", h.GetETFProfile)
	})
}

// GetAPIKeyStatus returns the status of an API key for a provider
func (h *APIKeysHandler) GetAPIKeyStatus(w http.ResponseWriter, r *http.Request) {
	provider := chi.URLParam(r, "provider")
	if provider == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("provider is required"))
		return
	}

	status, err := h.apiKeysSvc.GetAPIKeyStatus(r.Context(), provider)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, status)
}

// SaveAPIKey saves or updates an API key
func (h *APIKeysHandler) SaveAPIKey(w http.ResponseWriter, r *http.Request) {
	var req apikeys.SaveAPIKeyRequest
	if err := server.ParseJSON(r, &req); err != nil {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("invalid request body: %w", err))
		return
	}

	status, err := h.apiKeysSvc.SaveAPIKey(r.Context(), &req)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusCreated, status)
}

// DeleteAPIKey removes an API key for a provider
func (h *APIKeysHandler) DeleteAPIKey(w http.ResponseWriter, r *http.Request) {
	provider := chi.URLParam(r, "provider")
	if provider == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("provider is required"))
		return
	}

	resp, err := h.apiKeysSvc.DeleteAPIKey(r.Context(), provider)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, resp)
}

// FetchTaxBrackets fetches tax brackets from the Moneyy API
func (h *APIKeysHandler) FetchTaxBrackets(w http.ResponseWriter, r *http.Request) {
	country := chi.URLParam(r, "country")
	yearStr := chi.URLParam(r, "year")
	region := chi.URLParam(r, "region")

	if country == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("country is required"))
		return
	}
	if yearStr == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("year is required"))
		return
	}
	if region == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("region is required"))
		return
	}

	year, err := strconv.Atoi(yearStr)
	if err != nil {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("invalid year: %w", err))
		return
	}

	brackets, err := h.moneySvc.FetchTaxBrackets(r.Context(), country, year, region)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, brackets)
}

// FetchTaxParams fetches tax parameters from the Moneyy API
func (h *APIKeysHandler) FetchTaxParams(w http.ResponseWriter, r *http.Request) {
	country := chi.URLParam(r, "country")
	yearStr := chi.URLParam(r, "year")
	region := chi.URLParam(r, "region")

	if country == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("country is required"))
		return
	}
	if yearStr == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("year is required"))
		return
	}
	if region == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("region is required"))
		return
	}

	year, err := strconv.Atoi(yearStr)
	if err != nil {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("invalid year: %w", err))
		return
	}

	params, err := h.moneySvc.FetchTaxParams(r.Context(), country, year, region)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, params)
}

// --- Securities Handlers ---

// GetSecurityQuote fetches a real-time quote for a symbol
func (h *APIKeysHandler) GetSecurityQuote(w http.ResponseWriter, r *http.Request) {
	symbol := chi.URLParam(r, "symbol")
	if symbol == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("symbol is required"))
		return
	}

	quote, err := h.moneySvc.GetQuote(r.Context(), symbol)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, quote)
}

// GetBatchQuotes fetches quotes for multiple symbols
func (h *APIKeysHandler) GetBatchQuotes(w http.ResponseWriter, r *http.Request) {
	symbolsParam := r.URL.Query().Get("symbols")
	if symbolsParam == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("symbols query parameter is required"))
		return
	}

	symbols := strings.Split(symbolsParam, ",")
	for i := range symbols {
		symbols[i] = strings.TrimSpace(symbols[i])
	}

	quotes, err := h.moneySvc.GetBatchQuotes(r.Context(), symbols)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, quotes)
}

// GetSecurityProfile fetches a company/security profile
func (h *APIKeysHandler) GetSecurityProfile(w http.ResponseWriter, r *http.Request) {
	symbol := chi.URLParam(r, "symbol")
	if symbol == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("symbol is required"))
		return
	}

	profile, err := h.moneySvc.GetProfile(r.Context(), symbol)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, profile)
}

// --- ETF Handlers ---

// GetETFHoldings fetches the underlying holdings of an ETF
func (h *APIKeysHandler) GetETFHoldings(w http.ResponseWriter, r *http.Request) {
	symbol := chi.URLParam(r, "symbol")
	if symbol == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("symbol is required"))
		return
	}

	holdings, err := h.moneySvc.GetETFHoldings(r.Context(), symbol)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, holdings)
}

// GetETFSector fetches the sector allocation of an ETF
func (h *APIKeysHandler) GetETFSector(w http.ResponseWriter, r *http.Request) {
	symbol := chi.URLParam(r, "symbol")
	if symbol == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("symbol is required"))
		return
	}

	sector, err := h.moneySvc.GetETFSector(r.Context(), symbol)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, sector)
}

// GetETFCountry fetches the geographic allocation of an ETF
func (h *APIKeysHandler) GetETFCountry(w http.ResponseWriter, r *http.Request) {
	symbol := chi.URLParam(r, "symbol")
	if symbol == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("symbol is required"))
		return
	}

	country, err := h.moneySvc.GetETFCountry(r.Context(), symbol)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, country)
}

// GetETFProfile fetches ETF metadata
func (h *APIKeysHandler) GetETFProfile(w http.ResponseWriter, r *http.Request) {
	symbol := chi.URLParam(r, "symbol")
	if symbol == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("symbol is required"))
		return
	}

	profile, err := h.moneySvc.GetETFProfile(r.Context(), symbol)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, profile)
}
