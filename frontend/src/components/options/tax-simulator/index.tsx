import { useState, useMemo, useEffect } from 'react';
import { IconCalculator } from '@tabler/icons-react';
import type { EquityGrantWithSummary } from '@/lib/api-client';
import type { GrantForSimulation } from './types';
import { useTaxSimulator } from '@/hooks/use-tax-simulator';
import { useAnnualIncomeSummary } from '@/hooks/use-income';
import { TaxSimulatorHeader } from './TaxSimulatorHeader';
import { ExerciseSimulator } from './ExerciseSimulator';
import { SaleSimulator } from './SaleSimulator';
import { SimulatedTransactionsList } from './SimulatedTransactionsList';
import { ScenarioSummaryCard } from './ScenarioSummaryCard';
import { ScenarioComparisonView } from './ScenarioComparisonView';
import { YearlyPlanningView } from './YearlyPlanningView';

interface TaxSimulatorProps {
  grants: EquityGrantWithSummary[];
}

export function TaxSimulator({ grants }: TaxSimulatorProps) {
  const [showComparison, setShowComparison] = useState(false);
  const [hasInitializedRate, setHasInitializedRate] = useState(false);

  const {
    scenarios,
    activeScenario,
    activeScenarioId,
    marginalTaxRate,
    createScenario,
    cloneScenario,
    deleteScenario,
    setActiveScenario,
    addExercise,
    deleteExercise,
    addSale,
    deleteSale,
    setMarginalRate,
  } = useTaxSimulator();

  // Fetch user's actual marginal tax rate from their income summary
  const currentYear = new Date().getFullYear();
  const { data: incomeSummary } = useAnnualIncomeSummary(currentYear);

  // Initialize marginal rate from user's income summary when available
  useEffect(() => {
    if (incomeSummary?.marginal_tax_rate && !hasInitializedRate) {
      // Only set if the rate from income summary is different and meaningful
      if (incomeSummary.marginal_tax_rate > 0) {
        setMarginalRate(incomeSummary.marginal_tax_rate);
        setHasInitializedRate(true);
      }
    }
  }, [incomeSummary, hasInitializedRate, setMarginalRate]);

  // Convert grants to simulation format
  const grantsForSimulation = useMemo<GrantForSimulation[]>(() => {
    return grants.map(g => ({
      id: g.id,
      grantNumber: g.grant_number,
      companyName: g.company_name,
      grantType: g.grant_type,
      strikePrice: g.strike_price,
      currency: g.currency,
      vestedQuantity: g.vested_quantity,
      unvestedQuantity: g.unvested_quantity,
      exercisedQuantity: g.exercised_quantity,
      currentFmv: g.current_fmv,
      totalQuantity: g.quantity,
      expirationDate: g.expiration_date,
      // Note: vesting events would need to be fetched separately per grant
      // For now, we'll project based on unvested quantity and total
      vestingEvents: [],
    }));
  }, [grants]);

  // Calculate simulated exercised quantities per grant in the active scenario
  const simulatedExercisedByGrant = useMemo(() => {
    if (!activeScenario) return {};
    const byGrant: Record<string, number> = {};
    for (const ex of activeScenario.exercises) {
      byGrant[ex.grantId] = (byGrant[ex.grantId] || 0) + ex.quantity;
    }
    return byGrant;
  }, [activeScenario]);


  // Handlers
  const handleAddExercise = (exercise: Parameters<typeof addExercise>[1]) => {
    if (!activeScenarioId) return;
    addExercise(activeScenarioId, exercise);
  };

  const handleDeleteExercise = (exerciseId: string) => {
    if (!activeScenarioId) return;
    deleteExercise(activeScenarioId, exerciseId);
  };

  const handleAddSale = (sale: Parameters<typeof addSale>[1]) => {
    if (!activeScenarioId) return;
    addSale(activeScenarioId, sale);
  };

  const handleDeleteSale = (saleId: string) => {
    if (!activeScenarioId) return;
    deleteSale(activeScenarioId, saleId);
  };

  // Show comparison view if requested
  if (showComparison && scenarios.length >= 2) {
    return (
      <div className="space-y-4">
        <TaxSimulatorHeader
          scenarios={scenarios}
          activeScenarioId={activeScenarioId}
          marginalRate={marginalTaxRate}
          userMarginalRate={incomeSummary?.marginal_tax_rate}
          onCreateScenario={createScenario}
          onCloneScenario={cloneScenario}
          onDeleteScenario={deleteScenario}
          onSetActiveScenario={setActiveScenario}
          onSetMarginalRate={setMarginalRate}
          onCompare={() => setShowComparison(false)}
        />
        <ScenarioComparisonView
          scenarios={scenarios}
          onClose={() => setShowComparison(false)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <TaxSimulatorHeader
        scenarios={scenarios}
        activeScenarioId={activeScenarioId}
        marginalRate={marginalTaxRate}
        userMarginalRate={incomeSummary?.marginal_tax_rate}
        onCreateScenario={createScenario}
        onCloneScenario={cloneScenario}
        onDeleteScenario={deleteScenario}
        onSetActiveScenario={setActiveScenario}
        onSetMarginalRate={setMarginalRate}
        onCompare={() => setShowComparison(true)}
      />

      {/* No scenario selected */}
      {!activeScenario && scenarios.length === 0 && (
        <div className="text-center py-12 text-muted-foreground border rounded-lg">
          <IconCalculator className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium mb-2">No Scenarios Yet</h3>
          <p className="text-sm mb-4">
            Create a scenario to start simulating exercises and sales.
          </p>
        </div>
      )}

      {/* Active scenario content */}
      {activeScenario && (
        <div className="space-y-4">
          {/* Tax Summary and Simulated Transactions side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ScenarioSummaryCard summary={activeScenario.summary} />
            <SimulatedTransactionsList
              exercises={activeScenario.exercises}
              sales={activeScenario.sales}
              onDeleteExercise={handleDeleteExercise}
              onDeleteSale={handleDeleteSale}
            />
          </div>

          {/* Exercise and Sale forms side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ExerciseSimulator
              grants={grantsForSimulation}
              simulatedExercisedByGrant={simulatedExercisedByGrant}
              onAddExercise={handleAddExercise}
              marginalRate={marginalTaxRate}
            />
            <SaleSimulator
              grants={grantsForSimulation}
              simulatedExercises={activeScenario.exercises}
              simulatedSales={activeScenario.sales}
              onAddSale={handleAddSale}
              marginalRate={marginalTaxRate}
            />
          </div>

          {/* Year Planning */}
          <YearlyPlanningView scenario={activeScenario} />
        </div>
      )}
    </div>
  );
}

export { TaxSimulatorHeader } from './TaxSimulatorHeader';
export { ExerciseSimulator } from './ExerciseSimulator';
export { SaleSimulator } from './SaleSimulator';
export { SimulatedTransactionsList } from './SimulatedTransactionsList';
export { ScenarioSummaryCard } from './ScenarioSummaryCard';
export { ScenarioComparisonView } from './ScenarioComparisonView';
export { YearlyPlanningView } from './YearlyPlanningView';
export type * from './types';
