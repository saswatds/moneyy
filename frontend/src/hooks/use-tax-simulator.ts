import { useState, useCallback, useEffect, useMemo } from 'react';
import type {
  TaxSimulatorState,
  TaxScenario,
  SimulatedExercise,
  SimulatedSale,
  ScenarioSummary,
  YearSummary,
  CurrencyYearSummary,
} from '@/components/options/tax-simulator/types';
import { DEFAULT_MARGINAL_RATE } from '@/lib/tax-calculations';
import { apiClient } from '@/lib/api-client';

const STORAGE_KEY = 'tax-simulator-state';

// Simple UUID generator (crypto.randomUUID is available in modern browsers)
function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getInitialState(): TaxSimulatorState {
  if (typeof window === 'undefined') {
    return {
      scenarios: [],
      activeScenarioId: null,
      marginalTaxRate: DEFAULT_MARGINAL_RATE,
    };
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as TaxSimulatorState;
      // Validate and return
      if (parsed.scenarios && Array.isArray(parsed.scenarios)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load tax simulator state from localStorage:', e);
  }

  return {
    scenarios: [],
    activeScenarioId: null,
    marginalTaxRate: DEFAULT_MARGINAL_RATE,
  };
}

function calculateScenarioSummary(
  exercises: SimulatedExercise[],
  sales: SimulatedSale[]
): ScenarioSummary {
  // Group by year
  const exercisesByYear = new Map<number, SimulatedExercise[]>();
  const salesByYear = new Map<number, SimulatedSale[]>();

  exercises.forEach(ex => {
    const year = new Date(ex.exerciseDate).getFullYear();
    if (!exercisesByYear.has(year)) {
      exercisesByYear.set(year, []);
    }
    exercisesByYear.get(year)!.push(ex);
  });

  sales.forEach(sale => {
    const year = new Date(sale.saleDate).getFullYear();
    if (!salesByYear.has(year)) {
      salesByYear.set(year, []);
    }
    salesByYear.get(year)!.push(sale);
  });

  // Get all years
  const allYears = new Set([...exercisesByYear.keys(), ...salesByYear.keys()]);
  const sortedYears = Array.from(allYears).sort((a, b) => a - b);

  // Calculate by year
  const byYear: YearSummary[] = sortedYears.map(year => {
    const yearExercises = exercisesByYear.get(year) || [];
    const yearSales = salesByYear.get(year) || [];

    // Group by currency
    const byCurrency: Record<string, CurrencyYearSummary> = {};

    yearExercises.forEach(ex => {
      if (!byCurrency[ex.currency]) {
        byCurrency[ex.currency] = {
          currency: ex.currency,
          taxableBenefit: 0,
          stockOptionDeduction: 0,
          capitalGains: 0,
          exerciseTax: 0,
          saleTax: 0,
          totalTax: 0,
        };
      }
      byCurrency[ex.currency].taxableBenefit += ex.taxableBenefit;
      byCurrency[ex.currency].stockOptionDeduction += ex.stockOptionDeduction;
      byCurrency[ex.currency].exerciseTax += ex.estimatedTax;
      byCurrency[ex.currency].totalTax += ex.estimatedTax;
    });

    yearSales.forEach(sale => {
      if (!byCurrency[sale.currency]) {
        byCurrency[sale.currency] = {
          currency: sale.currency,
          taxableBenefit: 0,
          stockOptionDeduction: 0,
          capitalGains: 0,
          exerciseTax: 0,
          saleTax: 0,
          totalTax: 0,
        };
      }
      byCurrency[sale.currency].capitalGains += sale.capitalGain;
      byCurrency[sale.currency].saleTax += sale.estimatedTax;
      byCurrency[sale.currency].totalTax += sale.estimatedTax;
    });

    const exerciseTax = yearExercises.reduce((sum, ex) => sum + ex.estimatedTax, 0);
    const saleTax = yearSales.reduce((sum, s) => sum + s.estimatedTax, 0);

    return {
      year,
      exercises: yearExercises,
      sales: yearSales,
      exerciseTax,
      saleTax,
      totalTax: exerciseTax + saleTax,
      byCurrency,
    };
  });

  // Calculate totals by currency
  const byCurrency: Record<string, { currency: string; totalExerciseTax: number; totalSaleTax: number; totalTax: number }> = {};

  exercises.forEach(ex => {
    if (!byCurrency[ex.currency]) {
      byCurrency[ex.currency] = {
        currency: ex.currency,
        totalExerciseTax: 0,
        totalSaleTax: 0,
        totalTax: 0,
      };
    }
    byCurrency[ex.currency].totalExerciseTax += ex.estimatedTax;
    byCurrency[ex.currency].totalTax += ex.estimatedTax;
  });

  sales.forEach(sale => {
    if (!byCurrency[sale.currency]) {
      byCurrency[sale.currency] = {
        currency: sale.currency,
        totalExerciseTax: 0,
        totalSaleTax: 0,
        totalTax: 0,
      };
    }
    byCurrency[sale.currency].totalSaleTax += sale.estimatedTax;
    byCurrency[sale.currency].totalTax += sale.estimatedTax;
  });

  return {
    totalExercises: exercises.length,
    totalSales: sales.length,
    totalExerciseTax: exercises.reduce((sum, ex) => sum + ex.estimatedTax, 0),
    totalSaleTax: sales.reduce((sum, s) => sum + s.estimatedTax, 0),
    totalEstimatedTax: exercises.reduce((sum, ex) => sum + ex.estimatedTax, 0) +
      sales.reduce((sum, s) => sum + s.estimatedTax, 0),
    byYear,
    byCurrency,
  };
}

// Recalculate functions are now async and use the API
async function recalculateExercisesAndSales(
  exercises: SimulatedExercise[],
  sales: SimulatedSale[],
  marginalRate: number
): Promise<{ exercises: SimulatedExercise[]; sales: SimulatedSale[] }> {
  if (exercises.length === 0 && sales.length === 0) {
    return { exercises: [], sales: [] };
  }

  try {
    const result = await apiClient.calculateBatchTax({
      exercises: exercises.map(ex => ({
        quantity: ex.quantity,
        strike_price: ex.strikePrice,
        fmv_at_exercise: ex.fmvAtExercise,
        marginal_rate: marginalRate,
      })),
      sales: sales.map(s => ({
        quantity: s.quantity,
        sale_price: s.salePrice,
        cost_basis: s.costBasis,
        acquisition_date: s.acquisitionDate,
        sale_date: s.saleDate,
        marginal_rate: marginalRate,
      })),
      marginal_rate: marginalRate,
    });

    // Map results back to exercises
    const updatedExercises = exercises.map((ex, i) => ({
      ...ex,
      exerciseCost: result.exercises[i].exercise_cost,
      taxableBenefit: result.exercises[i].taxable_benefit,
      stockOptionDeduction: result.exercises[i].stock_option_deduction,
      netTaxable: result.exercises[i].net_taxable,
      estimatedTax: result.exercises[i].estimated_tax,
    }));

    // Map results back to sales
    const updatedSales = sales.map((s, i) => ({
      ...s,
      totalProceeds: result.sales[i].total_proceeds,
      capitalGain: result.sales[i].capital_gain,
      holdingPeriodDays: result.sales[i].holding_period_days,
      taxableGain: result.sales[i].taxable_gain,
      estimatedTax: result.sales[i].estimated_tax,
    }));

    return { exercises: updatedExercises, sales: updatedSales };
  } catch (error) {
    console.error('Failed to recalculate taxes:', error);
    // Return unchanged on error
    return { exercises, sales };
  }
}

export function useTaxSimulator() {
  const [state, setState] = useState<TaxSimulatorState>(getInitialState);

  // Persist state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save tax simulator state:', e);
    }
  }, [state]);

  // Get active scenario
  const activeScenario = useMemo(() => {
    if (!state.activeScenarioId) return null;
    return state.scenarios.find(s => s.id === state.activeScenarioId) || null;
  }, [state.scenarios, state.activeScenarioId]);

  // Create a new scenario
  const createScenario = useCallback((name: string) => {
    const newScenario: TaxScenario = {
      id: generateId(),
      name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      exercises: [],
      sales: [],
      summary: calculateScenarioSummary([], []),
    };

    setState(prev => ({
      ...prev,
      scenarios: [...prev.scenarios, newScenario],
      activeScenarioId: newScenario.id,
    }));

    return newScenario.id;
  }, []);

  // Clone a scenario
  const cloneScenario = useCallback((scenarioId: string, newName: string) => {
    setState(prev => {
      const original = prev.scenarios.find(s => s.id === scenarioId);
      if (!original) return prev;

      const cloned: TaxScenario = {
        ...original,
        id: generateId(),
        name: newName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        exercises: original.exercises.map(ex => ({ ...ex, id: generateId() })),
        sales: original.sales.map(s => ({ ...s, id: generateId() })),
      };

      return {
        ...prev,
        scenarios: [...prev.scenarios, cloned],
        activeScenarioId: cloned.id,
      };
    });
  }, []);

  // Delete a scenario
  const deleteScenario = useCallback((scenarioId: string) => {
    setState(prev => {
      const newScenarios = prev.scenarios.filter(s => s.id !== scenarioId);
      let newActiveId = prev.activeScenarioId;

      if (prev.activeScenarioId === scenarioId) {
        newActiveId = newScenarios.length > 0 ? newScenarios[0].id : null;
      }

      return {
        ...prev,
        scenarios: newScenarios,
        activeScenarioId: newActiveId,
      };
    });
  }, []);

  // Rename a scenario
  const renameScenario = useCallback((scenarioId: string, newName: string) => {
    setState(prev => ({
      ...prev,
      scenarios: prev.scenarios.map(s =>
        s.id === scenarioId
          ? { ...s, name: newName, updatedAt: new Date().toISOString() }
          : s
      ),
    }));
  }, []);

  // Set active scenario
  const setActiveScenario = useCallback((scenarioId: string) => {
    setState(prev => ({
      ...prev,
      activeScenarioId: scenarioId,
    }));
  }, []);

  // Add an exercise (values come pre-calculated from the component)
  const addExercise = useCallback((scenarioId: string, exercise: Omit<SimulatedExercise, 'id'>) => {
    setState(prev => {
      const newExercise: SimulatedExercise = {
        ...exercise,
        id: generateId(),
      };

      return {
        ...prev,
        scenarios: prev.scenarios.map(s => {
          if (s.id !== scenarioId) return s;

          const newExercises = [...s.exercises, newExercise];
          return {
            ...s,
            exercises: newExercises,
            updatedAt: new Date().toISOString(),
            summary: calculateScenarioSummary(newExercises, s.sales),
          };
        }),
      };
    });
  }, []);

  // Update an exercise (note: changing calculated fields requires re-adding)
  const updateExercise = useCallback((scenarioId: string, exerciseId: string, updates: Partial<SimulatedExercise>) => {
    setState(prev => ({
      ...prev,
      scenarios: prev.scenarios.map(s => {
        if (s.id !== scenarioId) return s;

        const newExercises = s.exercises.map(ex => {
          if (ex.id !== exerciseId) return ex;
          return { ...ex, ...updates };
        });

        return {
          ...s,
          exercises: newExercises,
          updatedAt: new Date().toISOString(),
          summary: calculateScenarioSummary(newExercises, s.sales),
        };
      }),
    }));
  }, []);

  // Delete an exercise
  const deleteExercise = useCallback((scenarioId: string, exerciseId: string) => {
    setState(prev => ({
      ...prev,
      scenarios: prev.scenarios.map(s => {
        if (s.id !== scenarioId) return s;

        const newExercises = s.exercises.filter(ex => ex.id !== exerciseId);
        return {
          ...s,
          exercises: newExercises,
          updatedAt: new Date().toISOString(),
          summary: calculateScenarioSummary(newExercises, s.sales),
        };
      }),
    }));
  }, []);

  // Add a sale (values come pre-calculated from the component)
  const addSale = useCallback((scenarioId: string, sale: Omit<SimulatedSale, 'id'>) => {
    setState(prev => {
      const newSale: SimulatedSale = {
        ...sale,
        id: generateId(),
      };

      return {
        ...prev,
        scenarios: prev.scenarios.map(s => {
          if (s.id !== scenarioId) return s;

          const newSales = [...s.sales, newSale];
          return {
            ...s,
            sales: newSales,
            updatedAt: new Date().toISOString(),
            summary: calculateScenarioSummary(s.exercises, newSales),
          };
        }),
      };
    });
  }, []);

  // Update a sale (note: changing calculated fields requires re-adding)
  const updateSale = useCallback((scenarioId: string, saleId: string, updates: Partial<SimulatedSale>) => {
    setState(prev => ({
      ...prev,
      scenarios: prev.scenarios.map(s => {
        if (s.id !== scenarioId) return s;

        const newSales = s.sales.map(sale => {
          if (sale.id !== saleId) return sale;
          return { ...sale, ...updates };
        });

        return {
          ...s,
          sales: newSales,
          updatedAt: new Date().toISOString(),
          summary: calculateScenarioSummary(s.exercises, newSales),
        };
      }),
    }));
  }, []);

  // Delete a sale
  const deleteSale = useCallback((scenarioId: string, saleId: string) => {
    setState(prev => ({
      ...prev,
      scenarios: prev.scenarios.map(s => {
        if (s.id !== scenarioId) return s;

        const newSales = s.sales.filter(sale => sale.id !== saleId);
        return {
          ...s,
          sales: newSales,
          updatedAt: new Date().toISOString(),
          summary: calculateScenarioSummary(s.exercises, newSales),
        };
      }),
    }));
  }, []);

  // Set marginal tax rate (recalculates all scenarios using API)
  const setMarginalRate = useCallback(async (rate: number) => {
    // First update the rate
    setState(prev => ({
      ...prev,
      marginalTaxRate: rate,
    }));

    // Then recalculate all scenarios using the API
    setState(prev => {
      // Trigger async recalculation for each scenario
      const recalculateAllScenarios = async () => {
        const updatedScenarios = await Promise.all(
          prev.scenarios.map(async s => {
            if (s.exercises.length === 0 && s.sales.length === 0) {
              return s;
            }
            const { exercises: newExercises, sales: newSales } = await recalculateExercisesAndSales(
              s.exercises,
              s.sales,
              rate
            );
            return {
              ...s,
              exercises: newExercises,
              sales: newSales,
              summary: calculateScenarioSummary(newExercises, newSales),
            };
          })
        );

        setState(current => ({
          ...current,
          scenarios: updatedScenarios,
        }));
      };

      recalculateAllScenarios();
      return prev;
    });
  }, []);

  // Reset all data
  const resetAll = useCallback(() => {
    setState({
      scenarios: [],
      activeScenarioId: null,
      marginalTaxRate: DEFAULT_MARGINAL_RATE,
    });
  }, []);

  return {
    // State
    scenarios: state.scenarios,
    activeScenario,
    activeScenarioId: state.activeScenarioId,
    marginalTaxRate: state.marginalTaxRate,

    // Scenario actions
    createScenario,
    cloneScenario,
    deleteScenario,
    renameScenario,
    setActiveScenario,

    // Exercise actions
    addExercise,
    updateExercise,
    deleteExercise,

    // Sale actions
    addSale,
    updateSale,
    deleteSale,

    // Settings
    setMarginalRate,
    resetAll,
  };
}
