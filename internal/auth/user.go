package auth

import (
	"context"
	"database/sql"
	"fmt"
	"time"
)

// User represents a user in the system
type User struct {
	ID          string    `json:"id"`
	Email       string    `json:"email"`
	Name        string    `json:"name"`
	ClerkUserID string    `json:"clerk_user_id,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// UserRepository handles user database operations
type UserRepository struct {
	db *sql.DB
}

// NewUserRepository creates a new user repository
func NewUserRepository(db *sql.DB) *UserRepository {
	return &UserRepository{db: db}
}

// Create creates a new user
func (r *UserRepository) Create(ctx context.Context, user *User) error {
	now := time.Now()
	user.CreatedAt = now
	user.UpdatedAt = now

	query := `
		INSERT INTO users (id, email, name, clerk_user_id, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6)
	`

	var clerkUserID *string
	if user.ClerkUserID != "" {
		clerkUserID = &user.ClerkUserID
	}

	_, err := r.db.ExecContext(ctx, query, user.ID, user.Email, user.Name, clerkUserID, user.CreatedAt, user.UpdatedAt)
	if err != nil {
		return fmt.Errorf("failed to create user: %w", err)
	}

	return nil
}

// GetByID retrieves a user by ID
func (r *UserRepository) GetByID(ctx context.Context, id string) (*User, error) {
	query := `
		SELECT id, email, name, clerk_user_id, created_at, updated_at
		FROM users
		WHERE id = $1
	`

	var user User
	var clerkUserID sql.NullString

	err := r.db.QueryRowContext(ctx, query, id).
		Scan(&user.ID, &user.Email, &user.Name, &clerkUserID, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("user not found")
		}
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	if clerkUserID.Valid {
		user.ClerkUserID = clerkUserID.String
	}

	return &user, nil
}

// GetByEmail retrieves a user by email
func (r *UserRepository) GetByEmail(ctx context.Context, email string) (*User, error) {
	query := `
		SELECT id, email, name, clerk_user_id, created_at, updated_at
		FROM users
		WHERE email = $1
	`

	var user User
	var clerkUserID sql.NullString

	err := r.db.QueryRowContext(ctx, query, email).
		Scan(&user.ID, &user.Email, &user.Name, &clerkUserID, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("user not found")
		}
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	if clerkUserID.Valid {
		user.ClerkUserID = clerkUserID.String
	}

	return &user, nil
}

// GetByClerkID retrieves a user by Clerk user ID
func (r *UserRepository) GetByClerkID(ctx context.Context, clerkUserID string) (*User, error) {
	query := `
		SELECT id, email, name, clerk_user_id, created_at, updated_at
		FROM users
		WHERE clerk_user_id = $1
	`

	var user User
	var clerkID sql.NullString

	err := r.db.QueryRowContext(ctx, query, clerkUserID).
		Scan(&user.ID, &user.Email, &user.Name, &clerkID, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, sql.ErrNoRows
		}
		return nil, fmt.Errorf("failed to get user by clerk ID: %w", err)
	}

	if clerkID.Valid {
		user.ClerkUserID = clerkID.String
	}

	return &user, nil
}

// Update updates a user
func (r *UserRepository) Update(ctx context.Context, user *User) error {
	user.UpdatedAt = time.Now()

	query := `
		UPDATE users
		SET email = $2, name = $3, updated_at = $4
		WHERE id = $1
	`

	_, err := r.db.ExecContext(ctx, query, user.ID, user.Email, user.Name, user.UpdatedAt)
	if err != nil {
		return fmt.Errorf("failed to update user: %w", err)
	}

	return nil
}
