package moneyy

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const (
	// BaseURL is the base URL for the Moneyy API
	BaseURL = "https://api.moneyy.app"
)

// Client is an HTTP client for the Moneyy API
type Client struct {
	httpClient *http.Client
	baseURL    string
	apiKey     string
}

// NewClient creates a new Moneyy API client
func NewClient(apiKey string) *Client {
	return &Client{
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		baseURL: BaseURL,
		apiKey:  apiKey,
	}
}

// APITaxBracket represents a tax bracket from the Moneyy API
type APITaxBracket struct {
	Min  float64  `json:"min"`
	Max  *float64 `json:"max"` // null means unlimited
	Rate float64  `json:"rate"`
}

// APITaxBracketsResponse represents the response from the tax brackets endpoint
type APITaxBracketsResponse struct {
	Country  string          `json:"country"`
	Year     int             `json:"year"`
	Currency string          `json:"currency"`
	Region   string          `json:"region"`
	Federal  []APITaxBracket `json:"federal"`
	Regional []APITaxBracket `json:"regional"`
}

// APIErrorResponse represents an error response from the API
type APIErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message"`
}

// APITaxParamsResponse represents the response from the tax params endpoint
type APITaxParamsResponse struct {
	Country  string         `json:"country"`
	Year     int            `json:"year"`
	Region   string         `json:"region"`
	Currency string         `json:"currency"`
	CPP      APICPPParams   `json:"cpp"`
	EI       APIEIParams    `json:"ei"`
	BPA      APIBPAParams   `json:"bpa"`
	Credits  APITaxCredits  `json:"credits"`
	Savings  APISavings     `json:"savings"`
	QPIP     *APIQPIPParams `json:"qpip,omitempty"`
}

// APICPPParams represents CPP parameters from the API
type APICPPParams struct {
	YMPE                    float64             `json:"ympe"`
	BasicExemption          float64             `json:"basicExemption"`
	EmployeeRate            float64             `json:"employeeRate"`
	EmployerRate            float64             `json:"employerRate"`
	SelfEmployedRate        float64             `json:"selfEmployedRate"`
	MaxEmployeeContribution float64             `json:"maxEmployeeContribution"`
	MaxEmployerContribution float64             `json:"maxEmployerContribution"`
	Enhanced                *APICPPEnhanced     `json:"enhanced,omitempty"`
}

// APICPPEnhanced represents enhanced CPP parameters
type APICPPEnhanced struct {
	YAMPE                   float64 `json:"yampe"`
	EmployeeRate            float64 `json:"employeeRate"`
	EmployerRate            float64 `json:"employerRate"`
	SelfEmployedRate        float64 `json:"selfEmployedRate"`
	MaxEmployeeContribution float64 `json:"maxEmployeeContribution"`
	MaxEmployerContribution float64 `json:"maxEmployerContribution"`
}

// APIEIParams represents EI parameters from the API
type APIEIParams struct {
	MaxInsurableEarnings float64 `json:"maxInsurableEarnings"`
	EmployeeRate         float64 `json:"employeeRate"`
	EmployerRate         float64 `json:"employerRate"`
	EmployerMultiple     float64 `json:"employerMultiple"`
	MaxEmployeePremium   float64 `json:"maxEmployeePremium"`
	MaxEmployerPremium   float64 `json:"maxEmployerPremium"`
}

// APIBPAParams represents Basic Personal Amount parameters from the API
type APIBPAParams struct {
	Federal  APIBPAFederal `json:"federal"`
	Regional float64       `json:"regional"`
}

// APIBPAFederal represents federal BPA parameters
type APIBPAFederal struct {
	Amount        float64 `json:"amount"`
	ClawbackStart float64 `json:"clawbackStart"`
	ClawbackEnd   float64 `json:"clawbackEnd"`
	MinimumAmount float64 `json:"minimumAmount"`
}

// APITaxCredits represents tax credits from the API
type APITaxCredits struct {
	CanadaEmploymentAmount   float64 `json:"canadaEmploymentAmount"`
	AgeAmount                float64 `json:"ageAmount"`
	AgeAmountClawbackStart   float64 `json:"ageAmountClawbackStart"`
	SpouseAmount             float64 `json:"spouseAmount"`
}

// APISavings represents savings limits from the API
type APISavings struct {
	RRSPLimit      float64 `json:"rrspLimit"`
	RRSPPercentage float64 `json:"rrspPercentage"`
	TFSALimit      float64 `json:"tfsaLimit"`
}

// APIQPIPParams represents Quebec QPIP parameters (Quebec only)
type APIQPIPParams struct {
	MaxInsurableEarnings    float64 `json:"maxInsurableEarnings"`
	EmployeeRate            float64 `json:"employeeRate"`
	EmployerRate            float64 `json:"employerRate"`
	SelfEmployedRate        float64 `json:"selfEmployedRate"`
	MaxEmployeePremium      float64 `json:"maxEmployeePremium"`
	MaxEmployerPremium      float64 `json:"maxEmployerPremium"`
	MaxSelfEmployedPremium  float64 `json:"maxSelfEmployedPremium"`
}

// GetTaxBrackets fetches tax brackets from the Moneyy API
func (c *Client) GetTaxBrackets(country string, year int, region string) (*APITaxBracketsResponse, error) {
	url := fmt.Sprintf("%s/api/v1/tax-brackets/%s/%d/%s", c.baseURL, country, year, region)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Set headers
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.apiKey))
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "Moneyy-Desktop/1.0")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	// Check if response is JSON by looking at Content-Type header or first character
	contentType := resp.Header.Get("Content-Type")
	isJSON := strings.Contains(contentType, "application/json") || (len(body) > 0 && body[0] == '{')

	if resp.StatusCode != http.StatusOK {
		if !isJSON {
			// Non-JSON error response (likely HTML error page)
			return nil, fmt.Errorf("API returned non-JSON response (status %d). The API endpoint may not exist or the service may be unavailable.", resp.StatusCode)
		}
		var apiErr APIErrorResponse
		if err := json.Unmarshal(body, &apiErr); err != nil {
			// Truncate response for error message
			bodyStr := string(body)
			if len(bodyStr) > 200 {
				bodyStr = bodyStr[:200] + "..."
			}
			return nil, fmt.Errorf("API error (status %d): %s", resp.StatusCode, bodyStr)
		}
		if apiErr.Message != "" {
			return nil, fmt.Errorf("API error: %s", apiErr.Message)
		}
		if apiErr.Error != "" {
			return nil, fmt.Errorf("API error: %s", apiErr.Error)
		}
		return nil, fmt.Errorf("API error (status %d)", resp.StatusCode)
	}

	// Check if successful response is JSON
	if !isJSON {
		return nil, fmt.Errorf("API returned non-JSON response. Expected JSON but received %s", contentType)
	}

	var result APITaxBracketsResponse
	if err := json.Unmarshal(body, &result); err != nil {
		// Provide more context for JSON parse errors
		bodyPreview := string(body)
		if len(bodyPreview) > 100 {
			bodyPreview = bodyPreview[:100] + "..."
		}
		return nil, fmt.Errorf("failed to parse API response as JSON: %w (response preview: %s)", err, bodyPreview)
	}

	return &result, nil
}

// GetTaxParams fetches tax parameters from the Moneyy API
func (c *Client) GetTaxParams(country string, year int, region string) (*APITaxParamsResponse, error) {
	url := fmt.Sprintf("%s/api/v1/tax-params/%s/%d/%s", c.baseURL, country, year, region)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Set headers
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.apiKey))
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "Moneyy-Desktop/1.0")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	// Check if response is JSON by looking at Content-Type header or first character
	contentType := resp.Header.Get("Content-Type")
	isJSON := strings.Contains(contentType, "application/json") || (len(body) > 0 && body[0] == '{')

	if resp.StatusCode != http.StatusOK {
		if !isJSON {
			return nil, fmt.Errorf("API returned non-JSON response (status %d). The API endpoint may not exist or the service may be unavailable.", resp.StatusCode)
		}
		var apiErr APIErrorResponse
		if err := json.Unmarshal(body, &apiErr); err != nil {
			bodyStr := string(body)
			if len(bodyStr) > 200 {
				bodyStr = bodyStr[:200] + "..."
			}
			return nil, fmt.Errorf("API error (status %d): %s", resp.StatusCode, bodyStr)
		}
		if apiErr.Message != "" {
			return nil, fmt.Errorf("API error: %s", apiErr.Message)
		}
		if apiErr.Error != "" {
			return nil, fmt.Errorf("API error: %s", apiErr.Error)
		}
		return nil, fmt.Errorf("API error (status %d)", resp.StatusCode)
	}

	if !isJSON {
		return nil, fmt.Errorf("API returned non-JSON response. Expected JSON but received %s", contentType)
	}

	var result APITaxParamsResponse
	if err := json.Unmarshal(body, &result); err != nil {
		bodyPreview := string(body)
		if len(bodyPreview) > 100 {
			bodyPreview = bodyPreview[:100] + "..."
		}
		return nil, fmt.Errorf("failed to parse API response as JSON: %w (response preview: %s)", err, bodyPreview)
	}

	return &result, nil
}
