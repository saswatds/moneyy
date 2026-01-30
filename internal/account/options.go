package account

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"money/internal/auth"

	"github.com/google/uuid"
)

// GrantType represents the type of equity grant
type GrantType string

const (
	GrantTypeISO GrantType = "iso"
	GrantTypeNSO GrantType = "nso"
	GrantTypeRSU GrantType = "rsu"
	GrantTypeRSA GrantType = "rsa"
)

// VestingStatus represents the status of a vesting event
type VestingStatus string

const (
	VestingStatusPending   VestingStatus = "pending"
	VestingStatusVested    VestingStatus = "vested"
	VestingStatusForfeited VestingStatus = "forfeited"
)

// ExerciseMethod represents how options were exercised
type ExerciseMethod string

const (
	ExerciseMethodCash        ExerciseMethod = "cash"
	ExerciseMethodCashless    ExerciseMethod = "cashless"
	ExerciseMethodSameDaySale ExerciseMethod = "same_day_sale"
)

// EquityGrant represents an individual equity grant
type EquityGrant struct {
	ID             string     `json:"id"`
	AccountID      string     `json:"account_id"`
	GrantType      GrantType  `json:"grant_type"`
	GrantDate      Date       `json:"grant_date"`
	Quantity       int        `json:"quantity"`
	StrikePrice    *float64   `json:"strike_price,omitempty"`
	FMVAtGrant     float64    `json:"fmv_at_grant"`
	ExpirationDate *Date      `json:"expiration_date,omitempty"`
	CompanyName    string     `json:"company_name"`
	Currency       string     `json:"currency"`
	GrantNumber    *string    `json:"grant_number,omitempty"`
	Notes          *string    `json:"notes,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

// EquityGrantWithSummary includes vesting progress and value information
type EquityGrantWithSummary struct {
	EquityGrant
	VestedQuantity   int      `json:"vested_quantity"`
	UnvestedQuantity int      `json:"unvested_quantity"`
	ExercisedQuantity int     `json:"exercised_quantity"`
	CurrentFMV       *float64 `json:"current_fmv,omitempty"`
	VestedValue      float64  `json:"vested_value"`
	UnvestedValue    float64  `json:"unvested_value"`
	IntrinsicValue   float64  `json:"intrinsic_value"` // For options: (FMV - Strike) * vested qty
}

// VestingSchedule represents the vesting rules for a grant
type VestingSchedule struct {
	ID                   string    `json:"id"`
	GrantID              string    `json:"grant_id"`
	ScheduleType         string    `json:"schedule_type"` // time_based, milestone
	CliffMonths          *int      `json:"cliff_months,omitempty"`
	TotalVestingMonths   *int      `json:"total_vesting_months,omitempty"`
	VestingFrequency     *string   `json:"vesting_frequency,omitempty"` // monthly, quarterly, annually
	MilestoneDescription *string   `json:"milestone_description,omitempty"`
	CreatedAt            time.Time `json:"created_at"`
}

// VestingEvent represents an actual vesting occurrence
type VestingEvent struct {
	ID        string        `json:"id"`
	GrantID   string        `json:"grant_id"`
	VestDate  Date          `json:"vest_date"`
	Quantity  int           `json:"quantity"`
	FMVAtVest float64       `json:"fmv_at_vest"`
	Status    VestingStatus `json:"status"`
	Notes     *string       `json:"notes,omitempty"`
	CreatedAt time.Time     `json:"created_at"`
}

// EquityExercise represents an exercise of options
type EquityExercise struct {
	ID             string          `json:"id"`
	GrantID        string          `json:"grant_id"`
	ExerciseDate   Date            `json:"exercise_date"`
	Quantity       int             `json:"quantity"`
	StrikePrice    float64         `json:"strike_price"`
	FMVAtExercise  float64         `json:"fmv_at_exercise"`
	ExerciseCost   float64         `json:"exercise_cost"`   // quantity * strike_price
	TaxableBenefit float64         `json:"taxable_benefit"` // quantity * (fmv - strike)
	ExerciseMethod *ExerciseMethod `json:"exercise_method,omitempty"`
	Notes          *string         `json:"notes,omitempty"`
	CreatedAt      time.Time       `json:"created_at"`
}

// EquitySale represents a sale of shares
type EquitySale struct {
	ID                string    `json:"id"`
	AccountID         string    `json:"account_id"`
	GrantID           *string   `json:"grant_id,omitempty"`
	ExerciseID        *string   `json:"exercise_id,omitempty"`
	SaleDate          Date      `json:"sale_date"`
	Quantity          int       `json:"quantity"`
	SalePrice         float64   `json:"sale_price"`
	TotalProceeds     float64   `json:"total_proceeds"`
	CostBasis         float64   `json:"cost_basis"`
	CapitalGain       float64   `json:"capital_gain"`
	HoldingPeriodDays *int      `json:"holding_period_days,omitempty"`
	IsQualified       *bool     `json:"is_qualified,omitempty"` // Canadian stock option deduction eligibility
	Notes             *string   `json:"notes,omitempty"`
	CreatedAt         time.Time `json:"created_at"`
}

// FMVEntry represents a manual FMV entry
type FMVEntry struct {
	ID            string    `json:"id"`
	AccountID     string    `json:"account_id"`
	Currency      string    `json:"currency"`
	EffectiveDate Date      `json:"effective_date"`
	FMVPerShare   float64   `json:"fmv_per_share"`
	Notes         *string   `json:"notes,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
}

// CurrencySummary holds value summaries for a specific currency
type CurrencySummary struct {
	Currency          string   `json:"currency"`
	VestedValue       float64  `json:"vested_value"`
	UnvestedValue     float64  `json:"unvested_value"`
	TotalIntrinsicValue float64 `json:"total_intrinsic_value"`
	CurrentFMV        *float64 `json:"current_fmv,omitempty"`
	VestedShares      int      `json:"vested_shares"`
	UnvestedShares    int      `json:"unvested_shares"`
}

// OptionsSummary provides a high-level overview of the options account
type OptionsSummary struct {
	TotalGrants       int                `json:"total_grants"`
	TotalShares       int                `json:"total_shares"`
	VestedShares      int                `json:"vested_shares"`
	UnvestedShares    int                `json:"unvested_shares"`
	ExercisedShares   int                `json:"exercised_shares"`
	SoldShares        int                `json:"sold_shares"`
	CurrentFMV        *float64           `json:"current_fmv,omitempty"`
	VestedValue       float64            `json:"vested_value"`
	UnvestedValue     float64            `json:"unvested_value"`
	TotalIntrinsicValue float64          `json:"total_intrinsic_value"`
	ByGrantType       map[string]int     `json:"by_grant_type"`
	ByCurrency        map[string]*CurrencySummary `json:"by_currency"`
	Grants            []EquityGrantWithSummary `json:"grants"`
}

// CurrencyTaxData holds tax data for a specific currency
type CurrencyTaxData struct {
	Currency              string  `json:"currency"`
	TotalTaxableBenefit   float64 `json:"total_taxable_benefit"`
	TotalCapitalGains     float64 `json:"total_capital_gains"`
	StockOptionDeduction  float64 `json:"stock_option_deduction"`
	QualifiedGains        float64 `json:"qualified_gains"`
	NonQualifiedGains     float64 `json:"non_qualified_gains"`
	EstimatedTax          float64 `json:"estimated_tax"`
}

// TaxSummary provides tax planning information for a specific year
type TaxSummary struct {
	Year                  int                        `json:"year"`
	TotalTaxableBenefit   float64                    `json:"total_taxable_benefit"`   // From exercises (aggregated)
	TotalCapitalGains     float64                    `json:"total_capital_gains"`     // From sales (aggregated)
	StockOptionDeduction  float64                    `json:"stock_option_deduction"`  // 50% of eligible benefit
	QualifiedGains        float64                    `json:"qualified_gains"`         // Gains eligible for deduction
	NonQualifiedGains     float64                    `json:"non_qualified_gains"`
	EstimatedTax          float64                    `json:"estimated_tax"`           // Rough estimate
	ByCurrency            map[string]*CurrencyTaxData `json:"by_currency"`            // Per-currency breakdown
}

// Request/Response types

// CreateEquityGrantRequest represents the request to create a grant
type CreateEquityGrantRequest struct {
	AccountID      string    `json:"account_id"`
	GrantType      GrantType `json:"grant_type"`
	GrantDate      Date      `json:"grant_date"`
	Quantity       int       `json:"quantity"`
	StrikePrice    *float64  `json:"strike_price,omitempty"`
	FMVAtGrant     float64   `json:"fmv_at_grant"`
	ExpirationDate *Date     `json:"expiration_date,omitempty"`
	CompanyName    string    `json:"company_name"`
	Currency       string    `json:"currency"`
	GrantNumber    *string   `json:"grant_number,omitempty"`
	Notes          *string   `json:"notes,omitempty"`
}

// UpdateEquityGrantRequest represents the request to update a grant
type UpdateEquityGrantRequest struct {
	GrantType      *GrantType `json:"grant_type,omitempty"`
	GrantDate      *Date      `json:"grant_date,omitempty"`
	Quantity       *int       `json:"quantity,omitempty"`
	StrikePrice    *float64   `json:"strike_price,omitempty"`
	FMVAtGrant     *float64   `json:"fmv_at_grant,omitempty"`
	ExpirationDate *Date      `json:"expiration_date,omitempty"`
	CompanyName    *string    `json:"company_name,omitempty"`
	Currency       *string    `json:"currency,omitempty"`
	GrantNumber    *string    `json:"grant_number,omitempty"`
	Notes          *string    `json:"notes,omitempty"`
}

// SetVestingScheduleRequest represents the request to set a vesting schedule
type SetVestingScheduleRequest struct {
	GrantID              string  `json:"grant_id"`
	ScheduleType         string  `json:"schedule_type"`
	CliffMonths          *int    `json:"cliff_months,omitempty"`
	TotalVestingMonths   *int    `json:"total_vesting_months,omitempty"`
	VestingFrequency     *string `json:"vesting_frequency,omitempty"`
	MilestoneDescription *string `json:"milestone_description,omitempty"`
}

// RecordExerciseRequest represents the request to record an exercise
type RecordExerciseRequest struct {
	GrantID        string          `json:"grant_id"`
	ExerciseDate   Date            `json:"exercise_date"`
	Quantity       int             `json:"quantity"`
	FMVAtExercise  float64         `json:"fmv_at_exercise"`
	ExerciseMethod *ExerciseMethod `json:"exercise_method,omitempty"`
	Notes          *string         `json:"notes,omitempty"`
}

// UpdateExerciseRequest represents the request to update an exercise
type UpdateExerciseRequest struct {
	ExerciseDate   *Date           `json:"exercise_date,omitempty"`
	Quantity       *int            `json:"quantity,omitempty"`
	FMVAtExercise  *float64        `json:"fmv_at_exercise,omitempty"`
	ExerciseMethod *ExerciseMethod `json:"exercise_method,omitempty"`
	Notes          *string         `json:"notes,omitempty"`
}

// RecordSaleRequest represents the request to record a sale
type RecordSaleRequest struct {
	AccountID  string   `json:"account_id"`
	GrantID    *string  `json:"grant_id,omitempty"`
	ExerciseID *string  `json:"exercise_id,omitempty"`
	SaleDate   Date     `json:"sale_date"`
	Quantity   int      `json:"quantity"`
	SalePrice  float64  `json:"sale_price"`
	CostBasis  float64  `json:"cost_basis"`
	Notes      *string  `json:"notes,omitempty"`
}

// UpdateSaleRequest represents the request to update a sale
type UpdateSaleRequest struct {
	SaleDate  *Date    `json:"sale_date,omitempty"`
	Quantity  *int     `json:"quantity,omitempty"`
	SalePrice *float64 `json:"sale_price,omitempty"`
	CostBasis *float64 `json:"cost_basis,omitempty"`
	Notes     *string  `json:"notes,omitempty"`
}

// RecordFMVRequest represents the request to record an FMV entry
type RecordFMVRequest struct {
	AccountID     string  `json:"account_id"`
	Currency      string  `json:"currency"`
	EffectiveDate Date    `json:"effective_date"`
	FMVPerShare   float64 `json:"fmv_per_share"`
	Notes         *string `json:"notes,omitempty"`
}

// UpdateVestingEventRequest represents the request to update a vesting event
type UpdateVestingEventRequest struct {
	Status    *VestingStatus `json:"status,omitempty"`
	FMVAtVest *float64       `json:"fmv_at_vest,omitempty"`
	Notes     *string        `json:"notes,omitempty"`
}

// Response types

// EquityGrantsResponse represents a list of grants
type EquityGrantsResponse struct {
	Grants []EquityGrant `json:"grants"`
}

// VestingEventsResponse represents a list of vesting events
type VestingEventsResponse struct {
	Events []VestingEvent `json:"events"`
}

// ExercisesResponse represents a list of exercises
type ExercisesResponse struct {
	Exercises []EquityExercise `json:"exercises"`
}

// SalesResponse represents a list of sales
type SalesResponse struct {
	Sales []EquitySale `json:"sales"`
}

// FMVHistoryResponse represents a list of FMV entries
type FMVHistoryResponse struct {
	Entries []FMVEntry `json:"entries"`
}

// Grant CRUD Operations

// CreateEquityGrant creates a new equity grant
func (s *Service) CreateEquityGrant(ctx context.Context, accountID string, req *CreateEquityGrantRequest) (*EquityGrant, error) {
	if err := s.verifyAccountOwnership(ctx, accountID); err != nil {
		return nil, err
	}

	// Validate grant type specific requirements
	if req.GrantType == GrantTypeISO || req.GrantType == GrantTypeNSO {
		if req.StrikePrice == nil {
			return nil, fmt.Errorf("strike_price is required for ISO/NSO grants")
		}
	}

	id := uuid.New().String()
	now := time.Now()

	// Default currency to USD if not specified
	currency := req.Currency
	if currency == "" {
		currency = "USD"
	}

	var grant EquityGrant
	err := s.db.QueryRowContext(ctx, `
		INSERT INTO equity_grants (
			id, account_id, grant_type, grant_date, quantity, strike_price,
			fmv_at_grant, expiration_date, company_name, currency, grant_number, notes,
			created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
		RETURNING id, account_id, grant_type, grant_date, quantity, strike_price,
			fmv_at_grant, expiration_date, company_name, currency, grant_number, notes,
			created_at, updated_at
	`, id, accountID, req.GrantType, req.GrantDate, req.Quantity, req.StrikePrice,
		req.FMVAtGrant, req.ExpirationDate, req.CompanyName, currency, req.GrantNumber, req.Notes,
		now, now).Scan(
		&grant.ID, &grant.AccountID, &grant.GrantType, &grant.GrantDate, &grant.Quantity,
		&grant.StrikePrice, &grant.FMVAtGrant, &grant.ExpirationDate, &grant.CompanyName,
		&grant.Currency, &grant.GrantNumber, &grant.Notes, &grant.CreatedAt, &grant.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to create equity grant: %w", err)
	}

	return &grant, nil
}

// GetEquityGrants retrieves all grants for an account
func (s *Service) GetEquityGrants(ctx context.Context, accountID string) (*EquityGrantsResponse, error) {
	if err := s.verifyAccountOwnership(ctx, accountID); err != nil {
		return nil, err
	}

	rows, err := s.db.QueryContext(ctx, `
		SELECT id, account_id, grant_type, grant_date, quantity, strike_price,
			fmv_at_grant, expiration_date, company_name, currency, grant_number, notes,
			created_at, updated_at
		FROM equity_grants
		WHERE account_id = $1
		ORDER BY grant_date DESC
	`, accountID)

	if err != nil {
		return nil, fmt.Errorf("failed to get equity grants: %w", err)
	}
	defer rows.Close()

	grants := make([]EquityGrant, 0)
	for rows.Next() {
		var grant EquityGrant
		err := rows.Scan(
			&grant.ID, &grant.AccountID, &grant.GrantType, &grant.GrantDate, &grant.Quantity,
			&grant.StrikePrice, &grant.FMVAtGrant, &grant.ExpirationDate, &grant.CompanyName,
			&grant.Currency, &grant.GrantNumber, &grant.Notes, &grant.CreatedAt, &grant.UpdatedAt,
		)
		if err != nil {
			continue
		}
		grants = append(grants, grant)
	}

	return &EquityGrantsResponse{Grants: grants}, nil
}

// GetEquityGrant retrieves a single grant by ID
func (s *Service) GetEquityGrant(ctx context.Context, grantID string) (*EquityGrant, error) {
	userID := auth.GetUserID(ctx)
	if userID == "" {
		return nil, fmt.Errorf("user not authenticated")
	}

	var grant EquityGrant
	err := s.db.QueryRowContext(ctx, `
		SELECT eg.id, eg.account_id, eg.grant_type, eg.grant_date, eg.quantity, eg.strike_price,
			eg.fmv_at_grant, eg.expiration_date, eg.company_name, eg.currency, eg.grant_number, eg.notes,
			eg.created_at, eg.updated_at
		FROM equity_grants eg
		JOIN accounts a ON eg.account_id = a.id
		WHERE eg.id = $1 AND a.user_id = $2
	`, grantID, userID).Scan(
		&grant.ID, &grant.AccountID, &grant.GrantType, &grant.GrantDate, &grant.Quantity,
		&grant.StrikePrice, &grant.FMVAtGrant, &grant.ExpirationDate, &grant.CompanyName,
		&grant.Currency,
		&grant.GrantNumber, &grant.Notes, &grant.CreatedAt, &grant.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to get equity grant: %w", err)
	}

	return &grant, nil
}

// UpdateEquityGrant updates an existing grant
func (s *Service) UpdateEquityGrant(ctx context.Context, grantID string, req *UpdateEquityGrantRequest) (*EquityGrant, error) {
	// Get current grant to verify ownership
	grant, err := s.GetEquityGrant(ctx, grantID)
	if err != nil {
		return nil, err
	}

	// Update fields that are provided
	if req.GrantType != nil {
		grant.GrantType = *req.GrantType
	}
	if req.GrantDate != nil {
		grant.GrantDate = *req.GrantDate
	}
	if req.Quantity != nil {
		grant.Quantity = *req.Quantity
	}
	if req.StrikePrice != nil {
		grant.StrikePrice = req.StrikePrice
	}
	if req.FMVAtGrant != nil {
		grant.FMVAtGrant = *req.FMVAtGrant
	}
	if req.ExpirationDate != nil {
		grant.ExpirationDate = req.ExpirationDate
	}
	if req.CompanyName != nil {
		grant.CompanyName = *req.CompanyName
	}
	if req.Currency != nil {
		grant.Currency = *req.Currency
	}
	if req.GrantNumber != nil {
		grant.GrantNumber = req.GrantNumber
	}
	if req.Notes != nil {
		grant.Notes = req.Notes
	}

	now := time.Now()
	_, err = s.db.ExecContext(ctx, `
		UPDATE equity_grants
		SET grant_type = $2, grant_date = $3, quantity = $4, strike_price = $5,
			fmv_at_grant = $6, expiration_date = $7, company_name = $8, currency = $9,
			grant_number = $10, notes = $11, updated_at = $12
		WHERE id = $1
	`, grantID, grant.GrantType, grant.GrantDate, grant.Quantity, grant.StrikePrice,
		grant.FMVAtGrant, grant.ExpirationDate, grant.CompanyName, grant.Currency,
		grant.GrantNumber, grant.Notes, now)

	if err != nil {
		return nil, fmt.Errorf("failed to update equity grant: %w", err)
	}

	grant.UpdatedAt = now
	return grant, nil
}

// DeleteEquityGrant deletes a grant
func (s *Service) DeleteEquityGrant(ctx context.Context, grantID string) error {
	// Verify ownership
	_, err := s.GetEquityGrant(ctx, grantID)
	if err != nil {
		return err
	}

	_, err = s.db.ExecContext(ctx, `DELETE FROM equity_grants WHERE id = $1`, grantID)
	if err != nil {
		return fmt.Errorf("failed to delete equity grant: %w", err)
	}

	return nil
}

// Vesting Schedule Operations

// SetVestingSchedule creates or updates a vesting schedule for a grant
func (s *Service) SetVestingSchedule(ctx context.Context, grantID string, req *SetVestingScheduleRequest) (*VestingSchedule, error) {
	// Verify grant ownership
	_, err := s.GetEquityGrant(ctx, grantID)
	if err != nil {
		return nil, err
	}

	// Validate schedule type specific requirements
	if req.ScheduleType == "time_based" {
		if req.TotalVestingMonths == nil || *req.TotalVestingMonths <= 0 {
			return nil, fmt.Errorf("total_vesting_months is required for time-based vesting")
		}
		if req.VestingFrequency == nil {
			return nil, fmt.Errorf("vesting_frequency is required for time-based vesting")
		}
	} else if req.ScheduleType == "milestone" {
		if req.MilestoneDescription == nil || *req.MilestoneDescription == "" {
			return nil, fmt.Errorf("milestone_description is required for milestone-based vesting")
		}
	}

	id := uuid.New().String()
	now := time.Now()

	var schedule VestingSchedule
	err = s.db.QueryRowContext(ctx, `
		INSERT INTO vesting_schedules (
			id, grant_id, schedule_type, cliff_months, total_vesting_months,
			vesting_frequency, milestone_description, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		ON CONFLICT (grant_id) DO UPDATE SET
			schedule_type = EXCLUDED.schedule_type,
			cliff_months = EXCLUDED.cliff_months,
			total_vesting_months = EXCLUDED.total_vesting_months,
			vesting_frequency = EXCLUDED.vesting_frequency,
			milestone_description = EXCLUDED.milestone_description
		RETURNING id, grant_id, schedule_type, cliff_months, total_vesting_months,
			vesting_frequency, milestone_description, created_at
	`, id, grantID, req.ScheduleType, req.CliffMonths, req.TotalVestingMonths,
		req.VestingFrequency, req.MilestoneDescription, now).Scan(
		&schedule.ID, &schedule.GrantID, &schedule.ScheduleType, &schedule.CliffMonths,
		&schedule.TotalVestingMonths, &schedule.VestingFrequency, &schedule.MilestoneDescription,
		&schedule.CreatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to set vesting schedule: %w", err)
	}

	return &schedule, nil
}

// GetVestingSchedule retrieves the vesting schedule for a grant
func (s *Service) GetVestingSchedule(ctx context.Context, grantID string) (*VestingSchedule, error) {
	// Verify grant ownership
	_, err := s.GetEquityGrant(ctx, grantID)
	if err != nil {
		return nil, err
	}

	var schedule VestingSchedule
	err = s.db.QueryRowContext(ctx, `
		SELECT id, grant_id, schedule_type, cliff_months, total_vesting_months,
			vesting_frequency, milestone_description, created_at
		FROM vesting_schedules
		WHERE grant_id = $1
	`, grantID).Scan(
		&schedule.ID, &schedule.GrantID, &schedule.ScheduleType, &schedule.CliffMonths,
		&schedule.TotalVestingMonths, &schedule.VestingFrequency, &schedule.MilestoneDescription,
		&schedule.CreatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to get vesting schedule: %w", err)
	}

	return &schedule, nil
}

// computeVestingEvents generates vesting events from grant and schedule (pure computation, no DB)
func computeVestingEvents(grant *EquityGrant, schedule *VestingSchedule) []VestingEvent {
	if schedule == nil || schedule.ScheduleType != "time_based" || schedule.TotalVestingMonths == nil {
		return []VestingEvent{}
	}

	grantDate := grant.GrantDate.Time
	totalMonths := *schedule.TotalVestingMonths
	cliffMonths := 0
	if schedule.CliffMonths != nil {
		cliffMonths = *schedule.CliffMonths
	}

	// Determine vesting frequency in months
	frequencyMonths := 1
	if schedule.VestingFrequency != nil {
		switch *schedule.VestingFrequency {
		case "monthly":
			frequencyMonths = 1
		case "quarterly":
			frequencyMonths = 3
		case "annually":
			frequencyMonths = 12
		}
	}

	// Calculate shares for cliff and post-cliff vesting
	now := time.Now()

	var cliffShares int
	var postCliffShares int
	var postCliffEvents int

	if cliffMonths > 0 {
		cliffShares = (grant.Quantity * cliffMonths) / totalMonths
		postCliffShares = grant.Quantity - cliffShares
		remainingMonths := totalMonths - cliffMonths
		if remainingMonths > 0 {
			postCliffEvents = remainingMonths / frequencyMonths
		}
	} else {
		cliffShares = 0
		postCliffShares = grant.Quantity
		postCliffEvents = totalMonths / frequencyMonths
	}

	if postCliffEvents == 0 && cliffMonths == 0 {
		postCliffEvents = 1
	}

	events := make([]VestingEvent, 0)
	remainingShares := grant.Quantity
	period := 1

	// Cliff event (if applicable)
	if cliffMonths > 0 {
		cliffDate := grantDate.AddDate(0, cliffMonths, 0)
		if cliffMonths == totalMonths {
			cliffShares = grant.Quantity
		}
		remainingShares -= cliffShares

		status := VestingStatusPending
		if cliffDate.Before(now) {
			status = VestingStatusVested
		}

		events = append(events, VestingEvent{
			ID:        fmt.Sprintf("%s-%d", grant.ID, period),
			GrantID:   grant.ID,
			VestDate:  Date{Time: cliffDate},
			Quantity:  cliffShares,
			FMVAtVest: grant.FMVAtGrant,
			Status:    status,
		})
		period++
	}

	// Post-cliff events
	if postCliffEvents > 0 {
		sharesPerEvent := postCliffShares / postCliffEvents

		startMonth := cliffMonths
		if startMonth == 0 {
			startMonth = frequencyMonths
		} else {
			startMonth += frequencyMonths
		}

		for month := startMonth; month <= totalMonths; month += frequencyMonths {
			vestDate := grantDate.AddDate(0, month, 0)
			vestShares := sharesPerEvent

			// Give remaining shares to last event
			if month+frequencyMonths > totalMonths {
				vestShares = remainingShares
			}

			if vestShares <= 0 {
				continue
			}

			remainingShares -= vestShares

			status := VestingStatusPending
			if vestDate.Before(now) {
				status = VestingStatusVested
			}

			events = append(events, VestingEvent{
				ID:        fmt.Sprintf("%s-%d", grant.ID, period),
				GrantID:   grant.ID,
				VestDate:  Date{Time: vestDate},
				Quantity:  vestShares,
				FMVAtVest: grant.FMVAtGrant,
				Status:    status,
			})
			period++
		}
	}

	return events
}

// GetVestingEvents computes vesting events for a grant based on its schedule
func (s *Service) GetVestingEvents(ctx context.Context, grantID string) (*VestingEventsResponse, error) {
	grant, err := s.GetEquityGrant(ctx, grantID)
	if err != nil {
		return nil, err
	}

	schedule, err := s.GetVestingSchedule(ctx, grantID)
	if err != nil {
		// No schedule = no events
		return &VestingEventsResponse{Events: []VestingEvent{}}, nil
	}

	events := computeVestingEvents(grant, schedule)
	return &VestingEventsResponse{Events: events}, nil
}

// GetUpcomingVestingEvents computes vesting events for all grants in an account
func (s *Service) GetUpcomingVestingEvents(ctx context.Context, accountID string, days int) (*VestingEventsResponse, error) {
	if err := s.verifyAccountOwnership(ctx, accountID); err != nil {
		return nil, err
	}

	futureDate := time.Now().AddDate(0, 0, days)

	// Get all grants for this account
	grantsResp, err := s.GetEquityGrants(ctx, accountID)
	if err != nil {
		return nil, err
	}

	allEvents := make([]VestingEvent, 0)

	for _, grant := range grantsResp.Grants {
		schedule, err := s.GetVestingSchedule(ctx, grant.ID)
		if err != nil {
			continue // No schedule for this grant
		}

		events := computeVestingEvents(&grant, schedule)
		for _, event := range events {
			// Only include events up to futureDate
			if !event.VestDate.Time.After(futureDate) {
				allEvents = append(allEvents, event)
			}
		}
	}

	return &VestingEventsResponse{Events: allEvents}, nil
}

// Exercise Operations

// RecordExercise records an exercise of options
func (s *Service) RecordExercise(ctx context.Context, grantID string, req *RecordExerciseRequest) (*EquityExercise, error) {
	grant, err := s.GetEquityGrant(ctx, grantID)
	if err != nil {
		return nil, err
	}

	// Verify this is an option (ISO/NSO)
	if grant.GrantType != GrantTypeISO && grant.GrantType != GrantTypeNSO {
		return nil, fmt.Errorf("exercises can only be recorded for ISO or NSO grants")
	}

	if grant.StrikePrice == nil {
		return nil, fmt.Errorf("grant has no strike price")
	}

	// Calculate exercise cost and taxable benefit
	exerciseCost := float64(req.Quantity) * *grant.StrikePrice
	taxableBenefit := float64(req.Quantity) * (req.FMVAtExercise - *grant.StrikePrice)
	if taxableBenefit < 0 {
		taxableBenefit = 0
	}

	id := uuid.New().String()
	now := time.Now()

	var exercise EquityExercise
	err = s.db.QueryRowContext(ctx, `
		INSERT INTO equity_exercises (
			id, grant_id, exercise_date, quantity, strike_price, fmv_at_exercise,
			exercise_cost, taxable_benefit, exercise_method, notes, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING id, grant_id, exercise_date, quantity, strike_price, fmv_at_exercise,
			exercise_cost, taxable_benefit, exercise_method, notes, created_at
	`, id, grantID, req.ExerciseDate, req.Quantity, *grant.StrikePrice, req.FMVAtExercise,
		exerciseCost, taxableBenefit, req.ExerciseMethod, req.Notes, now).Scan(
		&exercise.ID, &exercise.GrantID, &exercise.ExerciseDate, &exercise.Quantity,
		&exercise.StrikePrice, &exercise.FMVAtExercise, &exercise.ExerciseCost,
		&exercise.TaxableBenefit, &exercise.ExerciseMethod, &exercise.Notes, &exercise.CreatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to record exercise: %w", err)
	}

	return &exercise, nil
}

// GetExercises retrieves all exercises for a grant
func (s *Service) GetExercises(ctx context.Context, grantID string) (*ExercisesResponse, error) {
	_, err := s.GetEquityGrant(ctx, grantID)
	if err != nil {
		return nil, err
	}

	rows, err := s.db.QueryContext(ctx, `
		SELECT id, grant_id, exercise_date, quantity, strike_price, fmv_at_exercise,
			exercise_cost, taxable_benefit, exercise_method, notes, created_at
		FROM equity_exercises
		WHERE grant_id = $1
		ORDER BY exercise_date DESC
	`, grantID)

	if err != nil {
		return nil, fmt.Errorf("failed to get exercises: %w", err)
	}
	defer rows.Close()

	exercises := make([]EquityExercise, 0)
	for rows.Next() {
		var exercise EquityExercise
		err := rows.Scan(
			&exercise.ID, &exercise.GrantID, &exercise.ExerciseDate, &exercise.Quantity,
			&exercise.StrikePrice, &exercise.FMVAtExercise, &exercise.ExerciseCost,
			&exercise.TaxableBenefit, &exercise.ExerciseMethod, &exercise.Notes, &exercise.CreatedAt,
		)
		if err != nil {
			continue
		}
		exercises = append(exercises, exercise)
	}

	return &ExercisesResponse{Exercises: exercises}, nil
}

// GetAllExercises retrieves all exercises for an account
func (s *Service) GetAllExercises(ctx context.Context, accountID string) (*ExercisesResponse, error) {
	if err := s.verifyAccountOwnership(ctx, accountID); err != nil {
		return nil, err
	}

	rows, err := s.db.QueryContext(ctx, `
		SELECT e.id, e.grant_id, e.exercise_date, e.quantity, e.strike_price, e.fmv_at_exercise,
			e.exercise_cost, e.taxable_benefit, e.exercise_method, e.notes, e.created_at
		FROM equity_exercises e
		JOIN equity_grants g ON e.grant_id = g.id
		WHERE g.account_id = $1
		ORDER BY e.exercise_date DESC
	`, accountID)

	if err != nil {
		return nil, fmt.Errorf("failed to get exercises: %w", err)
	}
	defer rows.Close()

	exercises := make([]EquityExercise, 0)
	for rows.Next() {
		var exercise EquityExercise
		err := rows.Scan(
			&exercise.ID, &exercise.GrantID, &exercise.ExerciseDate, &exercise.Quantity,
			&exercise.StrikePrice, &exercise.FMVAtExercise, &exercise.ExerciseCost,
			&exercise.TaxableBenefit, &exercise.ExerciseMethod, &exercise.Notes, &exercise.CreatedAt,
		)
		if err != nil {
			continue
		}
		exercises = append(exercises, exercise)
	}

	return &ExercisesResponse{Exercises: exercises}, nil
}

// GetExercise retrieves a single exercise by ID
func (s *Service) GetExercise(ctx context.Context, exerciseID string) (*EquityExercise, error) {
	var exercise EquityExercise
	err := s.db.QueryRowContext(ctx, `
		SELECT e.id, e.grant_id, e.exercise_date, e.quantity, e.strike_price, e.fmv_at_exercise,
			e.exercise_cost, e.taxable_benefit, e.exercise_method, e.notes, e.created_at
		FROM equity_exercises e
		JOIN equity_grants g ON e.grant_id = g.id
		JOIN accounts a ON g.account_id = a.id
		WHERE e.id = $1
	`, exerciseID).Scan(
		&exercise.ID, &exercise.GrantID, &exercise.ExerciseDate, &exercise.Quantity,
		&exercise.StrikePrice, &exercise.FMVAtExercise, &exercise.ExerciseCost,
		&exercise.TaxableBenefit, &exercise.ExerciseMethod, &exercise.Notes, &exercise.CreatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("exercise not found")
		}
		return nil, fmt.Errorf("failed to get exercise: %w", err)
	}

	return &exercise, nil
}

// UpdateExercise updates an exercise
func (s *Service) UpdateExercise(ctx context.Context, exerciseID string, req *UpdateExerciseRequest) (*EquityExercise, error) {
	// Get existing exercise
	exercise, err := s.GetExercise(ctx, exerciseID)
	if err != nil {
		return nil, err
	}

	// Get grant to verify ownership and get strike price
	grant, err := s.GetEquityGrant(ctx, exercise.GrantID)
	if err != nil {
		return nil, err
	}

	// Apply updates
	if req.ExerciseDate != nil {
		exercise.ExerciseDate = *req.ExerciseDate
	}
	if req.Quantity != nil {
		exercise.Quantity = *req.Quantity
	}
	if req.FMVAtExercise != nil {
		exercise.FMVAtExercise = *req.FMVAtExercise
	}
	if req.ExerciseMethod != nil {
		exercise.ExerciseMethod = req.ExerciseMethod
	}
	if req.Notes != nil {
		exercise.Notes = req.Notes
	}

	// Recalculate exercise cost and taxable benefit
	exercise.ExerciseCost = float64(exercise.Quantity) * *grant.StrikePrice
	exercise.TaxableBenefit = float64(exercise.Quantity) * (exercise.FMVAtExercise - *grant.StrikePrice)
	if exercise.TaxableBenefit < 0 {
		exercise.TaxableBenefit = 0
	}

	// Update in database
	_, err = s.db.ExecContext(ctx, `
		UPDATE equity_exercises SET
			exercise_date = $1, quantity = $2, fmv_at_exercise = $3,
			exercise_cost = $4, taxable_benefit = $5, exercise_method = $6, notes = $7
		WHERE id = $8
	`, exercise.ExerciseDate, exercise.Quantity, exercise.FMVAtExercise,
		exercise.ExerciseCost, exercise.TaxableBenefit, exercise.ExerciseMethod, exercise.Notes, exerciseID)

	if err != nil {
		return nil, fmt.Errorf("failed to update exercise: %w", err)
	}

	return exercise, nil
}

// DeleteExercise deletes an exercise
func (s *Service) DeleteExercise(ctx context.Context, exerciseID string) error {
	// Verify exercise exists and user has access
	_, err := s.GetExercise(ctx, exerciseID)
	if err != nil {
		return err
	}

	_, err = s.db.ExecContext(ctx, `DELETE FROM equity_exercises WHERE id = $1`, exerciseID)
	if err != nil {
		return fmt.Errorf("failed to delete exercise: %w", err)
	}

	return nil
}

// Sale Operations

// RecordSale records a sale of shares
func (s *Service) RecordSale(ctx context.Context, accountID string, req *RecordSaleRequest) (*EquitySale, error) {
	if err := s.verifyAccountOwnership(ctx, accountID); err != nil {
		return nil, err
	}

	// Calculate capital gain and total proceeds
	totalProceeds := float64(req.Quantity) * req.SalePrice
	capitalGain := totalProceeds - req.CostBasis

	// Calculate holding period if we have grant info
	var holdingPeriodDays *int
	var isQualified *bool
	if req.GrantID != nil {
		grant, err := s.GetEquityGrant(ctx, *req.GrantID)
		if err == nil {
			days := int(req.SaleDate.Time.Sub(grant.GrantDate.Time).Hours() / 24)
			holdingPeriodDays = &days
			// Canadian rule: eligible for stock option deduction if held for 2+ years from grant
			qualified := days >= 730
			isQualified = &qualified
		}
	}

	id := uuid.New().String()
	now := time.Now()

	var sale EquitySale
	err := s.db.QueryRowContext(ctx, `
		INSERT INTO equity_sales (
			id, account_id, grant_id, exercise_id, sale_date, quantity, sale_price,
			total_proceeds, cost_basis, capital_gain, holding_period_days, is_qualified, notes, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
		RETURNING id, account_id, grant_id, exercise_id, sale_date, quantity, sale_price,
			total_proceeds, cost_basis, capital_gain, holding_period_days, is_qualified, notes, created_at
	`, id, accountID, req.GrantID, req.ExerciseID, req.SaleDate, req.Quantity, req.SalePrice,
		totalProceeds, req.CostBasis, capitalGain, holdingPeriodDays, isQualified, req.Notes, now).Scan(
		&sale.ID, &sale.AccountID, &sale.GrantID, &sale.ExerciseID, &sale.SaleDate, &sale.Quantity,
		&sale.SalePrice, &sale.TotalProceeds, &sale.CostBasis, &sale.CapitalGain,
		&sale.HoldingPeriodDays, &sale.IsQualified, &sale.Notes, &sale.CreatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to record sale: %w", err)
	}

	return &sale, nil
}

// GetSales retrieves all sales for an account
func (s *Service) GetSales(ctx context.Context, accountID string) (*SalesResponse, error) {
	if err := s.verifyAccountOwnership(ctx, accountID); err != nil {
		return nil, err
	}

	rows, err := s.db.QueryContext(ctx, `
		SELECT id, account_id, grant_id, exercise_id, sale_date, quantity, sale_price,
			total_proceeds, cost_basis, capital_gain, holding_period_days, is_qualified, notes, created_at
		FROM equity_sales
		WHERE account_id = $1
		ORDER BY sale_date DESC
	`, accountID)

	if err != nil {
		return nil, fmt.Errorf("failed to get sales: %w", err)
	}
	defer rows.Close()

	sales := make([]EquitySale, 0)
	for rows.Next() {
		var sale EquitySale
		err := rows.Scan(
			&sale.ID, &sale.AccountID, &sale.GrantID, &sale.ExerciseID, &sale.SaleDate, &sale.Quantity,
			&sale.SalePrice, &sale.TotalProceeds, &sale.CostBasis, &sale.CapitalGain,
			&sale.HoldingPeriodDays, &sale.IsQualified, &sale.Notes, &sale.CreatedAt,
		)
		if err != nil {
			continue
		}
		sales = append(sales, sale)
	}

	return &SalesResponse{Sales: sales}, nil
}

// GetSale retrieves a single sale by ID
func (s *Service) GetSale(ctx context.Context, saleID string) (*EquitySale, error) {
	var sale EquitySale
	err := s.db.QueryRowContext(ctx, `
		SELECT id, account_id, grant_id, exercise_id, sale_date, quantity, sale_price,
			total_proceeds, cost_basis, capital_gain, holding_period_days, is_qualified, notes, created_at
		FROM equity_sales
		WHERE id = $1
	`, saleID).Scan(
		&sale.ID, &sale.AccountID, &sale.GrantID, &sale.ExerciseID, &sale.SaleDate, &sale.Quantity,
		&sale.SalePrice, &sale.TotalProceeds, &sale.CostBasis, &sale.CapitalGain,
		&sale.HoldingPeriodDays, &sale.IsQualified, &sale.Notes, &sale.CreatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("sale not found")
		}
		return nil, fmt.Errorf("failed to get sale: %w", err)
	}

	// Verify ownership
	if err := s.verifyAccountOwnership(ctx, sale.AccountID); err != nil {
		return nil, err
	}

	return &sale, nil
}

// UpdateSale updates a sale
func (s *Service) UpdateSale(ctx context.Context, saleID string, req *UpdateSaleRequest) (*EquitySale, error) {
	// Get existing sale
	sale, err := s.GetSale(ctx, saleID)
	if err != nil {
		return nil, err
	}

	// Apply updates
	if req.SaleDate != nil {
		sale.SaleDate = *req.SaleDate
	}
	if req.Quantity != nil {
		sale.Quantity = *req.Quantity
	}
	if req.SalePrice != nil {
		sale.SalePrice = *req.SalePrice
	}
	if req.CostBasis != nil {
		sale.CostBasis = *req.CostBasis
	}
	if req.Notes != nil {
		sale.Notes = req.Notes
	}

	// Recalculate derived values
	sale.TotalProceeds = float64(sale.Quantity) * sale.SalePrice
	sale.CapitalGain = sale.TotalProceeds - sale.CostBasis

	// Update in database
	_, err = s.db.ExecContext(ctx, `
		UPDATE equity_sales SET
			sale_date = $1, quantity = $2, sale_price = $3, cost_basis = $4,
			total_proceeds = $5, capital_gain = $6, notes = $7
		WHERE id = $8
	`, sale.SaleDate, sale.Quantity, sale.SalePrice, sale.CostBasis,
		sale.TotalProceeds, sale.CapitalGain, sale.Notes, saleID)

	if err != nil {
		return nil, fmt.Errorf("failed to update sale: %w", err)
	}

	return sale, nil
}

// DeleteSale deletes a sale
func (s *Service) DeleteSale(ctx context.Context, saleID string) error {
	// Verify sale exists and user has access
	_, err := s.GetSale(ctx, saleID)
	if err != nil {
		return err
	}

	_, err = s.db.ExecContext(ctx, `DELETE FROM equity_sales WHERE id = $1`, saleID)
	if err != nil {
		return fmt.Errorf("failed to delete sale: %w", err)
	}

	return nil
}

// FMV Operations

// RecordFMV records a manual FMV entry
func (s *Service) RecordFMV(ctx context.Context, accountID string, req *RecordFMVRequest) (*FMVEntry, error) {
	if err := s.verifyAccountOwnership(ctx, accountID); err != nil {
		return nil, err
	}

	id := uuid.New().String()
	now := time.Now()
	currency := req.Currency
	if currency == "" {
		currency = "USD"
	}

	var entry FMVEntry
	err := s.db.QueryRowContext(ctx, `
		INSERT INTO fmv_history (id, account_id, currency, effective_date, fmv_per_share, notes, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (account_id, currency, effective_date) DO UPDATE SET
			fmv_per_share = EXCLUDED.fmv_per_share,
			notes = EXCLUDED.notes
		RETURNING id, account_id, currency, effective_date, fmv_per_share, notes, created_at
	`, id, accountID, currency, req.EffectiveDate, req.FMVPerShare, req.Notes, now).Scan(
		&entry.ID, &entry.AccountID, &entry.Currency, &entry.EffectiveDate, &entry.FMVPerShare, &entry.Notes, &entry.CreatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to record FMV: %w", err)
	}

	return &entry, nil
}

// GetFMVHistory retrieves all FMV entries for an account
func (s *Service) GetFMVHistory(ctx context.Context, accountID string) (*FMVHistoryResponse, error) {
	if err := s.verifyAccountOwnership(ctx, accountID); err != nil {
		return nil, err
	}

	rows, err := s.db.QueryContext(ctx, `
		SELECT id, account_id, currency, effective_date, fmv_per_share, notes, created_at
		FROM fmv_history
		WHERE account_id = $1
		ORDER BY currency, effective_date DESC
	`, accountID)

	if err != nil {
		return nil, fmt.Errorf("failed to get FMV history: %w", err)
	}
	defer rows.Close()

	entries := make([]FMVEntry, 0)
	for rows.Next() {
		var entry FMVEntry
		err := rows.Scan(
			&entry.ID, &entry.AccountID, &entry.Currency, &entry.EffectiveDate, &entry.FMVPerShare, &entry.Notes, &entry.CreatedAt,
		)
		if err != nil {
			continue
		}
		entries = append(entries, entry)
	}

	return &FMVHistoryResponse{Entries: entries}, nil
}

// GetCurrentFMV retrieves the most recent FMV for an account (returns the latest across all currencies)
func (s *Service) GetCurrentFMV(ctx context.Context, accountID string) (*FMVEntry, error) {
	if err := s.verifyAccountOwnership(ctx, accountID); err != nil {
		return nil, err
	}

	var entry FMVEntry
	err := s.db.QueryRowContext(ctx, `
		SELECT id, account_id, currency, effective_date, fmv_per_share, notes, created_at
		FROM fmv_history
		WHERE account_id = $1
		ORDER BY effective_date DESC
		LIMIT 1
	`, accountID).Scan(
		&entry.ID, &entry.AccountID, &entry.Currency, &entry.EffectiveDate, &entry.FMVPerShare, &entry.Notes, &entry.CreatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil // No FMV recorded yet
		}
		return nil, fmt.Errorf("failed to get current FMV: %w", err)
	}

	return &entry, nil
}

// GetCurrentFMVByCurrency retrieves the most recent FMV for a specific currency
func (s *Service) GetCurrentFMVByCurrency(ctx context.Context, accountID string, currency string) (*FMVEntry, error) {
	if err := s.verifyAccountOwnership(ctx, accountID); err != nil {
		return nil, err
	}

	if currency == "" {
		currency = "USD"
	}

	var entry FMVEntry
	err := s.db.QueryRowContext(ctx, `
		SELECT id, account_id, currency, effective_date, fmv_per_share, notes, created_at
		FROM fmv_history
		WHERE account_id = $1 AND currency = $2
		ORDER BY effective_date DESC
		LIMIT 1
	`, accountID, currency).Scan(
		&entry.ID, &entry.AccountID, &entry.Currency, &entry.EffectiveDate, &entry.FMVPerShare, &entry.Notes, &entry.CreatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil // No FMV recorded for this currency
		}
		return nil, fmt.Errorf("failed to get current FMV: %w", err)
	}

	return &entry, nil
}

// Summary/Analytics Operations

// GetOptionsSummary returns a high-level summary of the options account
func (s *Service) GetOptionsSummary(ctx context.Context, accountID string) (*OptionsSummary, error) {
	if err := s.verifyAccountOwnership(ctx, accountID); err != nil {
		return nil, err
	}

	summary := &OptionsSummary{
		ByGrantType: make(map[string]int),
		ByCurrency:  make(map[string]*CurrencySummary),
		Grants:      make([]EquityGrantWithSummary, 0),
	}

	// Get FMV history for per-currency FMV lookup
	fmvHistory, _ := s.GetFMVHistory(ctx, accountID)
	fmvByCurrency := make(map[string]float64)
	if fmvHistory != nil {
		for _, entry := range fmvHistory.Entries {
			// Only store the first (most recent) FMV for each currency
			if _, exists := fmvByCurrency[entry.Currency]; !exists {
				fmvByCurrency[entry.Currency] = entry.FMVPerShare
			}
		}
	}

	// Get current FMV (legacy - uses most recent regardless of currency)
	currentFMV, _ := s.GetCurrentFMV(ctx, accountID)
	if currentFMV != nil {
		summary.CurrentFMV = &currentFMV.FMVPerShare
	}

	// Helper to get or create currency summary
	getCurrencySummary := func(currency string) *CurrencySummary {
		if currency == "" {
			currency = "USD"
		}
		if summary.ByCurrency[currency] == nil {
			summary.ByCurrency[currency] = &CurrencySummary{Currency: currency}
			// Set current FMV for this currency if available
			if fmv, ok := fmvByCurrency[currency]; ok {
				summary.ByCurrency[currency].CurrentFMV = &fmv
			}
		}
		return summary.ByCurrency[currency]
	}

	// Get all grants
	grantsResp, err := s.GetEquityGrants(ctx, accountID)
	if err != nil {
		return nil, err
	}

	for _, grant := range grantsResp.Grants {
		grantSummary := EquityGrantWithSummary{
			EquityGrant: grant,
		}

		// Get the currency summary for this grant
		grantCurrency := grant.Currency
		if grantCurrency == "" {
			grantCurrency = "USD"
		}
		currencySummary := getCurrencySummary(grantCurrency)

		// Count by type
		summary.ByGrantType[string(grant.GrantType)]++
		summary.TotalGrants++
		summary.TotalShares += grant.Quantity

		// Get vesting summary for this grant
		eventsResp, err := s.GetVestingEvents(ctx, grant.ID)
		if err == nil {
			for _, event := range eventsResp.Events {
				if event.Status == VestingStatusVested {
					grantSummary.VestedQuantity += event.Quantity
				} else if event.Status == VestingStatusPending {
					grantSummary.UnvestedQuantity += event.Quantity
				}
			}
		}

		// If no vesting events, assume all unvested
		if grantSummary.VestedQuantity == 0 && grantSummary.UnvestedQuantity == 0 {
			grantSummary.UnvestedQuantity = grant.Quantity
		}

		// Get exercised quantity for options
		if grant.GrantType == GrantTypeISO || grant.GrantType == GrantTypeNSO {
			exercisesResp, err := s.GetExercises(ctx, grant.ID)
			if err == nil {
				for _, exercise := range exercisesResp.Exercises {
					grantSummary.ExercisedQuantity += exercise.Quantity
				}
			}
		}

		// Calculate values using currency-specific FMV
		fmv := grant.FMVAtGrant
		if currencyFMV, ok := fmvByCurrency[grantCurrency]; ok {
			fmv = currencyFMV
			grantSummary.CurrentFMV = &currencyFMV
		} else if summary.CurrentFMV != nil {
			// Fallback to legacy current FMV
			fmv = *summary.CurrentFMV
			grantSummary.CurrentFMV = summary.CurrentFMV
		}

		grantSummary.VestedValue = float64(grantSummary.VestedQuantity) * fmv
		grantSummary.UnvestedValue = float64(grantSummary.UnvestedQuantity) * fmv

		// Calculate intrinsic value for options
		if grant.StrikePrice != nil {
			intrinsicPerShare := fmv - *grant.StrikePrice
			if intrinsicPerShare > 0 {
				grantSummary.IntrinsicValue = float64(grantSummary.VestedQuantity-grantSummary.ExercisedQuantity) * intrinsicPerShare
			}
		} else {
			// For RSU/RSA, intrinsic value is the full vested value
			grantSummary.IntrinsicValue = grantSummary.VestedValue
		}

		// Aggregate to overall summary (mixed currencies - for backward compatibility)
		summary.VestedShares += grantSummary.VestedQuantity
		summary.UnvestedShares += grantSummary.UnvestedQuantity
		summary.ExercisedShares += grantSummary.ExercisedQuantity
		summary.VestedValue += grantSummary.VestedValue
		summary.UnvestedValue += grantSummary.UnvestedValue
		summary.TotalIntrinsicValue += grantSummary.IntrinsicValue

		// Aggregate to per-currency summary
		currencySummary.VestedShares += grantSummary.VestedQuantity
		currencySummary.UnvestedShares += grantSummary.UnvestedQuantity
		currencySummary.VestedValue += grantSummary.VestedValue
		currencySummary.UnvestedValue += grantSummary.UnvestedValue
		currencySummary.TotalIntrinsicValue += grantSummary.IntrinsicValue

		summary.Grants = append(summary.Grants, grantSummary)
	}

	// Get sold shares
	salesResp, err := s.GetSales(ctx, accountID)
	if err == nil {
		for _, sale := range salesResp.Sales {
			summary.SoldShares += sale.Quantity
		}
	}

	return summary, nil
}

// GetTaxSummary returns tax planning information for a specific year
func (s *Service) GetTaxSummary(ctx context.Context, accountID string, year int) (*TaxSummary, error) {
	if err := s.verifyAccountOwnership(ctx, accountID); err != nil {
		return nil, err
	}

	summary := &TaxSummary{
		Year:       year,
		ByCurrency: make(map[string]*CurrencyTaxData),
	}

	// Helper to get or create currency data
	getCurrencyData := func(currency string) *CurrencyTaxData {
		if currency == "" {
			currency = "USD"
		}
		if summary.ByCurrency[currency] == nil {
			summary.ByCurrency[currency] = &CurrencyTaxData{Currency: currency}
		}
		return summary.ByCurrency[currency]
	}

	// Get exercises for the year with currency
	rows, err := s.db.QueryContext(ctx, `
		SELECT ee.taxable_benefit, eg.grant_type, eg.currency
		FROM equity_exercises ee
		JOIN equity_grants eg ON ee.grant_id = eg.id
		WHERE eg.account_id = $1
		AND EXTRACT(YEAR FROM ee.exercise_date) = $2
	`, accountID, year)

	if err != nil {
		return nil, fmt.Errorf("failed to get exercises: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var taxableBenefit float64
		var grantType string
		var currency string
		if err := rows.Scan(&taxableBenefit, &grantType, &currency); err != nil {
			continue
		}
		summary.TotalTaxableBenefit += taxableBenefit
		currencyData := getCurrencyData(currency)
		currencyData.TotalTaxableBenefit += taxableBenefit
	}

	// Stock option deduction (50% for Canadian tax purposes)
	summary.StockOptionDeduction = summary.TotalTaxableBenefit * 0.5

	// Get sales for the year with currency
	salesRows, err := s.db.QueryContext(ctx, `
		SELECT es.capital_gain, es.is_qualified, COALESCE(eg.currency, 'USD') as currency
		FROM equity_sales es
		LEFT JOIN equity_grants eg ON es.grant_id = eg.id
		WHERE es.account_id = $1
		AND EXTRACT(YEAR FROM es.sale_date) = $2
	`, accountID, year)

	if err != nil {
		return nil, fmt.Errorf("failed to get sales: %w", err)
	}
	defer salesRows.Close()

	for salesRows.Next() {
		var capitalGain float64
		var isQualified *bool
		var currency string
		if err := salesRows.Scan(&capitalGain, &isQualified, &currency); err != nil {
			continue
		}
		summary.TotalCapitalGains += capitalGain
		currencyData := getCurrencyData(currency)
		currencyData.TotalCapitalGains += capitalGain

		if isQualified != nil && *isQualified {
			summary.QualifiedGains += capitalGain
			currencyData.QualifiedGains += capitalGain
		} else {
			summary.NonQualifiedGains += capitalGain
			currencyData.NonQualifiedGains += capitalGain
		}
	}

	// Calculate per-currency estimates
	for _, currencyData := range summary.ByCurrency {
		currencyData.StockOptionDeduction = currencyData.TotalTaxableBenefit * 0.5
		taxableFromBenefit := currencyData.TotalTaxableBenefit - currencyData.StockOptionDeduction
		taxableFromGains := currencyData.TotalCapitalGains * 0.5
		currencyData.EstimatedTax = (taxableFromBenefit + taxableFromGains) * 0.50
	}

	// Rough tax estimate (Canadian federal + Ontario provincial combined ~50% marginal rate)
	taxableFromBenefit := summary.TotalTaxableBenefit - summary.StockOptionDeduction
	taxableFromGains := summary.TotalCapitalGains * 0.5 // 50% inclusion rate
	summary.EstimatedTax = (taxableFromBenefit + taxableFromGains) * 0.50

	return summary, nil
}

// GetVestedValue returns the vested value for net worth calculation
func (s *Service) GetVestedValue(ctx context.Context, accountID string) (float64, error) {
	summary, err := s.GetOptionsSummary(ctx, accountID)
	if err != nil {
		return 0, err
	}

	// For net worth, we use the intrinsic value (actual gain if exercised/sold today)
	// This represents the economic value of vested, unexercised options
	return summary.TotalIntrinsicValue, nil
}
