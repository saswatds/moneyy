/**
 * Pure tax calculation functions for Canadian tax rules.
 * These functions are used by the Tax Simulator feature for client-side calculations.
 */

// Default marginal tax rate for rough estimates (combined federal + provincial)
export const DEFAULT_MARGINAL_RATE = 0.5;

// Capital gains inclusion rate in Canada (50% of gains are taxable)
export const CAPITAL_GAINS_INCLUSION_RATE = 0.5;

// Stock option deduction rate (50%)
export const STOCK_OPTION_DEDUCTION_RATE = 0.5;

export interface ExerciseTaxResult {
  exerciseCost: number;
  taxableBenefit: number;
  stockOptionDeduction: number;
  netTaxable: number;
  estimatedTax: number;
}

export interface SaleTaxResult {
  totalProceeds: number;
  capitalGain: number;
  holdingPeriodDays: number;
  taxableGain: number;
  estimatedTax: number;
}

/**
 * Calculate tax implications of exercising stock options (Canadian rules)
 *
 * @param quantity - Number of options to exercise
 * @param strikePrice - Strike price per share
 * @param fmvAtExercise - Fair market value per share at time of exercise
 * @param marginalRate - Marginal tax rate (default 50%)
 * @returns Tax calculation results
 */
export function calculateExerciseTax(
  quantity: number,
  strikePrice: number,
  fmvAtExercise: number,
  marginalRate: number = DEFAULT_MARGINAL_RATE
): ExerciseTaxResult {
  // Exercise cost = strike price × quantity
  const exerciseCost = quantity * strikePrice;

  // Taxable benefit = (FMV at exercise - strike price) × quantity
  // This is treated as employment income
  const taxableBenefit = Math.max(0, quantity * (fmvAtExercise - strikePrice));

  // Stock option deduction = 50% of taxable benefit if eligible
  // Eligibility: exercise price >= FMV at grant, common shares, arm's length
  // We assume eligibility for simulation purposes
  const stockOptionDeduction = taxableBenefit * STOCK_OPTION_DEDUCTION_RATE;

  // Net taxable amount after deduction
  const netTaxable = taxableBenefit - stockOptionDeduction;

  // Estimated tax = net taxable × marginal rate
  const estimatedTax = netTaxable * marginalRate;

  return {
    exerciseCost,
    taxableBenefit,
    stockOptionDeduction,
    netTaxable,
    estimatedTax,
  };
}

/**
 * Calculate tax implications of selling shares (Canadian capital gains rules)
 *
 * In Canada, 50% of capital gains are included in taxable income regardless
 * of holding period (no long-term vs short-term distinction like the US).
 *
 * @param quantity - Number of shares to sell
 * @param salePrice - Sale price per share
 * @param costBasis - Cost basis per share (FMV at exercise for options)
 * @param purchaseDate - Date shares were acquired (exercise date for options)
 * @param saleDate - Date of sale
 * @param marginalRate - Marginal tax rate (default 50%)
 * @returns Tax calculation results
 */
export function calculateSaleTax(
  quantity: number,
  salePrice: number,
  costBasis: number,
  purchaseDate: Date,
  saleDate: Date,
  marginalRate: number = DEFAULT_MARGINAL_RATE
): SaleTaxResult {
  // Total proceeds from sale
  const totalProceeds = quantity * salePrice;

  // Capital gain/loss
  const capitalGain = quantity * (salePrice - costBasis);

  // Calculate holding period in days (for informational purposes)
  const holdingPeriodDays = Math.floor(
    (saleDate.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Taxable gain = 50% of capital gain (inclusion rate)
  // Only positive gains are taxable
  const taxableGain = capitalGain > 0 ? capitalGain * CAPITAL_GAINS_INCLUSION_RATE : 0;

  // Estimated tax (losses can offset other gains, but we show 0 tax for simplicity)
  const estimatedTax = taxableGain * marginalRate;

  return {
    totalProceeds,
    capitalGain,
    holdingPeriodDays,
    taxableGain,
    estimatedTax,
  };
}

/**
 * Get the year from a date string
 */
export function getYear(dateString: string): number {
  return new Date(dateString).getFullYear();
}

/**
 * Calculate number of days between two dates
 */
export function calculateDaysBetween(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Format a number as percentage
 */
export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}
