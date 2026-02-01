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
