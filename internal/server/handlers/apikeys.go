package handlers

import (
	"fmt"
	"net/http"
	"strconv"

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
