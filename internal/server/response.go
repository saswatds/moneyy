package server

import (
	"encoding/json"
	"log"
	"net/http"
)

// ErrorResponse represents an error response
type ErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message,omitempty"`
	Code    int    `json:"code"`
}

// RespondJSON sends a JSON response with the given status code
func RespondJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)

	if err := json.NewEncoder(w).Encode(data); err != nil {
		log.Printf("ERROR: Failed to encode JSON response: %v", err)
	}
}

// RespondError sends an error response with the given status code
func RespondError(w http.ResponseWriter, status int, err error) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)

	response := ErrorResponse{
		Error:   err.Error(),
		Message: http.StatusText(status),
		Code:    status,
	}

	if encodeErr := json.NewEncoder(w).Encode(response); encodeErr != nil {
		log.Printf("ERROR: Failed to encode error response: %v", encodeErr)
	}
}

// RespondErrorMessage sends an error response with a custom message
func RespondErrorMessage(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)

	response := ErrorResponse{
		Error:   message,
		Message: http.StatusText(status),
		Code:    status,
	}

	if err := json.NewEncoder(w).Encode(response); err != nil {
		log.Printf("ERROR: Failed to encode error response: %v", err)
	}
}

// ParseJSON parses JSON from request body into the given struct
func ParseJSON(r *http.Request, v any) error {
	return json.NewDecoder(r.Body).Decode(v)
}
