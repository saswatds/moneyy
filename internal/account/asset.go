package account

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"time"

	"money/internal/auth"
	"money/internal/balance"
	"github.com/google/uuid"
)

// AssetDetails represents detailed asset information
type AssetDetails struct {
	ID                   string          `json:"id"`
	AccountID            string          `json:"account_id"`
	AssetType            string          `json:"asset_type"` // real_estate, vehicle, collectible, equipment
	PurchasePrice        float64         `json:"purchase_price"`
	PurchaseDate         Date            `json:"purchase_date"`
	DepreciationMethod   string          `json:"depreciation_method"` // straight_line, declining_balance, manual
	UsefulLifeYears      *int            `json:"useful_life_years,omitempty"`
	SalvageValue         float64         `json:"salvage_value"`
	DepreciationRate     *float64        `json:"depreciation_rate,omitempty"`
	TypeSpecificData     json.RawMessage `json:"type_specific_data,omitempty"`
	Notes                string          `json:"notes,omitempty"`
	CreatedAt            time.Time       `json:"created_at"`
	UpdatedAt            time.Time       `json:"updated_at"`
}

// AssetWithCurrentValue represents an asset with its calculated current value
type AssetWithCurrentValue struct {
	AssetDetails
	CurrentValue            float64   `json:"current_value"`
	AccumulatedDepreciation float64   `json:"accumulated_depreciation"`
	AsOfDate                time.Time `json:"as_of_date"`
}

// DepreciationEntry represents a manual depreciation entry
type DepreciationEntry struct {
	ID                      string    `json:"id"`
	AccountID               string    `json:"account_id"`
	EntryDate               Date      `json:"entry_date"`
	CurrentValue            float64   `json:"current_value"`
	AccumulatedDepreciation float64   `json:"accumulated_depreciation"`
	Notes                   string    `json:"notes,omitempty"`
	CreatedAt               time.Time `json:"created_at"`
}

// DepreciationScheduleEntry represents a single entry in the depreciation schedule
type DepreciationScheduleEntry struct {
	Year                    int       `json:"year"`
	Date                    time.Time `json:"date"`
	DepreciationAmount      float64   `json:"depreciation_amount"`
	AccumulatedDepreciation float64   `json:"accumulated_depreciation"`
	BookValue               float64   `json:"book_value"`
}

// CreateAssetDetailsRequest represents the request to create asset details
type CreateAssetDetailsRequest struct {
	AccountID          string          `json:"account_id"`
	AssetType          string          `json:"asset_type"`
	PurchasePrice      float64         `json:"purchase_price"`
	PurchaseDate       Date            `json:"purchase_date"`
	DepreciationMethod string          `json:"depreciation_method"`
	UsefulLifeYears    *int            `json:"useful_life_years,omitempty"`
	SalvageValue       float64         `json:"salvage_value"`
	DepreciationRate   *float64        `json:"depreciation_rate,omitempty"`
	TypeSpecificData   json.RawMessage `json:"type_specific_data,omitempty"`
	Notes              string          `json:"notes,omitempty"`
}

// UpdateAssetDetailsRequest represents the request to update asset details
type UpdateAssetDetailsRequest struct {
	AssetType          string          `json:"asset_type"`
	PurchasePrice      float64         `json:"purchase_price"`
	PurchaseDate       Date            `json:"purchase_date"`
	DepreciationMethod string          `json:"depreciation_method"`
	UsefulLifeYears    *int            `json:"useful_life_years,omitempty"`
	SalvageValue       float64         `json:"salvage_value"`
	DepreciationRate   *float64        `json:"depreciation_rate,omitempty"`
	TypeSpecificData   json.RawMessage `json:"type_specific_data,omitempty"`
	Notes              string          `json:"notes,omitempty"`
}

// CreateDepreciationEntryRequest represents the request to record manual depreciation
type CreateDepreciationEntryRequest struct {
	AccountID   string  `json:"account_id"`
	EntryDate   Date    `json:"entry_date"`
	CurrentValue float64 `json:"current_value"`
	Notes       string  `json:"notes,omitempty"`
}

// AssetsSummaryResponse represents the aggregated assets summary
type AssetsSummaryResponse struct {
	Assets []AssetWithCurrentValue `json:"assets"`
}

// DepreciationEntriesResponse represents the depreciation entries list response
type DepreciationEntriesResponse struct {
	Entries []DepreciationEntry `json:"entries"`
}

// DepreciationScheduleResponse represents the depreciation schedule response
type DepreciationScheduleResponse struct {
	Schedule []DepreciationScheduleEntry `json:"schedule"`
}

// CreateAssetDetails creates asset details for an account
func (s *Service) CreateAssetDetails(ctx context.Context, accountID string, req *CreateAssetDetailsRequest) (*AssetDetails, error) {
	// Verify account ownership
	if err := s.verifyAccountOwnership(ctx, accountID); err != nil {
		return nil, err
	}

	// Validate depreciation method requirements
	if err := validateAssetDetails(req.DepreciationMethod, req.UsefulLifeYears, req.DepreciationRate); err != nil {
		return nil, err
	}

	id := uuid.New().String()
	now := time.Now()

	var details AssetDetails
	err := s.db.QueryRowContext(ctx, `
		INSERT INTO asset_details (
			id, account_id, asset_type, purchase_price, purchase_date,
			depreciation_method, useful_life_years, salvage_value, depreciation_rate,
			type_specific_data, notes, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
		RETURNING id, account_id, asset_type, purchase_price, purchase_date,
			depreciation_method, useful_life_years, salvage_value, depreciation_rate,
			type_specific_data, notes, created_at, updated_at
	`, id, accountID, req.AssetType, req.PurchasePrice, req.PurchaseDate,
		req.DepreciationMethod, req.UsefulLifeYears, req.SalvageValue, req.DepreciationRate,
		req.TypeSpecificData, req.Notes, now, now).Scan(
		&details.ID, &details.AccountID, &details.AssetType, &details.PurchasePrice, &details.PurchaseDate,
		&details.DepreciationMethod, &details.UsefulLifeYears, &details.SalvageValue, &details.DepreciationRate,
		&details.TypeSpecificData, &details.Notes, &details.CreatedAt, &details.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to create asset details: %w", err)
	}

	// Create initial balance entry for the asset
	_, err = s.balanceSvc.Create(ctx, &balance.CreateBalanceRequest{
		AccountID: accountID,
		Amount:    req.PurchasePrice,
		Date:      req.PurchaseDate.Time,
		Notes:     "Asset purchased",
	})
	if err != nil {
		// Log the error but don't fail the asset creation
		fmt.Printf("Warning: failed to create initial balance entry: %v\n", err)
	}

	return &details, nil
}

// GetAssetDetails retrieves asset details for an account
func (s *Service) GetAssetDetails(ctx context.Context, accountID string) (*AssetDetails, error) {
	userID := auth.GetUserID(ctx)
	if userID == "" {
		return nil, fmt.Errorf("user not authenticated")
	}

	var details AssetDetails

	err := s.db.QueryRowContext(ctx, `
		SELECT ad.id, ad.account_id, ad.asset_type, ad.purchase_price, ad.purchase_date,
			ad.depreciation_method, ad.useful_life_years, ad.salvage_value, ad.depreciation_rate,
			ad.type_specific_data, ad.notes, ad.created_at, ad.updated_at
		FROM asset_details ad
		JOIN accounts a ON ad.account_id = a.id
		WHERE ad.account_id = $1 AND a.user_id = $2
	`, accountID, userID).Scan(
		&details.ID, &details.AccountID, &details.AssetType, &details.PurchasePrice, &details.PurchaseDate,
		&details.DepreciationMethod, &details.UsefulLifeYears, &details.SalvageValue, &details.DepreciationRate,
		&details.TypeSpecificData, &details.Notes, &details.CreatedAt, &details.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to get asset details: %w", err)
	}

	return &details, nil
}

// UpdateAssetDetails updates asset details for an account
func (s *Service) UpdateAssetDetails(ctx context.Context, accountID string, req *UpdateAssetDetailsRequest) (*AssetDetails, error) {
	// Verify account ownership
	if err := s.verifyAccountOwnership(ctx, accountID); err != nil {
		return nil, err
	}

	// Validate depreciation method requirements
	if err := validateAssetDetails(req.DepreciationMethod, req.UsefulLifeYears, req.DepreciationRate); err != nil {
		return nil, err
	}

	now := time.Now()

	var details AssetDetails
	err := s.db.QueryRowContext(ctx, `
		UPDATE asset_details
		SET asset_type = $2, purchase_price = $3, purchase_date = $4,
			depreciation_method = $5, useful_life_years = $6, salvage_value = $7,
			depreciation_rate = $8, type_specific_data = $9, notes = $10, updated_at = $11
		WHERE account_id = $1
		RETURNING id, account_id, asset_type, purchase_price, purchase_date,
			depreciation_method, useful_life_years, salvage_value, depreciation_rate,
			type_specific_data, notes, created_at, updated_at
	`, accountID, req.AssetType, req.PurchasePrice, req.PurchaseDate,
		req.DepreciationMethod, req.UsefulLifeYears, req.SalvageValue,
		req.DepreciationRate, req.TypeSpecificData, req.Notes, now).Scan(
		&details.ID, &details.AccountID, &details.AssetType, &details.PurchasePrice, &details.PurchaseDate,
		&details.DepreciationMethod, &details.UsefulLifeYears, &details.SalvageValue, &details.DepreciationRate,
		&details.TypeSpecificData, &details.Notes, &details.CreatedAt, &details.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to update asset details: %w", err)
	}

	return &details, nil
}

// GetAssetValuation retrieves asset details with calculated current value
func (s *Service) GetAssetValuation(ctx context.Context, accountID string) (*AssetWithCurrentValue, error) {
	details, err := s.GetAssetDetails(ctx, accountID)
	if err != nil {
		return nil, err
	}

	asOfDate := time.Now()
	currentValue, accumulatedDepreciation, err := s.calculateCurrentValue(ctx, details, asOfDate)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate current value: %w", err)
	}

	return &AssetWithCurrentValue{
		AssetDetails:            *details,
		CurrentValue:            currentValue,
		AccumulatedDepreciation: accumulatedDepreciation,
		AsOfDate:                asOfDate,
	}, nil
}

// GetAssetsSummary retrieves all assets with calculated current values
func (s *Service) GetAssetsSummary(ctx context.Context) (*AssetsSummaryResponse, error) {
	userID := auth.GetUserID(ctx)
	if userID == "" {
		return nil, fmt.Errorf("user not authenticated")
	}

	rows, err := s.db.QueryContext(ctx, `
		SELECT ad.id, ad.account_id, ad.asset_type, ad.purchase_price, ad.purchase_date,
			ad.depreciation_method, ad.useful_life_years, ad.salvage_value, ad.depreciation_rate,
			ad.type_specific_data, ad.notes, ad.created_at, ad.updated_at
		FROM asset_details ad
		JOIN accounts a ON ad.account_id = a.id
		WHERE a.user_id = $1
		ORDER BY ad.created_at DESC
	`, userID)

	if err != nil {
		return nil, fmt.Errorf("failed to get assets: %w", err)
	}
	defer rows.Close()

	assets := make([]AssetWithCurrentValue, 0)
	asOfDate := time.Now()

	for rows.Next() {
		var details AssetDetails
		err := rows.Scan(
			&details.ID, &details.AccountID, &details.AssetType, &details.PurchasePrice, &details.PurchaseDate,
			&details.DepreciationMethod, &details.UsefulLifeYears, &details.SalvageValue, &details.DepreciationRate,
			&details.TypeSpecificData, &details.Notes, &details.CreatedAt, &details.UpdatedAt,
		)
		if err != nil {
			continue
		}

		currentValue, accumulatedDepreciation, err := s.calculateCurrentValue(ctx, &details, asOfDate)
		if err != nil {
			// Log error but continue with other assets
			fmt.Printf("Warning: failed to calculate value for asset %s: %v\n", details.ID, err)
			currentValue = details.PurchasePrice
			accumulatedDepreciation = 0
		}

		assets = append(assets, AssetWithCurrentValue{
			AssetDetails:            details,
			CurrentValue:            currentValue,
			AccumulatedDepreciation: accumulatedDepreciation,
			AsOfDate:                asOfDate,
		})
	}

	return &AssetsSummaryResponse{
		Assets: assets,
	}, nil
}

// RecordDepreciation records a manual depreciation entry
func (s *Service) RecordDepreciation(ctx context.Context, accountID string, req *CreateDepreciationEntryRequest) (*DepreciationEntry, error) {
	// Get asset details to validate it exists
	details, err := s.GetAssetDetails(ctx, accountID)
	if err != nil {
		return nil, err
	}

	// Ensure the asset uses manual depreciation
	if details.DepreciationMethod != "manual" {
		return nil, fmt.Errorf("depreciation entries can only be recorded for assets with manual depreciation method")
	}

	// Calculate accumulated depreciation
	accumulatedDepreciation := details.PurchasePrice - req.CurrentValue

	id := uuid.New().String()
	now := time.Now()

	var entry DepreciationEntry
	err = s.db.QueryRowContext(ctx, `
		INSERT INTO asset_depreciation_entries (
			id, account_id, entry_date, current_value, accumulated_depreciation, notes, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, account_id, entry_date, current_value, accumulated_depreciation, notes, created_at
	`, id, accountID, req.EntryDate, req.CurrentValue, accumulatedDepreciation, req.Notes, now).Scan(
		&entry.ID, &entry.AccountID, &entry.EntryDate, &entry.CurrentValue,
		&entry.AccumulatedDepreciation, &entry.Notes, &entry.CreatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to record depreciation: %w", err)
	}

	return &entry, nil
}

// GetDepreciationHistory retrieves all depreciation entries for an asset
func (s *Service) GetDepreciationHistory(ctx context.Context, accountID string) (*DepreciationEntriesResponse, error) {
	// Verify account ownership
	if err := s.verifyAccountOwnership(ctx, accountID); err != nil {
		return nil, err
	}

	rows, err := s.db.QueryContext(ctx, `
		SELECT id, account_id, entry_date, current_value, accumulated_depreciation, notes, created_at
		FROM asset_depreciation_entries
		WHERE account_id = $1
		ORDER BY entry_date DESC
	`, accountID)

	if err != nil {
		return nil, fmt.Errorf("failed to get depreciation history: %w", err)
	}
	defer rows.Close()

	entries := make([]DepreciationEntry, 0)
	for rows.Next() {
		var entry DepreciationEntry
		err := rows.Scan(
			&entry.ID, &entry.AccountID, &entry.EntryDate, &entry.CurrentValue,
			&entry.AccumulatedDepreciation, &entry.Notes, &entry.CreatedAt,
		)
		if err != nil {
			continue
		}
		entries = append(entries, entry)
	}

	return &DepreciationEntriesResponse{
		Entries: entries,
	}, nil
}

// GetDepreciationSchedule generates the projected depreciation schedule
func (s *Service) GetDepreciationSchedule(ctx context.Context, accountID string) (*DepreciationScheduleResponse, error) {
	details, err := s.GetAssetDetails(ctx, accountID)
	if err != nil {
		return nil, err
	}

	// Manual depreciation doesn't have a projected schedule
	if details.DepreciationMethod == "manual" {
		return nil, fmt.Errorf("depreciation schedule not available for manual depreciation method")
	}

	schedule, err := calculateDepreciationSchedule(details)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate depreciation schedule: %w", err)
	}

	return &DepreciationScheduleResponse{
		Schedule: schedule,
	}, nil
}

// SyncAssetBalance syncs the asset's current value to the balance service
func (s *Service) SyncAssetBalance(ctx context.Context, accountID string) error {
	details, err := s.GetAssetDetails(ctx, accountID)
	if err != nil {
		return fmt.Errorf("failed to get asset details: %w", err)
	}

	asOfDate := time.Now()
	currentValue, _, err := s.calculateCurrentValue(ctx, details, asOfDate)
	if err != nil {
		return fmt.Errorf("failed to calculate current value: %w", err)
	}

	// Create a balance entry with the current value
	_, err = s.balanceSvc.Create(ctx, &balance.CreateBalanceRequest{
		AccountID: accountID,
		Amount:    currentValue,
		Date:      asOfDate,
		Notes:     "Asset value sync",
	})

	if err != nil {
		return fmt.Errorf("failed to sync balance: %w", err)
	}

	return nil
}

// Helper functions for depreciation calculations

// calculateCurrentValue calculates the current value and accumulated depreciation of an asset
func (s *Service) calculateCurrentValue(ctx context.Context, asset *AssetDetails, asOfDate time.Time) (currentValue, accumulatedDepreciation float64, err error) {
	switch asset.DepreciationMethod {
	case "straight_line":
		return calculateStraightLine(asset, asOfDate)
	case "declining_balance":
		return calculateDecliningBalance(asset, asOfDate)
	case "manual":
		return s.getLatestManualValue(ctx, asset.AccountID, asOfDate)
	default:
		return 0, 0, fmt.Errorf("unknown depreciation method: %s", asset.DepreciationMethod)
	}
}

// calculateStraightLine calculates depreciation using the straight-line method
func calculateStraightLine(asset *AssetDetails, asOfDate time.Time) (float64, float64, error) {
	if asset.UsefulLifeYears == nil || *asset.UsefulLifeYears <= 0 {
		return 0, 0, fmt.Errorf("useful_life_years is required for straight-line depreciation")
	}

	// Calculate years elapsed
	yearsElapsed := asOfDate.Sub(asset.PurchaseDate.Time).Hours() / 24 / 365.25

	// Annual depreciation = (Purchase Price - Salvage Value) / Useful Life
	annualDepreciation := (asset.PurchasePrice - asset.SalvageValue) / float64(*asset.UsefulLifeYears)

	// Accumulated depreciation
	accumulatedDepreciation := annualDepreciation * yearsElapsed

	// Cap at maximum depreciation
	maxDepreciation := asset.PurchasePrice - asset.SalvageValue
	if accumulatedDepreciation > maxDepreciation {
		accumulatedDepreciation = maxDepreciation
	}

	// Current value = Purchase Price - Accumulated Depreciation
	currentValue := asset.PurchasePrice - accumulatedDepreciation

	// Ensure value doesn't go below salvage value
	if currentValue < asset.SalvageValue {
		currentValue = asset.SalvageValue
	}

	return currentValue, accumulatedDepreciation, nil
}

// calculateDecliningBalance calculates depreciation using the declining balance method
func calculateDecliningBalance(asset *AssetDetails, asOfDate time.Time) (float64, float64, error) {
	if asset.DepreciationRate == nil || *asset.DepreciationRate <= 0 {
		return 0, 0, fmt.Errorf("depreciation_rate is required for declining balance method")
	}

	// Calculate years elapsed
	yearsElapsed := asOfDate.Sub(asset.PurchaseDate.Time).Hours() / 24 / 365.25

	// Current Value = Purchase Price × (1 - rate)^years
	currentValue := asset.PurchasePrice * math.Pow(1-*asset.DepreciationRate, yearsElapsed)

	// Ensure value doesn't go below salvage value
	if currentValue < asset.SalvageValue {
		currentValue = asset.SalvageValue
	}

	// Accumulated depreciation = Purchase Price - Current Value
	accumulatedDepreciation := asset.PurchasePrice - currentValue

	return currentValue, accumulatedDepreciation, nil
}

// getLatestManualValue retrieves the latest manual depreciation entry
func (s *Service) getLatestManualValue(ctx context.Context, accountID string, asOfDate time.Time) (float64, float64, error) {
	var currentValue, accumulatedDepreciation float64

	err := s.db.QueryRowContext(ctx, `
		SELECT current_value, accumulated_depreciation
		FROM asset_depreciation_entries
		WHERE account_id = $1 AND entry_date <= $2
		ORDER BY entry_date DESC
		LIMIT 1
	`, accountID, asOfDate).Scan(&currentValue, &accumulatedDepreciation)

	if err != nil {
		// Check if no rows found using errors.Is for wrapped errors
		if errors.Is(err, sql.ErrNoRows) {
			// No manual entries yet, return purchase price
			var purchasePrice float64
			err = s.db.QueryRowContext(ctx, `
				SELECT purchase_price
				FROM asset_details
				WHERE account_id = $1
			`, accountID).Scan(&purchasePrice)
			if err != nil {
				return 0, 0, fmt.Errorf("failed to get purchase price: %w", err)
			}
			return purchasePrice, 0, nil
		}
		return 0, 0, fmt.Errorf("failed to get latest manual value: %w", err)
	}

	return currentValue, accumulatedDepreciation, nil
}

// calculateDepreciationSchedule generates the depreciation schedule
func calculateDepreciationSchedule(asset *AssetDetails) ([]DepreciationScheduleEntry, error) {
	switch asset.DepreciationMethod {
	case "straight_line":
		return calculateStraightLineSchedule(asset)
	case "declining_balance":
		return calculateDecliningBalanceSchedule(asset)
	default:
		return nil, fmt.Errorf("depreciation schedule not available for method: %s", asset.DepreciationMethod)
	}
}

// calculateStraightLineSchedule generates schedule for straight-line depreciation
func calculateStraightLineSchedule(asset *AssetDetails) ([]DepreciationScheduleEntry, error) {
	if asset.UsefulLifeYears == nil || *asset.UsefulLifeYears <= 0 {
		return nil, fmt.Errorf("useful_life_years is required for straight-line depreciation")
	}

	schedule := make([]DepreciationScheduleEntry, 0)
	annualDepreciation := (asset.PurchasePrice - asset.SalvageValue) / float64(*asset.UsefulLifeYears)
	accumulatedDepreciation := 0.0
	bookValue := asset.PurchasePrice

	for year := 1; year <= *asset.UsefulLifeYears; year++ {
		depreciationAmount := annualDepreciation

		// Last year adjustment
		if year == *asset.UsefulLifeYears {
			depreciationAmount = bookValue - asset.SalvageValue
		}

		accumulatedDepreciation += depreciationAmount
		bookValue -= depreciationAmount

		entry := DepreciationScheduleEntry{
			Year:                    year,
			Date:                    asset.PurchaseDate.Time.AddDate(year, 0, 0),
			DepreciationAmount:      depreciationAmount,
			AccumulatedDepreciation: accumulatedDepreciation,
			BookValue:               bookValue,
		}

		schedule = append(schedule, entry)
	}

	return schedule, nil
}

// calculateDecliningBalanceSchedule generates schedule for declining balance depreciation
func calculateDecliningBalanceSchedule(asset *AssetDetails) ([]DepreciationScheduleEntry, error) {
	if asset.DepreciationRate == nil || *asset.DepreciationRate <= 0 {
		return nil, fmt.Errorf("depreciation_rate is required for declining balance method")
	}

	schedule := make([]DepreciationScheduleEntry, 0)
	bookValue := asset.PurchasePrice
	accumulatedDepreciation := 0.0

	// Calculate for a reasonable number of years (until book value reaches salvage value)
	maxYears := 50 // Safety limit
	for year := 1; year <= maxYears && bookValue > asset.SalvageValue; year++ {
		depreciationAmount := bookValue * *asset.DepreciationRate

		// Don't depreciate below salvage value
		if bookValue-depreciationAmount < asset.SalvageValue {
			depreciationAmount = bookValue - asset.SalvageValue
		}

		accumulatedDepreciation += depreciationAmount
		bookValue -= depreciationAmount

		entry := DepreciationScheduleEntry{
			Year:                    year,
			Date:                    asset.PurchaseDate.Time.AddDate(year, 0, 0),
			DepreciationAmount:      depreciationAmount,
			AccumulatedDepreciation: accumulatedDepreciation,
			BookValue:               bookValue,
		}

		schedule = append(schedule, entry)

		// Stop if we've reached salvage value
		if bookValue <= asset.SalvageValue {
			break
		}
	}

	return schedule, nil
}

// validateAssetDetails validates that required fields are present based on depreciation method
func validateAssetDetails(method string, usefulLifeYears *int, depreciationRate *float64) error {
	switch method {
	case "straight_line":
		if usefulLifeYears == nil || *usefulLifeYears <= 0 {
			return fmt.Errorf("useful_life_years is required for straight-line depreciation")
		}
	case "declining_balance":
		if depreciationRate == nil || *depreciationRate <= 0 || *depreciationRate >= 1 {
			return fmt.Errorf("depreciation_rate is required and must be between 0 and 1 for declining balance method")
		}
	case "manual":
		// No additional validation needed
	default:
		return fmt.Errorf("invalid depreciation method: %s (must be straight_line, declining_balance, or manual)", method)
	}
	return nil
}
