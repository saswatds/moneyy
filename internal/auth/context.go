package auth

import "context"

type contextKey string

const UserIDKey contextKey = "user_id"

// GetUserID extracts the user ID from the request context
func GetUserID(ctx context.Context) string {
	userID, _ := ctx.Value(UserIDKey).(string)
	return userID
}

// WithUserID adds a user ID to the context
func WithUserID(ctx context.Context, userID string) context.Context {
	return context.WithValue(ctx, UserIDKey, userID)
}
