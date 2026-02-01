/**
 * Types for the Tax Simulator feature
 */

export interface SimulatedExercise {
  id: string;
  grantId: string;
  grantLabel: string; // For display (e.g., "Grant #1 - ACME")
  exerciseDate: string;
  quantity: number;
  fmvAtExercise: number;
  // From grant data
  strikePrice: number;
  currency: string;
  // Calculated fields
  exerciseCost: number;
  taxableBenefit: number;
  stockOptionDeduction: number;
  netTaxable: number;
  estimatedTax: number;
}

export interface SimulatedSale {
  id: string;
  grantId: string;
  grantLabel: string;
  saleDate: string;
  quantity: number;
  salePrice: number;
  costBasis: number; // FMV at exercise for options
  currency: string;
  // For holding period calculation
  acquisitionDate: string;
  // Calculated fields
  totalProceeds: number;
  capitalGain: number;
  holdingPeriodDays: number;
  taxableGain: number;
  estimatedTax: number;
}

export interface YearSummary {
  year: number;
  exercises: SimulatedExercise[];
  sales: SimulatedSale[];
  exerciseTax: number;
  saleTax: number;
  totalTax: number;
  // By currency
  byCurrency: Record<string, CurrencyYearSummary>;
}

export interface CurrencyYearSummary {
  currency: string;
  taxableBenefit: number;
  stockOptionDeduction: number;
  capitalGains: number;
  exerciseTax: number;
  saleTax: number;
  totalTax: number;
}

export interface ScenarioSummary {
  totalExercises: number;
  totalSales: number;
  totalExerciseTax: number;
  totalSaleTax: number;
  totalEstimatedTax: number;
  byYear: YearSummary[];
  byCurrency: Record<string, {
    currency: string;
    totalExerciseTax: number;
    totalSaleTax: number;
    totalTax: number;
  }>;
}

export interface TaxScenario {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  exercises: SimulatedExercise[];
  sales: SimulatedSale[];
  // Computed from exercises and sales
  summary: ScenarioSummary;
}

export interface TaxSimulatorState {
  scenarios: TaxScenario[];
  activeScenarioId: string | null;
  marginalTaxRate: number; // User can adjust this
}

// Actions for the simulator
export type SimulatorAction =
  | { type: 'CREATE_SCENARIO'; name: string }
  | { type: 'CLONE_SCENARIO'; scenarioId: string; newName: string }
  | { type: 'DELETE_SCENARIO'; scenarioId: string }
  | { type: 'RENAME_SCENARIO'; scenarioId: string; newName: string }
  | { type: 'SET_ACTIVE_SCENARIO'; scenarioId: string }
  | { type: 'ADD_EXERCISE'; scenarioId: string; exercise: Omit<SimulatedExercise, 'id'> }
  | { type: 'UPDATE_EXERCISE'; scenarioId: string; exerciseId: string; updates: Partial<SimulatedExercise> }
  | { type: 'DELETE_EXERCISE'; scenarioId: string; exerciseId: string }
  | { type: 'ADD_SALE'; scenarioId: string; sale: Omit<SimulatedSale, 'id'> }
  | { type: 'UPDATE_SALE'; scenarioId: string; saleId: string; updates: Partial<SimulatedSale> }
  | { type: 'DELETE_SALE'; scenarioId: string; saleId: string }
  | { type: 'SET_MARGINAL_RATE'; rate: number }
  | { type: 'LOAD_STATE'; state: TaxSimulatorState };

// Vesting event for projections
export interface VestingEventForSimulation {
  id: string;
  vestDate: string;
  quantity: number;
  status: 'pending' | 'vested' | 'forfeited';
}

// Grant data needed for simulations
export interface GrantForSimulation {
  id: string;
  grantNumber?: string;
  companyName: string;
  grantType: string;
  strikePrice?: number;
  currency: string;
  vestedQuantity: number;
  unvestedQuantity: number;
  exercisedQuantity: number;
  currentFmv?: number;
  totalQuantity: number;
  expirationDate?: string;
  // Vesting events for projecting future vesting
  vestingEvents?: VestingEventForSimulation[];
}
