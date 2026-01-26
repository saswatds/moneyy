package wealthsimple

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"
)

const (
	// Base URLs
	apiBaseURL = "https://api.production.wealthsimple.com"
	gqlBaseURL = "https://my.wealthsimple.com/graphql"

	// Client constants
	clientID     = "4da53ac2b03225bed1550eba8e4611e086c7b905a3855e6ed12ea08c246758fa"
	apiVersion   = "12"
	clientName   = "@wealthsimple/wealthsimple"
	redirectURI  = "https://my.wealthsimple.com/app/login"
	scope        = "invest.read invest.write trade.read trade.write"
)

// Client represents a Wealthsimple API client
type Client struct {
	httpClient    *http.Client
	deviceID      string
	sessionID     string
	appInstanceID string
	accessToken   string
}

// NewClient creates a new Wealthsimple client
func NewClient(deviceID, sessionID, appInstanceID string) *Client {
	return &Client{
		httpClient:    &http.Client{Timeout: 30 * time.Second},
		deviceID:      deviceID,
		sessionID:     sessionID,
		appInstanceID: appInstanceID,
	}
}

// SetAccessToken sets the access token for authenticated requests
func (c *Client) SetAccessToken(token string) {
	c.accessToken = token
}

// LoginRequest represents the OAuth login request
type LoginRequest struct {
	GrantType    string `json:"grant_type"`
	Username     string `json:"username"`
	Password     string `json:"password"`
	SkipProvision bool  `json:"skip_provision"`
	RedirectURI  string `json:"redirect_uri"`
	Scope        string `json:"scope"`
	ClientID     string `json:"client_id"`
}

// LoginResponse represents the OAuth login response
type LoginResponse struct {
	OTPRequired           bool   `json:"-"` // Determined from headers
	OTPAuthenticatedClaim string `json:"-"` // From headers
	OTPOptions            string `json:"-"` // From headers
	Error                 string `json:"error,omitempty"`
	ErrorDescription      string `json:"error_description,omitempty"`
}

// TokenResponse represents the OAuth token response
type TokenResponse struct {
	AccessToken         string                       `json:"access_token"`
	RefreshToken        string                       `json:"refresh_token"`
	TokenType           string                       `json:"token_type"`
	ExpiresIn           int                          `json:"expires_in"`
	ExpiresAt           string                       `json:"expires_at"`
	Email               string                       `json:"email"`
	IdentityCanonicalID string                       `json:"identity_canonical_id"`
	Profiles            map[string]map[string]string `json:"profiles"`
}

// LoginResult represents the result of a login attempt
type LoginResult struct {
	OTPRequired bool
	LoginResponse *LoginResponse
	TokenResponse *TokenResponse
}

// Login attempts to log in with username and password
// Returns LoginResult with either OTP requirement or tokens
func (c *Client) Login(ctx context.Context, username, password string) (*LoginResult, error) {
	reqBody := LoginRequest{
		GrantType:    "password",
		Username:     username,
		Password:     password,
		SkipProvision: true,
		RedirectURI:  redirectURI,
		Scope:        scope,
		ClientID:     clientID,
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", apiBaseURL+"/v1/oauth/v2/token", bytes.NewBuffer(body))
	if err != nil {
		return nil, err
	}

	c.setCommonHeaders(req)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	// Check if OTP is required
	if resp.StatusCode == http.StatusUnauthorized {
		otpRequired := resp.Header.Get("x-wealthsimple-otp-required") == "true"
		if otpRequired {
			return &LoginResult{
				OTPRequired: true,
				LoginResponse: &LoginResponse{
					OTPRequired:           true,
					OTPAuthenticatedClaim: resp.Header.Get("x-wealthsimple-otp-authenticated-claim"),
					OTPOptions:            resp.Header.Get("x-wealthsimple-otp-options"),
				},
			}, nil
		}
		// Unauthorized but no OTP header - invalid credentials
		return nil, fmt.Errorf("unauthorized: invalid credentials")
	}

	if resp.StatusCode == http.StatusOK {
		// Success - decode token response
		var tokenResp TokenResponse
		if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
			return nil, fmt.Errorf("failed to decode token response: %w", err)
		}
		c.accessToken = tokenResp.AccessToken
		return &LoginResult{
			OTPRequired: false,
			TokenResponse: &tokenResp,
		}, nil
	}

	// Other error status codes
	bodyBytes, _ := io.ReadAll(resp.Body)
	return nil, fmt.Errorf("login failed with status %d: %s", resp.StatusCode, string(bodyBytes))
}

// VerifyOTP completes authentication with OTP code
func (c *Client) VerifyOTP(ctx context.Context, username, password, otpCode, otpAuthenticatedClaim string) (*TokenResponse, error) {
	reqBody := LoginRequest{
		GrantType:    "password",
		Username:     username,
		Password:     password,
		SkipProvision: true,
		RedirectURI:  redirectURI,
		Scope:        scope,
		ClientID:     clientID,
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", apiBaseURL+"/v1/oauth/v2/token", bytes.NewBuffer(body))
	if err != nil {
		return nil, err
	}

	c.setCommonHeaders(req)
	req.Header.Set("x-wealthsimple-otp", fmt.Sprintf("%s;remember=true", otpCode))
	req.Header.Set("x-wealthsimple-otp-authenticated-claim", otpAuthenticatedClaim)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("OTP verification failed: %s", string(bodyBytes))
	}

	var tokenResp TokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return nil, err
	}

	c.accessToken = tokenResp.AccessToken
	return &tokenResp, nil
}

// TokenInfoResponse represents the response from token/info endpoint
type TokenInfoResponse struct {
	ResourceOwnerID      string                       `json:"resource_owner_id"`
	Scope                []string                     `json:"scope"`
	ExpiresIn            int                          `json:"expires_in"`
	UserCanonicalID      string                       `json:"user_canonical_id"`
	IdentityCanonicalID  string                       `json:"identity_canonical_id"`
	Email                string                       `json:"email"`
	Profiles             map[string]map[string]string `json:"profiles"`
	CreatedAt            int64                        `json:"created_at"`
}

// CheckTokenInfo validates if an access token is still valid and returns token info
func (c *Client) CheckTokenInfo(ctx context.Context, accessToken string) (*TokenInfoResponse, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", apiBaseURL+"/v1/oauth/v2/token/info", nil)
	if err != nil {
		return nil, err
	}

	c.setCommonHeaders(req)
	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("token info check failed (status %d): %s", resp.StatusCode, string(bodyBytes))
	}

	var tokenInfo TokenInfoResponse
	if err := json.NewDecoder(resp.Body).Decode(&tokenInfo); err != nil {
		return nil, err
	}

	// Check if token has expired or is about to expire (less than 60 seconds remaining)
	if tokenInfo.ExpiresIn < 60 {
		return nil, fmt.Errorf("token expired or expiring soon (expires_in: %d seconds)", tokenInfo.ExpiresIn)
	}

	return &tokenInfo, nil
}

// GraphQLRequest represents a GraphQL request
type GraphQLRequest struct {
	Query     string                 `json:"query"`
	Variables map[string]interface{} `json:"variables,omitempty"`
}

// GraphQLResponse represents a GraphQL response
type GraphQLResponse struct {
	Data   interface{} `json:"data"`
	Errors []struct {
		Message string `json:"message"`
	} `json:"errors,omitempty"`
}

// QueryGraphQL executes a GraphQL query
func (c *Client) QueryGraphQL(ctx context.Context, query string, variables map[string]interface{}, profile string) (map[string]interface{}, error) {
	reqBody := GraphQLRequest{
		Query:     query,
		Variables: variables,
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", gqlBaseURL, bytes.NewBuffer(body))
	if err != nil {
		return nil, err
	}

	c.setCommonHeaders(req)
	req.Header.Set("Authorization", "Bearer "+c.accessToken)
	req.Header.Set("x-ws-client-library", "gql-sdk")
	req.Header.Set("x-ws-profile", profile)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		log.Printf("ERROR: graphql query failed: status=%d response=%s", resp.StatusCode, string(bodyBytes))
		return nil, fmt.Errorf("GraphQL query failed (status %d): %s", resp.StatusCode, string(bodyBytes))
	}

	log.Printf("DEBUG: graphql response: %s", string(bodyBytes))

	var gqlResp GraphQLResponse
	if err := json.Unmarshal(bodyBytes, &gqlResp); err != nil {
		log.Printf("ERROR: failed to decode graphql response: %v", err)
		return nil, err
	}

	if len(gqlResp.Errors) > 0 {
		log.Printf("ERROR: graphql query returned errors: %v", gqlResp.Errors)
		return nil, fmt.Errorf("GraphQL errors: %v", gqlResp.Errors)
	}

	data, ok := gqlResp.Data.(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("unexpected data format")
	}

	return data, nil
}

// setCommonHeaders sets common headers for all requests
func (c *Client) setCommonHeaders(req *http.Request) {
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-wealthsimple-client", clientName)
	req.Header.Set("x-ws-api-version", apiVersion)
	req.Header.Set("x-ws-device-id", c.deviceID)
	req.Header.Set("x-ws-session-id", c.sessionID)
	req.Header.Set("x-app-instance-id", c.appInstanceID)
	req.Header.Set("x-platform-os", "web")
}
