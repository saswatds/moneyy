package projections

import (
	"fmt"
	"sort"
	"time"
)

// EventType represents the type of projection event
type EventType string

const (
	EventOneTimeIncome      EventType = "one_time_income"
	EventOneTimeExpense     EventType = "one_time_expense"
	EventExtraDebtPayment   EventType = "extra_debt_payment"
	EventSalaryChange       EventType = "salary_change"
	EventExpenseLevelChange EventType = "expense_level_change"
	EventSavingsRateChange  EventType = "savings_rate_change"
)

// Event represents a financial event that occurs during the projection
type Event struct {
	ID                  string          `json:"id"`
	Type                EventType       `json:"type"`
	Date                time.Time       `json:"date"`
	Description         string          `json:"description"`
	Parameters          EventParameters `json:"parameters"`
	IsRecurring         bool            `json:"is_recurring"`
	RecurrenceFrequency string          `json:"recurrence_frequency,omitempty"` // "monthly", "quarterly", "annually"
	RecurrenceEndDate   *time.Time      `json:"recurrence_end_date,omitempty"`  // nil = recur until end of projection
}

// EventParameters contains type-specific parameters for events
type EventParameters struct {
	// One-time financial
	Amount    float64 `json:"amount,omitempty"`
	Category  string  `json:"category,omitempty"`
	AccountID string  `json:"account_id,omitempty"`

	// Recurring changes
	NewSalary         float64 `json:"new_salary,omitempty"`
	NewSalaryGrowth   float64 `json:"new_salary_growth,omitempty"`
	NewExpenses       float64 `json:"new_expenses,omitempty"`
	ExpenseChange     float64 `json:"expense_change,omitempty"`
	ExpenseChangeType string  `json:"expense_change_type,omitempty"` // "absolute", "relative_amount", "relative_percent"
	NewExpenseGrowth  float64 `json:"new_expense_growth,omitempty"`
	NewSavingsRate    float64 `json:"new_savings_rate,omitempty"`
	Reason            string  `json:"reason,omitempty"`
}

// ProjectionState holds the current state of projection parameters that can be modified by events
type ProjectionState struct {
	AnnualSalary        float64
	AnnualSalaryGrowth  float64
	MonthlyExpenses     float64
	AnnualExpenseGrowth float64
	MonthlySavingsRate  float64
}

// NewProjectionState creates initial state from config
func NewProjectionState(config *Config) *ProjectionState {
	return &ProjectionState{
		AnnualSalary:        config.AnnualSalary,
		AnnualSalaryGrowth:  config.AnnualSalaryGrowth,
		MonthlyExpenses:     config.MonthlyExpenses,
		AnnualExpenseGrowth: config.AnnualExpenseGrowth,
		MonthlySavingsRate:  config.MonthlySavingsRate,
	}
}

// expandRecurringEvents expands recurring events into individual occurrences
func expandRecurringEvents(events []Event, projectionEndDate time.Time) []Event {
	var expandedEvents []Event

	for _, event := range events {
		if !event.IsRecurring {
			// Non-recurring event, add as-is
			expandedEvents = append(expandedEvents, event)
			continue
		}

		// Determine end date for recurrence
		endDate := projectionEndDate
		if event.RecurrenceEndDate != nil && event.RecurrenceEndDate.Before(projectionEndDate) {
			endDate = *event.RecurrenceEndDate
		}

		// Generate occurrences based on frequency
		currentDate := event.Date
		occurrenceNum := 0

		for !currentDate.After(endDate) {
			// Create a copy of the event for this occurrence
			occurrence := Event{
				ID:          fmt.Sprintf("%s_occurrence_%d", event.ID, occurrenceNum),
				Type:        event.Type,
				Date:        currentDate,
				Description: event.Description,
				Parameters:  event.Parameters,
				IsRecurring: false, // Mark as non-recurring to prevent re-expansion
			}
			expandedEvents = append(expandedEvents, occurrence)

			// Calculate next occurrence date
			switch event.RecurrenceFrequency {
			case "monthly":
				currentDate = currentDate.AddDate(0, 1, 0)
			case "quarterly":
				currentDate = currentDate.AddDate(0, 3, 0)
			case "annually":
				currentDate = currentDate.AddDate(1, 0, 0)
			default:
				// Unknown frequency, treat as one-time - exit the loop
				currentDate = endDate.AddDate(0, 0, 1)
			}

			occurrenceNum++
		}
	}

	return expandedEvents
}

// sortEvents sorts events by date (earliest first)
func sortEvents(events []Event) {
	sort.Slice(events, func(i, j int) bool {
		return events[i].Date.Before(events[j].Date)
	})
}

// findEventsForMonth returns all events that occur in the given month
func findEventsForMonth(events []Event, currentDate time.Time) []Event {
	var monthEvents []Event
	for _, event := range events {
		if isSameMonth(event.Date, currentDate) {
			monthEvents = append(monthEvents, event)
		}
	}
	return monthEvents
}

// applyEvent applies an event to the projection state
func applyEvent(
	event Event,
	state *ProjectionState,
	currentDate time.Time,
	debtBalances map[string]float64,
	mortgages []MortgageData,
	loans []LoanData,
) (oneTimeIncome float64, oneTimeExpense float64, err error) {
	switch event.Type {
	case EventOneTimeIncome:
		return event.Parameters.Amount, 0, nil

	case EventOneTimeExpense:
		return 0, event.Parameters.Amount, nil

	case EventExtraDebtPayment:
		return applyExtraDebtPayment(event, debtBalances, mortgages, loans)

	case EventSalaryChange:
		return applySalaryChange(event, state)

	case EventExpenseLevelChange:
		return applyExpenseLevelChange(event, state)

	case EventSavingsRateChange:
		return applySavingsRateChange(event, state)

	default:
		return 0, 0, fmt.Errorf("unknown event type: %s", event.Type)
	}
}

// applyExtraDebtPayment applies an extra debt payment event
func applyExtraDebtPayment(
	event Event,
	debtBalances map[string]float64,
	mortgages []MortgageData,
	loans []LoanData,
) (oneTimeIncome float64, oneTimeExpense float64, err error) {
	accountID := event.Parameters.AccountID
	amount := event.Parameters.Amount

	// Check if account exists in debt balances
	balance, exists := debtBalances[accountID]
	if !exists {
		return 0, 0, fmt.Errorf("account %s not found in debt balances", accountID)
	}

	// Apply payment (reduce debt balance)
	paymentAmount := amount
	if paymentAmount > balance {
		paymentAmount = balance // Can't pay more than owed
	}

	debtBalances[accountID] = balance - paymentAmount

	// This is an expense (money going out)
	return 0, paymentAmount, nil
}

// applySalaryChange applies a salary change event
func applySalaryChange(event Event, state *ProjectionState) (oneTimeIncome float64, oneTimeExpense float64, err error) {
	state.AnnualSalary = event.Parameters.NewSalary

	// Update growth rate if specified
	if event.Parameters.NewSalaryGrowth > 0 {
		state.AnnualSalaryGrowth = event.Parameters.NewSalaryGrowth
	}

	return 0, 0, nil
}

// applyExpenseLevelChange applies an expense level change event
func applyExpenseLevelChange(event Event, state *ProjectionState) (oneTimeIncome float64, oneTimeExpense float64, err error) {
	switch event.Parameters.ExpenseChangeType {
	case "absolute":
		// Set to new absolute value
		state.MonthlyExpenses = event.Parameters.NewExpenses

	case "relative_amount":
		// Increase/decrease by amount
		state.MonthlyExpenses += event.Parameters.ExpenseChange

	case "relative_percent":
		// Increase/decrease by percentage
		state.MonthlyExpenses *= (1 + event.Parameters.ExpenseChange)

	default:
		// Default to absolute if not specified
		if event.Parameters.NewExpenses > 0 {
			state.MonthlyExpenses = event.Parameters.NewExpenses
		}
	}

	// Ensure expenses don't go negative
	if state.MonthlyExpenses < 0 {
		state.MonthlyExpenses = 0
	}

	// Update growth rate if specified
	if event.Parameters.NewExpenseGrowth >= 0 {
		state.AnnualExpenseGrowth = event.Parameters.NewExpenseGrowth
	}

	return 0, 0, nil
}

// applySavingsRateChange applies a savings rate change event
func applySavingsRateChange(event Event, state *ProjectionState) (oneTimeIncome float64, oneTimeExpense float64, err error) {
	state.MonthlySavingsRate = event.Parameters.NewSavingsRate

	// Ensure savings rate is between 0 and 1
	if state.MonthlySavingsRate < 0 {
		state.MonthlySavingsRate = 0
	}
	if state.MonthlySavingsRate > 1 {
		state.MonthlySavingsRate = 1
	}

	return 0, 0, nil
}
