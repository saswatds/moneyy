package auth

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const TokenExpiry = 7 * 24 * time.Hour // 7 days

// GenerateJWT generates a new JWT token for a user
func GenerateJWT(userID, email string, secret []byte) (string, error) {
	if len(secret) < 32 {
		return "", fmt.Errorf("JWT secret must be at least 32 characters")
	}

	claims := jwt.MapClaims{
		"user_id": userID,
		"email":   email,
		"iat":     time.Now().Unix(),
		"exp":     time.Now().Add(TokenExpiry).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString(secret)
	if err != nil {
		return "", fmt.Errorf("failed to sign token: %w", err)
	}

	return tokenString, nil
}

// VerifyJWT verifies a JWT token and returns the claims
func VerifyJWT(tokenString string, secret []byte) (*Claims, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		// Verify signing method
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return secret, nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to parse token: %w", err)
	}

	if !token.Valid {
		return nil, fmt.Errorf("invalid token")
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, fmt.Errorf("invalid claims format")
	}

	userID, ok := claims["user_id"].(string)
	if !ok {
		return nil, fmt.Errorf("missing user_id in claims")
	}

	email, ok := claims["email"].(string)
	if !ok {
		return nil, fmt.Errorf("missing email in claims")
	}

	iat, ok := claims["iat"].(float64)
	if !ok {
		return nil, fmt.Errorf("missing iat in claims")
	}

	exp, ok := claims["exp"].(float64)
	if !ok {
		return nil, fmt.Errorf("missing exp in claims")
	}

	return &Claims{
		UserID:    userID,
		Email:     email,
		IssuedAt:  int64(iat),
		ExpiresAt: int64(exp),
	}, nil
}
