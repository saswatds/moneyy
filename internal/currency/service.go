// Package currency implements currency exchange rate functionality.
package currency

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"
)

// Service provides currency exchange rate functionality
type Service struct {
	db *sql.DB
}

// NewService creates a new currency service
func NewService(db *sql.DB) *Service {
	return &Service{db: db}
}

// Currency represents supported currencies
type Currency string

const (
	CurrencyCAD Currency = "CAD"
	CurrencyUSD Currency = "USD"
	CurrencyINR Currency = "INR"
)

// ExchangeRate represents an exchange rate between two currencies
type ExchangeRate struct {
	ID           string    `json:"id"`
	FromCurrency Currency  `json:"from_currency"`
	ToCurrency   Currency  `json:"to_currency"`
	Rate         float64   `json:"rate"`
	Date         time.Time `json:"date"`
	CreatedAt    time.Time `json:"created_at"`
}

// LatestRatesResponse represents the response for getting latest rates
type LatestRatesResponse struct {
	Rates map[string]map[string]float64 `json:"rates"`
	Date  time.Time                     `json:"date"`
}

// CBSAResponse represents the response from CBSA API
type CBSAResponse struct {
	ForeignExchangeRates []ForeignExchangeRate `json:"ForeignExchangeRates"`
}

type ForeignExchangeRate struct {
	Rate         string       `json:"Rate"`
	FromCurrency CurrencyCode `json:"FromCurrency"`
	ToCurrency   CurrencyCode `json:"ToCurrency"`
}

type CurrencyCode struct {
	Value string `json:"Value"`
}

// GetLatestRates retrieves the latest exchange rates for all currency pairs
// If no rates exist for today, it will automatically sync from CBSA API
func (s *Service) GetLatestRates(ctx context.Context) (*LatestRatesResponse, error) {
	// Check if we have any rates for today
	today := time.Now().Truncate(24 * time.Hour)
	var todayCount int
	err := s.db.QueryRowContext(ctx, `
		SELECT COUNT(*)
		FROM exchange_rates
		WHERE date = $1
	`, today).Scan(&todayCount)

	// If no rates for today, sync them
	if err == nil && todayCount == 0 {
		_ = s.syncRates(ctx)
	}

	// SQLite compatible: using subquery instead of DISTINCT ON
	rows, err := s.db.QueryContext(ctx, `
		SELECT e1.from_currency, e1.to_currency, e1.rate, e1.date
		FROM exchange_rates e1
		WHERE e1.date = (
			SELECT MAX(e2.date) FROM exchange_rates e2
			WHERE e2.from_currency = e1.from_currency AND e2.to_currency = e1.to_currency
		)
		ORDER BY e1.from_currency, e1.to_currency
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	rates := make(map[string]map[string]float64)
	var latestDate time.Time

	for rows.Next() {
		var fromCurrency, toCurrency string
		var rate float64
		var date time.Time

		if err := rows.Scan(&fromCurrency, &toCurrency, &rate, &date); err != nil {
			continue
		}

		if rates[fromCurrency] == nil {
			rates[fromCurrency] = make(map[string]float64)
		}
		rates[fromCurrency][toCurrency] = rate

		if date.After(latestDate) {
			latestDate = date
		}
	}

	// Add identity rates (1:1 for same currency)
	currencies := []string{"CAD", "USD", "INR"}
	for _, curr := range currencies {
		if rates[curr] == nil {
			rates[curr] = make(map[string]float64)
		}
		rates[curr][curr] = 1.0
	}

	return &LatestRatesResponse{
		Rates: rates,
		Date:  latestDate,
	}, nil
}

// syncRates fetches exchange rates from CBSA API and stores them (internal function)
func (s *Service) syncRates(ctx context.Context) error {
	today := time.Now().Truncate(24 * time.Hour)

	// Check if we already have rates for today
	var existingCount int
	err := s.db.QueryRowContext(ctx, `
		SELECT COUNT(*)
		FROM exchange_rates
		WHERE date = $1
	`, today).Scan(&existingCount)

	if err == nil && existingCount > 0 {
		// Rates already exist for today
		return nil
	}

	// Fetch from CBSA API
	resp, err := http.Get("https://bcd-api-dca-ipa.cbsa-asfc.cloud-nuage.canada.ca/exchange-rate-lambda/exchange-rates")
	if err != nil {
		return fmt.Errorf("failed to fetch rates from CBSA: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("CBSA API returned status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response body: %w", err)
	}

	var cbsaResp CBSAResponse
	if err := json.Unmarshal(body, &cbsaResp); err != nil {
		return fmt.Errorf("failed to parse CBSA response: %w", err)
	}

	// Extract rates for USD and INR (FROM currency TO CAD)
	var usdToCAD, inrToCAD float64
	var hasUSD, hasINR bool

	for _, rate := range cbsaResp.ForeignExchangeRates {
		if rate.ToCurrency.Value != "CAD" {
			continue
		}

		rateValue, parseErr := strconv.ParseFloat(rate.Rate, 64)
		if parseErr != nil {
			continue
		}

		if rate.FromCurrency.Value == "USD" {
			usdToCAD = rateValue
			hasUSD = true
		} else if rate.FromCurrency.Value == "INR" {
			inrToCAD = rateValue
			hasINR = true
		}
	}

	// Store USD <-> CAD
	if hasUSD {
		// USD -> CAD
		_, _ = s.db.ExecContext(ctx, `
			INSERT INTO exchange_rates (from_currency, to_currency, rate, date, created_at)
			VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (from_currency, to_currency, date) DO UPDATE SET rate = excluded.rate
		`, "USD", "CAD", usdToCAD, today, time.Now())

		// CAD -> USD (inverse)
		_, _ = s.db.ExecContext(ctx, `
			INSERT INTO exchange_rates (from_currency, to_currency, rate, date, created_at)
			VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (from_currency, to_currency, date) DO UPDATE SET rate = excluded.rate
		`, "CAD", "USD", 1/usdToCAD, today, time.Now())
	}

	// Store INR <-> CAD
	if hasINR {
		// INR -> CAD
		_, _ = s.db.ExecContext(ctx, `
			INSERT INTO exchange_rates (from_currency, to_currency, rate, date, created_at)
			VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (from_currency, to_currency, date) DO UPDATE SET rate = excluded.rate
		`, "INR", "CAD", inrToCAD, today, time.Now())

		// CAD -> INR (inverse)
		_, _ = s.db.ExecContext(ctx, `
			INSERT INTO exchange_rates (from_currency, to_currency, rate, date, created_at)
			VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (from_currency, to_currency, date) DO UPDATE SET rate = excluded.rate
		`, "CAD", "INR", 1/inrToCAD, today, time.Now())
	}

	// Calculate USD <-> INR cross rates
	if hasUSD && hasINR {
		// USD -> INR: 1 USD = usdToCAD CAD, and inrToCAD INR = 1 CAD
		// So: 1 USD = (usdToCAD / inrToCAD) INR
		usdToINR := usdToCAD / inrToCAD

		// USD -> INR
		_, _ = s.db.ExecContext(ctx, `
			INSERT INTO exchange_rates (from_currency, to_currency, rate, date, created_at)
			VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (from_currency, to_currency, date) DO UPDATE SET rate = excluded.rate
		`, "USD", "INR", usdToINR, today, time.Now())

		// INR -> USD (inverse)
		_, _ = s.db.ExecContext(ctx, `
			INSERT INTO exchange_rates (from_currency, to_currency, rate, date, created_at)
			VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (from_currency, to_currency, date) DO UPDATE SET rate = excluded.rate
		`, "INR", "USD", 1/usdToINR, today, time.Now())
	}

	return nil
}
