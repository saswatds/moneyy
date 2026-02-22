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

// doGet performs a GET request and unmarshals the response into the provided target.
func (c *Client) doGet(url string, target any) error {
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.apiKey))
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "Moneyy-Desktop/1.0")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response body: %w", err)
	}

	contentType := resp.Header.Get("Content-Type")
	isJSON := strings.Contains(contentType, "application/json") || (len(body) > 0 && (body[0] == '{' || body[0] == '['))

	if resp.StatusCode != http.StatusOK {
		if !isJSON {
			return &APIError{StatusCode: resp.StatusCode, Msg: fmt.Sprintf("API returned non-JSON response (status %d)", resp.StatusCode)}
		}
		var apiErr APIErrorResponse
		if err := json.Unmarshal(body, &apiErr); err != nil {
			bodyStr := string(body)
			if len(bodyStr) > 200 {
				bodyStr = bodyStr[:200] + "..."
			}
			return &APIError{StatusCode: resp.StatusCode, Msg: fmt.Sprintf("API error (status %d): %s", resp.StatusCode, bodyStr)}
		}
		msg := apiErr.Message
		if msg == "" {
			msg = apiErr.Error
		}
		if msg == "" {
			msg = fmt.Sprintf("API error (status %d)", resp.StatusCode)
		}
		return &APIError{StatusCode: resp.StatusCode, Msg: msg}
	}

	if !isJSON {
		return fmt.Errorf("API returned non-JSON response. Expected JSON but received %s", contentType)
	}

	if err := json.Unmarshal(body, target); err != nil {
		bodyPreview := string(body)
		if len(bodyPreview) > 100 {
			bodyPreview = bodyPreview[:100] + "..."
		}
		return fmt.Errorf("failed to parse API response: %w (preview: %s)", err, bodyPreview)
	}

	return nil
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

// APIError wraps an upstream API error with its HTTP status code
type APIError struct {
	StatusCode int
	Msg        string
}

func (e *APIError) Error() string {
	return e.Msg
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
	var result APITaxBracketsResponse
	if err := c.doGet(url, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// GetTaxParams fetches tax parameters from the Moneyy API
func (c *Client) GetTaxParams(country string, year int, region string) (*APITaxParamsResponse, error) {
	url := fmt.Sprintf("%s/api/v1/tax-params/%s/%d/%s", c.baseURL, country, year, region)
	var result APITaxParamsResponse
	if err := c.doGet(url, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// --- Securities ---

// QuoteResponse represents a real-time price quote
type QuoteResponse struct {
	Symbol        string  `json:"symbol"`
	Price         float64 `json:"price"`
	Change        float64 `json:"change"`
	ChangePercent float64 `json:"change_percent"`
	High          float64 `json:"high"`
	Low           float64 `json:"low"`
	Open          float64 `json:"open"`
	PreviousClose float64 `json:"previous_close"`
	Volume        int64   `json:"volume"`
}

// ProfileResponse represents a company/security profile
type ProfileResponse struct {
	Symbol    string `json:"symbol"`
	Name      string `json:"name"`
	Sector    string `json:"sector"`
	Industry  string `json:"industry"`
	Country   string `json:"country"`
	MarketCap int64  `json:"market_cap"`
	Exchange  string `json:"exchange"`
	Currency  string `json:"currency"`
	Logo      string `json:"logo"`
	WebURL    string `json:"web_url"`
}

// GetQuote fetches a real-time quote for a symbol
func (c *Client) GetQuote(symbol string) (*QuoteResponse, error) {
	url := fmt.Sprintf("%s/api/v1/securities/quote/%s", c.baseURL, symbol)
	var result QuoteResponse
	if err := c.doGet(url, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// GetBatchQuotes fetches quotes for multiple symbols
func (c *Client) GetBatchQuotes(symbols []string) (map[string]*QuoteResponse, error) {
	url := fmt.Sprintf("%s/api/v1/securities/quotes?symbols=%s", c.baseURL, strings.Join(symbols, ","))
	var wrapper struct {
		Quotes []QuoteResponse `json:"quotes"`
	}
	if err := c.doGet(url, &wrapper); err != nil {
		return nil, err
	}
	result := make(map[string]*QuoteResponse, len(wrapper.Quotes))
	for i := range wrapper.Quotes {
		result[wrapper.Quotes[i].Symbol] = &wrapper.Quotes[i]
	}
	return result, nil
}

// GetProfile fetches a company/security profile
func (c *Client) GetProfile(symbol string) (*ProfileResponse, error) {
	url := fmt.Sprintf("%s/api/v1/securities/profile/%s", c.baseURL, symbol)
	var result ProfileResponse
	if err := c.doGet(url, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// --- ETFs ---

// ETFHolding represents a single holding within an ETF
type ETFHolding struct {
	Symbol string  `json:"symbol"`
	Name   string  `json:"name"`
	Weight float64 `json:"weight"`
	Shares int64   `json:"shares,omitempty"`
}

// ETFHoldingsResponse represents the underlying holdings of an ETF
type ETFHoldingsResponse struct {
	Symbol   string       `json:"symbol"`
	Holdings []ETFHolding `json:"holdings"`
}

// ETFSectorResponse represents the sector allocation of an ETF
type ETFSectorResponse struct {
	Symbol  string             `json:"symbol"`
	Sectors map[string]float64 `json:"sectors"`
}

// ETFCountryResponse represents the country allocation of an ETF
type ETFCountryResponse struct {
	Symbol    string             `json:"symbol"`
	Countries map[string]float64 `json:"countries"`
}

// ETFProfileResponse represents ETF metadata
type ETFProfileResponse struct {
	Symbol        string  `json:"symbol"`
	Name          string  `json:"name"`
	ExpenseRatio  float64 `json:"expense_ratio"`
	AUM           float64 `json:"aum"`
	InceptionDate string  `json:"inception_date"`
	Description   string  `json:"description"`
}

// GetETFHoldings fetches the underlying holdings of an ETF
func (c *Client) GetETFHoldings(symbol string) (*ETFHoldingsResponse, error) {
	url := fmt.Sprintf("%s/api/v1/etfs/%s/holdings", c.baseURL, symbol)
	var result ETFHoldingsResponse
	if err := c.doGet(url, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// GetETFSector fetches the sector allocation of an ETF
func (c *Client) GetETFSector(symbol string) (*ETFSectorResponse, error) {
	url := fmt.Sprintf("%s/api/v1/etfs/%s/sector", c.baseURL, symbol)
	var result ETFSectorResponse
	if err := c.doGet(url, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// GetETFCountry fetches the geographic allocation of an ETF
func (c *Client) GetETFCountry(symbol string) (*ETFCountryResponse, error) {
	url := fmt.Sprintf("%s/api/v1/etfs/%s/country", c.baseURL, symbol)
	var result ETFCountryResponse
	if err := c.doGet(url, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// GetETFProfile fetches ETF metadata
func (c *Client) GetETFProfile(symbol string) (*ETFProfileResponse, error) {
	url := fmt.Sprintf("%s/api/v1/etfs/%s/profile", c.baseURL, symbol)
	var result ETFProfileResponse
	if err := c.doGet(url, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
