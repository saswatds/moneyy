package projections

import (
	"testing"
	"time"
)

// Test calculateTax with various edge cases
func TestCalculateTax_ZeroIncome(t *testing.T) {
	service := &Service{}
	brackets := []TaxBracket{
		{UpToIncome: 50000, Rate: 0.15},
		{UpToIncome: 100000, Rate: 0.20},
		{UpToIncome: 0, Rate: 0.26},
	}

	tax := service.calculateTax(0, brackets)

	if tax != 0 {
		t.Errorf("Expected 0 tax for 0 income, got %.2f", tax)
	}
}

func TestCalculateTax_NegativeIncome(t *testing.T) {
	service := &Service{}
	brackets := []TaxBracket{
		{UpToIncome: 50000, Rate: 0.15},
		{UpToIncome: 0, Rate: 0.26},
	}

	tax := service.calculateTax(-10000, brackets)

	if tax != 0 {
		t.Errorf("Expected 0 tax for negative income, got %.2f", tax)
	}
}

func TestCalculateTax_VeryHighIncome(t *testing.T) {
	service := &Service{}
	brackets := []TaxBracket{
		{UpToIncome: 50000, Rate: 0.15},
		{UpToIncome: 100000, Rate: 0.20},
		{UpToIncome: 0, Rate: 0.26},
	}

	tax := service.calculateTax(1000000, brackets)

	// Expected:
	// First 50k: 50000 * 0.15 = 7500
	// Next 50k: 50000 * 0.20 = 10000
	// Rest 900k: 900000 * 0.26 = 234000
	// Total: 251500
	expected := 251500.0
	tolerance := 0.01

	if tax < expected-tolerance || tax > expected+tolerance {
		t.Errorf("Expected tax %.2f for 1M income, got %.2f", expected, tax)
	}
}

func TestCalculateTax_ExactBracketBoundary(t *testing.T) {
	service := &Service{}
	brackets := []TaxBracket{
		{UpToIncome: 50000, Rate: 0.15},
		{UpToIncome: 100000, Rate: 0.20},
		{UpToIncome: 0, Rate: 0.26},
	}

	tax := service.calculateTax(50000, brackets)

	// Expected: 50000 * 0.15 = 7500
	expected := 7500.0
	tolerance := 0.01

	if tax < expected-tolerance || tax > expected+tolerance {
		t.Errorf("Expected tax %.2f for 50k income, got %.2f", expected, tax)
	}
}

func TestCalculateTax_SingleBracket(t *testing.T) {
	service := &Service{}
	brackets := []TaxBracket{
		{UpToIncome: 0, Rate: 0.20}, // Single flat rate
	}

	tax := service.calculateTax(100000, brackets)

	expected := 20000.0
	tolerance := 0.01

	if tax < expected-tolerance || tax > expected+tolerance {
		t.Errorf("Expected tax %.2f for flat rate, got %.2f", expected, tax)
	}
}

func TestCalculateTax_EmptyBrackets(t *testing.T) {
	service := &Service{}
	brackets := []TaxBracket{}

	tax := service.calculateTax(100000, brackets)

	if tax != 0 {
		t.Errorf("Expected 0 tax for empty brackets, got %.2f", tax)
	}
}

func TestCalculateTax_ZeroRateBrackets(t *testing.T) {
	service := &Service{}
	brackets := []TaxBracket{
		{UpToIncome: 20000, Rate: 0.00}, // Tax-free threshold
		{UpToIncome: 0, Rate: 0.15},
	}

	tax := service.calculateTax(50000, brackets)

	// First 20k is tax-free, remaining 30k at 15%
	expected := 30000.0 * 0.15
	tolerance := 0.01

	if tax < expected-tolerance || tax > expected+tolerance {
		t.Errorf("Expected tax %.2f with tax-free threshold, got %.2f", expected, tax)
	}
}

// Test convertToMonthlyPayment with all frequency types
func TestConvertToMonthlyPayment_AllFrequencies(t *testing.T) {
	tests := []struct {
		name      string
		amount    float64
		frequency string
		expected  float64
	}{
		{"Weekly", 100.00, "weekly", 100.00 * 52.0 / 12.0},
		{"BiWeekly", 200.00, "bi-weekly", 200.00 * 26.0 / 12.0},
		{"SemiMonthly", 300.00, "semi-monthly", 300.00 * 2.0},
		{"Monthly", 400.00, "monthly", 400.00},
		{"Quarterly", 1200.00, "quarterly", 1200.00 / 3.0},
		{"Annually", 12000.00, "annually", 12000.00 / 12.0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := convertToMonthlyPayment(tt.amount, tt.frequency)
			tolerance := 0.01

			if result < tt.expected-tolerance || result > tt.expected+tolerance {
				t.Errorf("%s: expected %.2f, got %.2f", tt.name, tt.expected, result)
			}
		})
	}
}

func TestConvertToMonthlyPayment_UnknownFrequency(t *testing.T) {
	result := convertToMonthlyPayment(100.00, "unknown")

	// Should default to monthly (or 0?)
	if result != 100.00 && result != 0 {
		t.Logf("Unknown frequency returns: %.2f (document this behavior)", result)
	}
}

func TestConvertToMonthlyPayment_ZeroAmount(t *testing.T) {
	result := convertToMonthlyPayment(0, "monthly")

	if result != 0 {
		t.Errorf("Expected 0 for zero amount, got %.2f", result)
	}
}

func TestConvertToMonthlyPayment_NegativeAmount(t *testing.T) {
	result := convertToMonthlyPayment(-100.00, "monthly")

	// Should it handle negative amounts or treat as positive?
	if result >= 0 {
		t.Logf("Negative amount returns positive: %.2f", result)
	} else {
		t.Logf("Negative amount preserved: %.2f", result)
	}
}

func TestConvertToMonthlyPayment_CaseSensitivity(t *testing.T) {
	tests := []struct {
		name      string
		frequency string
	}{
		{"Uppercase", "MONTHLY"},
		{"MixedCase", "Monthly"},
		{"Lowercase", "monthly"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := convertToMonthlyPayment(100.00, tt.frequency)
			t.Logf("%s frequency '%s' returns: %.2f", tt.name, tt.frequency, result)
			// Document whether it's case-sensitive
		})
	}
}

// Test findAccount utility function
func TestFindAccount_Found(t *testing.T) {
	accounts := []AccountData{
		{ID: "acc-1", Type: "savings", IsAsset: true},
		{ID: "acc-2", Type: "checking", IsAsset: true},
	}

	result := findAccount(accounts, "acc-1")

	if result == nil {
		t.Fatal("Expected to find account, got nil")
	}
	if result.ID != "acc-1" {
		t.Errorf("Expected ID 'acc-1', got '%s'", result.ID)
	}
}

func TestFindAccount_NotFound(t *testing.T) {
	accounts := []AccountData{
		{ID: "acc-1", Type: "savings", IsAsset: true},
	}

	result := findAccount(accounts, "non-existent")

	if result != nil {
		t.Errorf("Expected nil for non-existent account, got %v", result)
	}
}

func TestFindAccount_EmptySlice(t *testing.T) {
	accounts := []AccountData{}

	result := findAccount(accounts, "any-id")

	if result != nil {
		t.Errorf("Expected nil for empty account list, got %v", result)
	}
}

// Test isSameMonth utility function
func TestIsSameMonth_SameMonth(t *testing.T) {
	date1 := time.Date(2024, 6, 15, 0, 0, 0, 0, time.UTC)
	date2 := time.Date(2024, 6, 20, 0, 0, 0, 0, time.UTC)

	if !isSameMonth(date1, date2) {
		t.Error("Expected dates in same month to return true")
	}
}

func TestIsSameMonth_DifferentMonth(t *testing.T) {
	date1 := time.Date(2024, 6, 30, 0, 0, 0, 0, time.UTC)
	date2 := time.Date(2024, 7, 1, 0, 0, 0, 0, time.UTC)

	if isSameMonth(date1, date2) {
		t.Error("Expected dates in different months to return false")
	}
}

func TestIsSameMonth_DifferentYear(t *testing.T) {
	date1 := time.Date(2023, 12, 31, 0, 0, 0, 0, time.UTC)
	date2 := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)

	if isSameMonth(date1, date2) {
		t.Error("Expected dates in different years to return false")
	}
}

func TestIsSameMonth_SameDay(t *testing.T) {
	date1 := time.Date(2024, 6, 15, 10, 0, 0, 0, time.UTC)
	date2 := time.Date(2024, 6, 15, 18, 0, 0, 0, time.UTC)

	if !isSameMonth(date1, date2) {
		t.Error("Expected same day to be in same month")
	}
}

func TestIsSameMonth_MonthBoundaries(t *testing.T) {
	tests := []struct {
		name     string
		date1    time.Time
		date2    time.Time
		expected bool
	}{
		{
			"First and last day of month",
			time.Date(2024, 6, 1, 0, 0, 0, 0, time.UTC),
			time.Date(2024, 6, 30, 0, 0, 0, 0, time.UTC),
			true,
		},
		{
			"Last day of month and first of next",
			time.Date(2024, 6, 30, 23, 59, 59, 0, time.UTC),
			time.Date(2024, 7, 1, 0, 0, 0, 0, time.UTC),
			false,
		},
		{
			"February leap year boundary",
			time.Date(2024, 2, 29, 0, 0, 0, 0, time.UTC),
			time.Date(2024, 3, 1, 0, 0, 0, 0, time.UTC),
			false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isSameMonth(tt.date1, tt.date2)
			if result != tt.expected {
				t.Errorf("Expected %v, got %v", tt.expected, result)
			}
		})
	}
}
