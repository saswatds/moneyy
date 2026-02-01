import { useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { TaxScenario } from './types';
import { formatCurrency, aggregateToCAD } from '@/lib/currency';
import { useExchangeRates } from '@/hooks/use-exchange-rates';

interface YearlyPlanningViewProps {
  scenario: TaxScenario;
}

export function YearlyPlanningView({ scenario }: YearlyPlanningViewProps) {
  const { data: exchangeRates } = useExchangeRates();

  const yearlyData = useMemo(() => {
    return scenario.summary.byYear.map(yearData => {
      const currencies = Object.keys(yearData.byCurrency);
      const hasMultipleCurrencies = currencies.length > 1;

      // Calculate CAD totals
      const taxCAD = hasMultipleCurrencies
        ? aggregateToCAD(
            currencies.map(c => ({
              amount: yearData.byCurrency[c].totalTax,
              currency: c,
            })),
            exchangeRates
          )
        : yearData.totalTax;

      const exerciseTaxCAD = hasMultipleCurrencies
        ? aggregateToCAD(
            currencies.map(c => ({
              amount: yearData.byCurrency[c].exerciseTax,
              currency: c,
            })),
            exchangeRates
          )
        : yearData.exerciseTax;

      const saleTaxCAD = hasMultipleCurrencies
        ? aggregateToCAD(
            currencies.map(c => ({
              amount: yearData.byCurrency[c].saleTax,
              currency: c,
            })),
            exchangeRates
          )
        : yearData.saleTax;

      // Calculate taxable income additions
      const taxableBenefitCAD = hasMultipleCurrencies
        ? aggregateToCAD(
            currencies.map(c => ({
              amount: yearData.byCurrency[c].taxableBenefit,
              currency: c,
            })),
            exchangeRates
          )
        : currencies.length > 0
        ? yearData.byCurrency[currencies[0]]?.taxableBenefit || 0
        : 0;

      const capitalGainsCAD = hasMultipleCurrencies
        ? aggregateToCAD(
            currencies.map(c => ({
              amount: yearData.byCurrency[c].capitalGains,
              currency: c,
            })),
            exchangeRates
          )
        : currencies.length > 0
        ? yearData.byCurrency[currencies[0]]?.capitalGains || 0
        : 0;

      return {
        year: yearData.year,
        exercises: yearData.exercises,
        sales: yearData.sales,
        taxCAD,
        exerciseTaxCAD,
        saleTaxCAD,
        taxableBenefitCAD,
        capitalGainsCAD,
        currencies,
        hasMultipleCurrencies,
        byCurrency: yearData.byCurrency,
      };
    });
  }, [scenario.summary.byYear, exchangeRates]);

  if (yearlyData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Year Planning</CardTitle>
          <CardDescription>
            Add transactions to see year-by-year breakdown
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No transactions to display.
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentYear = new Date().getFullYear();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Year Planning</CardTitle>
        <CardDescription>
          Plan your exercises and sales across tax years
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {yearlyData.map(data => {
          const isFuture = data.year > currentYear;
          const isCurrent = data.year === currentYear;

          return (
            <div
              key={data.year}
              className={`border rounded-lg overflow-hidden ${
                isCurrent ? 'border-primary' : ''
              }`}
            >
              {/* Year Header */}
              <div
                className={`p-4 ${
                  isCurrent
                    ? 'bg-primary/10'
                    : isFuture
                    ? 'bg-muted/50'
                    : 'bg-muted'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold">{data.year}</span>
                    {isCurrent && (
                      <Badge variant="default" className="text-xs">
                        Current Year
                      </Badge>
                    )}
                    {isFuture && (
                      <Badge variant="outline" className="text-xs">
                        Future
                      </Badge>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                      {formatCurrency(data.taxCAD, 'CAD')}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Estimated Tax
                    </div>
                  </div>
                </div>
              </div>

              {/* Year Details */}
              <div className="p-4 space-y-4">
                {/* Summary Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="text-lg font-semibold">
                      {data.exercises.length}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Exercise{data.exercises.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="text-lg font-semibold">{data.sales.length}</div>
                    <div className="text-xs text-muted-foreground">
                      Sale{data.sales.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                      {formatCurrency(data.exerciseTaxCAD, 'CAD')}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Exercise Tax
                    </div>
                  </div>
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="text-lg font-semibold text-green-600 dark:text-green-400">
                      {formatCurrency(data.saleTaxCAD, 'CAD')}
                    </div>
                    <div className="text-xs text-muted-foreground">Sale Tax</div>
                  </div>
                </div>

                {/* Income Impact */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Income Impact</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex justify-between p-2 bg-muted/30 rounded">
                      <span className="text-muted-foreground">
                        Taxable Benefit (Exercises)
                      </span>
                      <span className="font-medium">
                        {formatCurrency(data.taxableBenefitCAD, 'CAD')}
                      </span>
                    </div>
                    <div className="flex justify-between p-2 bg-muted/30 rounded">
                      <span className="text-muted-foreground">
                        Capital Gains (Sales)
                      </span>
                      <span
                        className={`font-medium ${
                          data.capitalGainsCAD >= 0
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {formatCurrency(data.capitalGainsCAD, 'CAD')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Transaction List */}
                {(data.exercises.length > 0 || data.sales.length > 0) && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Transactions</h4>
                    <div className="space-y-1">
                      {data.exercises.map(ex => (
                        <div
                          key={ex.id}
                          className="flex justify-between items-center text-sm p-2 bg-blue-50/50 dark:bg-blue-900/10 rounded"
                        >
                          <div>
                            <span className="font-medium">Exercise:</span>{' '}
                            {ex.grantLabel} - {ex.quantity.toLocaleString()} shares
                          </div>
                          <div className="text-yellow-600 dark:text-yellow-400">
                            {formatCurrency(ex.estimatedTax, ex.currency)}
                          </div>
                        </div>
                      ))}
                      {data.sales.map(sale => (
                        <div
                          key={sale.id}
                          className="flex justify-between items-center text-sm p-2 bg-green-50/50 dark:bg-green-900/10 rounded"
                        >
                          <div>
                            <span className="font-medium">Sale:</span>{' '}
                            {sale.grantLabel} - {sale.quantity.toLocaleString()}{' '}
                            shares @{' '}
                            {formatCurrency(sale.salePrice, sale.currency)}
                          </div>
                          <div className="text-yellow-600 dark:text-yellow-400">
                            {formatCurrency(sale.estimatedTax, sale.currency)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Currency Breakdown */}
                {data.hasMultipleCurrencies && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">By Currency</h4>
                    <div className="flex flex-wrap gap-2">
                      {data.currencies.map(currency => (
                        <div
                          key={currency}
                          className="px-3 py-1 bg-muted rounded text-sm"
                        >
                          {currency}:{' '}
                          {formatCurrency(
                            data.byCurrency[currency].totalTax,
                            currency
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Planning Tips */}
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg space-y-2">
          <h4 className="font-medium text-blue-800 dark:text-blue-200">
            Planning Tips
          </h4>
          <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1 list-disc list-inside">
            <li>
              Spread exercises across years to avoid pushing into higher tax
              brackets
            </li>
            <li>
              Consider exercising in years with lower other income
            </li>
            <li>
              Time sales to offset gains with losses from other investments
            </li>
            <li>
              In Canada, 50% of capital gains are taxable regardless of holding period
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
