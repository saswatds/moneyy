package handlers

import (
	"fmt"
	"net/http"

	"money/internal/server"
	"money/internal/sync"

	"github.com/go-chi/chi/v5"
)

// SyncHandler handles sync-related HTTP requests
type SyncHandler struct {
	service *sync.Service
}

// NewSyncHandler creates a new sync handler
func NewSyncHandler(service *sync.Service) *SyncHandler {
	return &SyncHandler{
		service: service,
	}
}

// RegisterRoutes registers all sync routes
func (h *SyncHandler) RegisterRoutes(r chi.Router) {
	r.Route("/sync", func(r chi.Router) {
		// Connection management
		r.Get("/wealthsimple/check-credentials", h.CheckWealthsimpleCredentials)
		r.Post("/wealthsimple/initiate", h.InitiateWealthsimpleConnection)
		r.Post("/wealthsimple/verify-otp", h.VerifyOTP)
		r.Get("/connections", h.ListConnections)
		r.Get("/connections/{id}", h.GetConnection)
		r.Post("/connections/{id}/sync", h.TriggerConnectionSync)
		r.Delete("/connections/{id}", h.DeleteConnection)
	})
}

// CheckWealthsimpleCredentials checks if Wealthsimple credentials exist
func (h *SyncHandler) CheckWealthsimpleCredentials(w http.ResponseWriter, r *http.Request) {
	resp, err := h.service.CheckWealthsimpleCredentials(r.Context())
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, resp)
}

// InitiateWealthsimpleConnection initiates a Wealthsimple connection
func (h *SyncHandler) InitiateWealthsimpleConnection(w http.ResponseWriter, r *http.Request) {
	var req sync.InitiateConnectionRequest
	if err := server.ParseJSON(r, &req); err != nil {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("invalid request body: %w", err))
		return
	}

	resp, err := h.service.InitiateWealthsimpleConnection(r.Context(), &req)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, resp)
}

// VerifyOTP verifies the OTP code for Wealthsimple connection
func (h *SyncHandler) VerifyOTP(w http.ResponseWriter, r *http.Request) {
	var req sync.VerifyOTPRequest
	if err := server.ParseJSON(r, &req); err != nil {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("invalid request body: %w", err))
		return
	}

	resp, err := h.service.VerifyOTP(r.Context(), &req)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, resp)
}

// ListConnections retrieves all sync connections
func (h *SyncHandler) ListConnections(w http.ResponseWriter, r *http.Request) {
	resp, err := h.service.ListConnections(r.Context())
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, resp)
}

// GetConnection retrieves a specific sync connection
func (h *SyncHandler) GetConnection(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("connection ID is required"))
		return
	}

	conn, err := h.service.GetConnection(r.Context(), id)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, conn)
}

// TriggerConnectionSync triggers a sync for a connection
func (h *SyncHandler) TriggerConnectionSync(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("connection ID is required"))
		return
	}

	// Get the connection first to check it exists
	_, err := h.service.GetConnection(r.Context(), id)
	if err != nil {
		server.RespondError(w, http.StatusNotFound, fmt.Errorf("connection not found"))
		return
	}

	// Return a pending status - actual sync happens asynchronously via worker
	resp := &sync.TriggerSyncResponse{
		ConnectionID: id,
		Status:       sync.SyncStatusPending,
		Message:      "Sync has been queued and will be processed shortly",
	}

	server.RespondJSON(w, http.StatusAccepted, resp)
}

// DeleteConnection deletes a sync connection
func (h *SyncHandler) DeleteConnection(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		server.RespondError(w, http.StatusBadRequest, fmt.Errorf("connection ID is required"))
		return
	}

	resp, err := h.service.DeleteConnection(r.Context(), id)
	if err != nil {
		server.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	server.RespondJSON(w, http.StatusOK, resp)
}
