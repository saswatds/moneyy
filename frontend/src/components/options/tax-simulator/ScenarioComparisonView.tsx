import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { IconX, IconTrophy } from '@tabler/icons-react';
import type { TaxScenario } from './types';
import { formatCurrency, aggregateToCAD } from '@/lib/currency';
import { useExchangeRates } from '@/hooks/use-exchange-rates';

interface ScenarioComparisonViewProps {
  scenarios: TaxScenario[];
  onClose: () => void;
}

export function ScenarioComparisonView({
  scenarios,
  onClose,
}: ScenarioComparisonViewProps) {
  const { data: exchangeRates } = useExchangeRates();

  if (scenarios.length < 2) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Compare Scenarios</CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <IconX className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Need at least 2 scenarios to compare.
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate CAD totals for each scenario
  const scenarioTotals = scenarios.map(scenario => {
    const currencies = Object.keys(scenario.summary.byCurrency);
    const hasMultipleCurrencies = currencies.length > 1;

    const totalTaxCAD = hasMultipleCurrencies
      ? aggregateToCAD(
          currencies.map(c => ({
            amount: scenario.summary.byCurrency[c].totalTax,
            currency: c,
          })),
          exchangeRates
        )
      : scenario.summary.totalEstimatedTax;

    const totalExerciseTaxCAD = hasMultipleCurrencies
      ? aggregateToCAD(
          currencies.map(c => ({
            amount: scenario.summary.byCurrency[c].totalExerciseTax,
            currency: c,
          })),
          exchangeRates
        )
      : scenario.summary.totalExerciseTax;

    const totalSaleTaxCAD = hasMultipleCurrencies
      ? aggregateToCAD(
          currencies.map(c => ({
            amount: scenario.summary.byCurrency[c].totalSaleTax,
            currency: c,
          })),
          exchangeRates
        )
      : scenario.summary.totalSaleTax;

    return {
      scenario,
      totalTaxCAD,
      totalExerciseTaxCAD,
      totalSaleTaxCAD,
      currencies,
      hasMultipleCurrencies,
    };
  });

  // Find the lowest tax scenario
  const lowestTaxScenario = scenarioTotals.reduce((min, current) =>
    current.totalTaxCAD < min.totalTaxCAD ? current : min
  );

  // Get all unique years across all scenarios
  const allYears = new Set<number>();
  scenarios.forEach(s => {
    s.summary.byYear.forEach(y => allYears.add(y.year));
  });
  const sortedYears = Array.from(allYears).sort((a, b) => a - b);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Compare Scenarios</CardTitle>
            <CardDescription>Side-by-side comparison of tax impact</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <IconX className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Comparison */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2 font-medium">Scenario</th>
                <th className="text-right p-2 font-medium">Total Tax (CAD)</th>
                <th className="text-right p-2 font-medium">Exercise Tax</th>
                <th className="text-right p-2 font-medium">Sale Tax</th>
                <th className="text-center p-2 font-medium"># Exercises</th>
                <th className="text-center p-2 font-medium"># Sales</th>
              </tr>
            </thead>
            <tbody>
              {scenarioTotals.map(({ scenario, totalTaxCAD, totalExerciseTaxCAD, totalSaleTaxCAD }) => {
                const isLowest = scenario.id === lowestTaxScenario.scenario.id;
                return (
                  <tr
                    key={scenario.id}
                    className={`border-b ${isLowest ? 'bg-green-50 dark:bg-green-900/20' : ''}`}
                  >
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{scenario.name}</span>
                        {isLowest && (
                          <Badge variant="default" className="text-xs">
                            <IconTrophy className="h-3 w-3 mr-1" />
                            Lowest
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="text-right p-2 font-bold text-yellow-600 dark:text-yellow-400">
                      {formatCurrency(totalTaxCAD, 'CAD')}
                    </td>
                    <td className="text-right p-2">
                      {formatCurrency(totalExerciseTaxCAD, 'CAD')}
                    </td>
                    <td className="text-right p-2">
                      {formatCurrency(totalSaleTaxCAD, 'CAD')}
                    </td>
                    <td className="text-center p-2">{scenario.summary.totalExercises}</td>
                    <td className="text-center p-2">{scenario.summary.totalSales}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Tax Savings */}
        {scenarioTotals.length >= 2 && (
          <div className="p-4 bg-muted rounded-lg">
            <h4 className="font-medium mb-2">Potential Savings</h4>
            <div className="space-y-2">
              {scenarioTotals
                .filter(s => s.scenario.id !== lowestTaxScenario.scenario.id)
                .map(({ scenario, totalTaxCAD }) => {
                  const savings = totalTaxCAD - lowestTaxScenario.totalTaxCAD;
                  return (
                    <div key={scenario.id} className="flex justify-between text-sm">
                      <span>
                        <span className="font-medium">{lowestTaxScenario.scenario.name}</span> vs{' '}
                        <span className="text-muted-foreground">{scenario.name}</span>
                      </span>
                      <span className="text-green-600 dark:text-green-400 font-medium">
                        Save {formatCurrency(savings, 'CAD')}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Year-by-Year Comparison */}
        {sortedYears.length > 0 && (
          <div>
            <h4 className="font-medium mb-3">Year-by-Year Comparison (CAD)</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-medium">Year</th>
                    {scenarios.map(s => (
                      <th key={s.id} className="text-right p-2 font-medium">
                        {s.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedYears.map(year => (
                    <tr key={year} className="border-b">
                      <td className="p-2 font-medium">{year}</td>
                      {scenarioTotals.map(({ scenario, hasMultipleCurrencies }) => {
                        const yearData = scenario.summary.byYear.find(y => y.year === year);
                        if (!yearData) {
                          return (
                            <td key={scenario.id} className="text-right p-2 text-muted-foreground">
                              -
                            </td>
                          );
                        }

                        const currencies = Object.keys(yearData.byCurrency);
                        const yearTaxCAD = hasMultipleCurrencies
                          ? aggregateToCAD(
                              currencies.map(c => ({
                                amount: yearData.byCurrency[c].totalTax,
                                currency: c,
                              })),
                              exchangeRates
                            )
                          : yearData.totalTax;

                        return (
                          <td key={scenario.id} className="text-right p-2">
                            {formatCurrency(yearTaxCAD, 'CAD')}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
