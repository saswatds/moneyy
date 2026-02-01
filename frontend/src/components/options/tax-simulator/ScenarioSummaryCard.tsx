import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ScenarioSummary, YearSummary } from './types';
import { formatCurrency, aggregateToCAD } from '@/lib/currency';
import { useExchangeRates } from '@/hooks/use-exchange-rates';

interface ScenarioSummaryCardProps {
  summary: ScenarioSummary;
}

export function ScenarioSummaryCard({ summary }: ScenarioSummaryCardProps) {
  const { data: exchangeRates } = useExchangeRates();

  const currencies = Object.keys(summary.byCurrency);
  const hasMultipleCurrencies = currencies.length > 1;

  // Calculate combined CAD totals
  const totalTaxCAD = hasMultipleCurrencies
    ? aggregateToCAD(
        currencies.map(c => ({
          amount: summary.byCurrency[c].totalTax,
          currency: c,
        })),
        exchangeRates
      )
    : summary.totalEstimatedTax;

  const totalExerciseTaxCAD = hasMultipleCurrencies
    ? aggregateToCAD(
        currencies.map(c => ({
          amount: summary.byCurrency[c].totalExerciseTax,
          currency: c,
        })),
        exchangeRates
      )
    : summary.totalExerciseTax;

  const totalSaleTaxCAD = hasMultipleCurrencies
    ? aggregateToCAD(
        currencies.map(c => ({
          amount: summary.byCurrency[c].totalSaleTax,
          currency: c,
        })),
        exchangeRates
      )
    : summary.totalSaleTax;

  if (summary.totalExercises === 0 && summary.totalSales === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tax Summary</CardTitle>
          <CardDescription>
            Add simulated exercises and sales to see tax impact
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            No transactions in this scenario yet.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">
          Tax Summary{hasMultipleCurrencies ? ' (CAD)' : ''}
        </CardTitle>
        <CardDescription>
          {summary.totalExercises} exercise{summary.totalExercises !== 1 ? 's' : ''},{' '}
          {summary.totalSales} sale{summary.totalSales !== 1 ? 's' : ''}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main totals: Exercises + Sales = Total */}
        <div className="flex items-center justify-center gap-2">
          <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex-1">
            <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
              {formatCurrency(totalExerciseTaxCAD, hasMultipleCurrencies ? 'CAD' : currencies[0] || 'USD')}
            </div>
            <div className="text-xs text-muted-foreground mt-1">From Exercises</div>
          </div>
          <div className="text-xl font-bold text-muted-foreground">+</div>
          <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg flex-1">
            <div className="text-xl font-bold text-green-600 dark:text-green-400">
              {formatCurrency(totalSaleTaxCAD, hasMultipleCurrencies ? 'CAD' : currencies[0] || 'USD')}
            </div>
            <div className="text-xs text-muted-foreground mt-1">From Sales</div>
          </div>
          <div className="text-xl font-bold text-muted-foreground">=</div>
          <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg flex-1">
            <div className="text-xl font-bold text-yellow-600 dark:text-yellow-400">
              {formatCurrency(totalTaxCAD, hasMultipleCurrencies ? 'CAD' : currencies[0] || 'USD')}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Total Tax</div>
          </div>
        </div>

        {/* Year Breakdown - full width */}
        {summary.byYear.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">By Year</h4>
            <div className="space-y-2">
              {summary.byYear.map(yearData => (
                <YearRow
                  key={yearData.year}
                  yearData={yearData}
                  exchangeRates={exchangeRates}
                  hasMultipleCurrencies={hasMultipleCurrencies}
                />
              ))}
            </div>
          </div>
        )}

        {/* Currency Breakdown */}
        {hasMultipleCurrencies && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">By Currency</h4>
            <Tabs defaultValue={currencies[0]} className="w-full">
              <TabsList className="w-full">
                {currencies.map(currency => (
                  <TabsTrigger key={currency} value={currency} className="flex-1">
                    {currency}
                  </TabsTrigger>
                ))}
              </TabsList>
              {currencies.map(currency => {
                const data = summary.byCurrency[currency];
                return (
                  <TabsContent key={currency} value={currency}>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      <div className="text-center p-2 bg-muted rounded">
                        <div className="text-sm font-bold">
                          {formatCurrency(data.totalTax, currency)}
                        </div>
                        <div className="text-xs text-muted-foreground">Total</div>
                      </div>
                      <div className="text-center p-2 bg-muted rounded">
                        <div className="text-sm font-bold">
                          {formatCurrency(data.totalExerciseTax, currency)}
                        </div>
                        <div className="text-xs text-muted-foreground">Exercise</div>
                      </div>
                      <div className="text-center p-2 bg-muted rounded">
                        <div className="text-sm font-bold">
                          {formatCurrency(data.totalSaleTax, currency)}
                        </div>
                        <div className="text-xs text-muted-foreground">Sale</div>
                      </div>
                    </div>
                  </TabsContent>
                );
              })}
            </Tabs>
          </div>
        )}

        {/* Disclaimer */}
        <p className="text-xs text-muted-foreground">
          Estimates only. Actual tax depends on total income, province, and other factors.
        </p>
      </CardContent>
    </Card>
  );
}

interface YearRowProps {
  yearData: YearSummary;
  exchangeRates: any;
  hasMultipleCurrencies: boolean;
}

function YearRow({ yearData, exchangeRates, hasMultipleCurrencies }: YearRowProps) {
  const currencies = Object.keys(yearData.byCurrency);

  // Calculate CAD total for this year
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
    <div className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm">
      <div>
        <span className="font-medium">{yearData.year}</span>
        <span className="text-xs text-muted-foreground ml-2">
          {yearData.exercises.length}E / {yearData.sales.length}S
        </span>
      </div>
      <div className="font-medium text-yellow-600 dark:text-yellow-400">
        {formatCurrency(yearTaxCAD, hasMultipleCurrencies ? 'CAD' : currencies[0] || 'USD')}
      </div>
    </div>
  );
}
