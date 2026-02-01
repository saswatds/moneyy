package moneyy

import (
	"context"
	"fmt"

	"money/internal/apikeys"
)

// TaxBracket represents a tax bracket in internal format
type TaxBracket struct {
	UpToIncome float64 `json:"up_to_income"`
	Rate       float64 `json:"rate"`
}

// TransformedTaxBrackets represents the transformed tax brackets response
type TransformedTaxBrackets struct {
	Country            string       `json:"country"`
	Year               int          `json:"year"`
	Region             string       `json:"region"`
	FederalBrackets    []TaxBracket `json:"federal_brackets"`
	ProvincialBrackets []TaxBracket `json:"provincial_brackets"`
}

// TransformedTaxParams represents the transformed tax parameters response
type TransformedTaxParams struct {
	Country                   string  `json:"country"`
	Year                      int     `json:"year"`
	Region                    string  `json:"region"`
	CPPRate                   float64 `json:"cpp_rate"`
	CPPMaxPensionableEarnings float64 `json:"cpp_max_pensionable_earnings"`
	CPPBasicExemption         float64 `json:"cpp_basic_exemption"`
	EIRate                    float64 `json:"ei_rate"`
	EIMaxInsurableEarnings    float64 `json:"ei_max_insurable_earnings"`
	BasicPersonalAmount       float64 `json:"basic_personal_amount"`
	// Additional fields for reference (not used in tax config but useful to display)
	RRSPLimit                 float64 `json:"rrsp_limit"`
	TFSALimit                 float64 `json:"tfsa_limit"`
}

// Service provides Moneyy API integration functionality
type Service struct {
	apiKeysSvc *apikeys.Service
}

// NewService creates a new Moneyy service
func NewService(apiKeysSvc *apikeys.Service) *Service {
	return &Service{
		apiKeysSvc: apiKeysSvc,
	}
}

// FetchTaxBrackets fetches and transforms tax brackets from the Moneyy API
func (s *Service) FetchTaxBrackets(ctx context.Context, country string, year int, region string) (*TransformedTaxBrackets, error) {
	// Get the decrypted API key
	apiKey, err := s.apiKeysSvc.GetDecryptedAPIKey(ctx, apikeys.ProviderMoneyy)
	if err != nil {
		return nil, fmt.Errorf("failed to get API key: %w", err)
	}

	// Create client and fetch brackets
	client := NewClient(apiKey)
	apiResponse, err := client.GetTaxBrackets(country, year, region)
	if err != nil {
		return nil, err
	}

	// Transform API response to internal format
	return s.transformBrackets(apiResponse), nil
}

// FetchTaxParams fetches and transforms tax parameters from the Moneyy API
func (s *Service) FetchTaxParams(ctx context.Context, country string, year int, region string) (*TransformedTaxParams, error) {
	// Get the decrypted API key
	apiKey, err := s.apiKeysSvc.GetDecryptedAPIKey(ctx, apikeys.ProviderMoneyy)
	if err != nil {
		return nil, fmt.Errorf("failed to get API key: %w", err)
	}

	// Create client and fetch params
	client := NewClient(apiKey)
	apiResponse, err := client.GetTaxParams(country, year, region)
	if err != nil {
		return nil, err
	}

	// Transform API response to internal format
	return s.transformParams(apiResponse), nil
}

// transformParams converts API tax params to internal format
func (s *Service) transformParams(apiResponse *APITaxParamsResponse) *TransformedTaxParams {
	return &TransformedTaxParams{
		Country:                   apiResponse.Country,
		Year:                      apiResponse.Year,
		Region:                    apiResponse.Region,
		CPPRate:                   apiResponse.CPP.EmployeeRate,
		CPPMaxPensionableEarnings: apiResponse.CPP.YMPE,
		CPPBasicExemption:         apiResponse.CPP.BasicExemption,
		EIRate:                    apiResponse.EI.EmployeeRate,
		EIMaxInsurableEarnings:    apiResponse.EI.MaxInsurableEarnings,
		BasicPersonalAmount:       apiResponse.BPA.Federal.Amount,
		RRSPLimit:                 apiResponse.Savings.RRSPLimit,
		TFSALimit:                 apiResponse.Savings.TFSALimit,
	}
}

// transformBrackets converts API tax brackets to internal format
// API format: { min: 0, max: 55867, rate: 0.15 }, { min: 55867, max: null, rate: 0.33 }
// Internal format: { up_to_income: 55867, rate: 0.15 }, { up_to_income: 0, rate: 0.33 }
// (Note: up_to_income: 0 means unlimited in internal format)
func (s *Service) transformBrackets(apiResponse *APITaxBracketsResponse) *TransformedTaxBrackets {
	return &TransformedTaxBrackets{
		Country:            apiResponse.Country,
		Year:               apiResponse.Year,
		Region:             apiResponse.Region,
		FederalBrackets:    s.transformBracketList(apiResponse.Federal),
		ProvincialBrackets: s.transformBracketList(apiResponse.Regional),
	}
}

// transformBracketList converts a list of API brackets to internal format
func (s *Service) transformBracketList(apiBrackets []APITaxBracket) []TaxBracket {
	brackets := make([]TaxBracket, len(apiBrackets))

	for i, apiBracket := range apiBrackets {
		var upToIncome float64
		if apiBracket.Max == nil {
			// null max means unlimited, represented as 0 in internal format
			upToIncome = 0
		} else {
			upToIncome = *apiBracket.Max
		}

		brackets[i] = TaxBracket{
			UpToIncome: upToIncome,
			Rate:       apiBracket.Rate,
		}
	}

	return brackets
}
