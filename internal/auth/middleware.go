package auth

import (
	"log"
	"net/http"
	"strings"
)

// AuthMiddleware creates middleware that validates authentication tokens
func AuthMiddleware(provider AuthProvider) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Extract Bearer token from Authorization header
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				http.Error(w, `{"error":"unauthorized","message":"missing authorization header"}`, http.StatusUnauthorized)
				return
			}

			// Check Bearer prefix
			if !strings.HasPrefix(authHeader, "Bearer ") {
				http.Error(w, `{"error":"unauthorized","message":"invalid authorization header format"}`, http.StatusUnauthorized)
				return
			}

			token := strings.TrimPrefix(authHeader, "Bearer ")
			if token == "" {
				http.Error(w, `{"error":"unauthorized","message":"missing token"}`, http.StatusUnauthorized)
				return
			}

			// Verify token using provider
			userID, err := provider.VerifyToken(r.Context(), token)
			if err != nil {
				log.Printf("Token verification failed: %v", err)
				http.Error(w, `{"error":"unauthorized","message":"invalid token"}`, http.StatusUnauthorized)
				return
			}

			// Add user_id to context
			ctx := WithUserID(r.Context(), userID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// DemoModeMiddleware overrides the user context to demo user when X-Demo-Mode header is present
// This middleware should be placed after AuthMiddleware to ensure authentication is validated first
func DemoModeMiddleware(demoUserID string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := r.Context()

			// Check if demo mode is enabled via header
			if r.Header.Get("X-Demo-Mode") == "true" {
				// Override user context to demo user
				ctx = WithUserID(ctx, demoUserID)
			}

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
