import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { TaxSummary, CurrencyTaxData, ExchangeRates } from '@/lib/api-client';
import { useExchangeRates } from '@/hooks/use-exchange-rates';
import { formatCurrency as formatCurrencyUtil, convertCurrency, aggregateToCAD } from '@/lib/currency';

interface TaxSummaryCardProps {
  summary: TaxSummary;
}

export function TaxSummaryCard({ summary }: TaxSummaryCardProps) {
  const { data: exchangeRates } = useExchangeRates();
  const currencies = summary.by_currency ? Object.keys(summary.by_currency) : [];
  const hasCurrencyBreakdown = currencies.length > 0;

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const formatCAD = (amount: number, currency: string) => {
    if (currency === 'CAD') return null;
    const cadAmount = convertCurrency(amount, currency, 'CAD', exchangeRates);
    return formatCurrencyUtil(cadAmount, 'CAD');
  };

  // Calculate combined CAD totals for multi-currency
  const getCombinedCADTotals = () => {
    if (!summary.by_currency || currencies.length <= 1) return null;

    const totals = {
      taxable_benefit: 0,
      stock_option_deduction: 0,
      capital_gains: 0,
      estimated_tax: 0,
    };

    currencies.forEach(currency => {
      const data = summary.by_currency![currency];
      totals.taxable_benefit += convertCurrency(data.total_taxable_benefit, currency, 'CAD', exchangeRates);
      totals.stock_option_deduction += convertCurrency(data.stock_option_deduction, currency, 'CAD', exchangeRates);
      totals.capital_gains += convertCurrency(data.total_capital_gains, currency, 'CAD', exchangeRates);
      totals.estimated_tax += convertCurrency(data.estimated_tax, currency, 'CAD', exchangeRates);
    });

    return totals;
  };

  const renderTaxDetails = (data: CurrencyTaxData | TaxSummary, currency: string) => {
    const showCAD = currency !== 'CAD';
    const netTaxable = data.total_taxable_benefit - data.stock_option_deduction;

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Exercise Tax Impact */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Exercise Tax Impact</CardTitle>
            <CardDescription>
              Tax implications from exercising options
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="text-muted-foreground">Taxable Benefit</div>
                <div className="text-xs text-muted-foreground/70">
                  Difference between FMV and strike price at exercise. Treated as employment income.
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-medium">{formatCurrency(data.total_taxable_benefit, currency)}</div>
                {showCAD && (
                  <div className="text-xs text-muted-foreground/70">{formatCAD(data.total_taxable_benefit, currency)}</div>
                )}
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t">
              <div className="flex justify-between gap-4 text-green-600 dark:text-green-400">
                <div className="flex-1 min-w-0">
                  <div>Stock Option Deduction (50%)</div>
                  <div className="text-xs opacity-70">
                    Eligible if: exercise price ≥ FMV at grant, common shares, arm's length with employer. CCPC may allow deferral.
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-medium">-{formatCurrency(data.stock_option_deduction, currency)}</div>
                  {showCAD && (
                    <div className="text-xs opacity-70">-{formatCAD(data.stock_option_deduction, currency)}</div>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-2 border-t">
              <div className="flex justify-between">
                <span className="font-medium">Net Taxable Amount</span>
                <div className="text-right">
                  <div className="font-medium">{formatCurrency(netTaxable, currency)}</div>
                  {showCAD && (
                    <div className="text-xs text-muted-foreground/70">{formatCAD(netTaxable, currency)}</div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Capital Gains */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Capital Gains</CardTitle>
            <CardDescription>
              Tax implications from selling shares
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Capital Gains</span>
                <div className="text-right">
                  <div className={`font-medium ${data.total_capital_gains >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {formatCurrency(data.total_capital_gains, currency)}
                  </div>
                  {showCAD && (
                    <div className={`text-xs ${data.total_capital_gains >= 0 ? 'text-green-600/70' : 'text-red-600/70'}`}>
                      {formatCAD(data.total_capital_gains, currency)}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="text-muted-foreground">Qualified Gains</div>
                  <div className="text-xs text-muted-foreground/70">
                    Shares held &gt;2 years from grant or from a CCPC. Eligible for stock option deduction.
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-medium">{formatCurrency(data.qualified_gains, currency)}</div>
                  {showCAD && (
                    <div className="text-xs text-muted-foreground/70">{formatCAD(data.qualified_gains, currency)}</div>
                  )}
                </div>
              </div>
              <div className="flex justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="text-muted-foreground">Non-Qualified Gains</div>
                  <div className="text-xs text-muted-foreground/70">
                    Shares held &lt;2 years or conditions not met. May not qualify for 50% deduction.
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-medium">{formatCurrency(data.non_qualified_gains, currency)}</div>
                  {showCAD && (
                    <div className="text-xs text-muted-foreground/70">{formatCAD(data.non_qualified_gains, currency)}</div>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-2 border-t">
              <div className="flex justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="text-muted-foreground">Taxable Amount (50% inclusion)</div>
                  <div className="text-xs text-muted-foreground/70">
                    In Canada, only 50% of capital gains are included in taxable income.
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-medium">{formatCurrency(data.total_capital_gains * 0.5, currency)}</div>
                  {showCAD && (
                    <div className="text-xs text-muted-foreground/70">{formatCAD(data.total_capital_gains * 0.5, currency)}</div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Tax Estimate */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Estimated Tax Liability ({currency})</CardTitle>
            <CardDescription>
              Rough estimate based on ~50% marginal tax rate
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {formatCurrency(data.estimated_tax, currency)}
                </div>
                {showCAD && (
                  <div className="text-sm text-yellow-600/70">{formatCAD(data.estimated_tax, currency)}</div>
                )}
                <div className="text-sm text-muted-foreground mt-1">Estimated Tax</div>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold">
                  {formatCurrency(netTaxable, currency)}
                </div>
                {showCAD && (
                  <div className="text-sm text-muted-foreground/70">{formatCAD(netTaxable, currency)}</div>
                )}
                <div className="text-sm text-muted-foreground mt-1">From Exercises</div>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold">
                  {formatCurrency(data.total_capital_gains * 0.5, currency)}
                </div>
                {showCAD && (
                  <div className="text-sm text-muted-foreground/70">{formatCAD(data.total_capital_gains * 0.5, currency)}</div>
                )}
                <div className="text-sm text-muted-foreground mt-1">From Sales</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  if (!hasCurrencyBreakdown) {
    // Fallback for legacy data without currency breakdown - use USD as default
    return (
      <div className="space-y-4">
        {renderTaxDetails(summary, 'USD')}
        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-sm text-yellow-800 dark:text-yellow-200">
          <strong>Disclaimer:</strong> This is a rough estimate for planning purposes only. Actual tax liability depends on your total income, province of residence, and other factors. Consult a tax professional for accurate advice.
        </div>
      </div>
    );
  }

  // Multi-currency view
  if (currencies.length === 1) {
    const currency = currencies[0];
    const currencyData = summary.by_currency![currency];
    return (
      <div className="space-y-4">
        {renderTaxDetails(currencyData, currency)}
        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-sm text-yellow-800 dark:text-yellow-200">
          <strong>Disclaimer:</strong> This is a rough estimate for planning purposes only. Actual tax liability depends on your total income, province of residence, and other factors. Consult a tax professional for accurate advice.
        </div>
      </div>
    );
  }

  // Multiple currencies - show tabs with combined CAD summary
  const combinedCAD = getCombinedCADTotals();

  return (
    <div className="space-y-4">
      {/* Combined CAD Summary */}
      {combinedCAD && (
        <Card className="border-2 border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Combined Tax Summary (CAD)</CardTitle>
            <CardDescription>
              All currencies converted to CAD at current exchange rates
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-3 bg-background rounded-lg">
                <div className="text-xl font-bold text-yellow-600 dark:text-yellow-400">
                  {formatCurrencyUtil(combinedCAD.estimated_tax, 'CAD')}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Total Estimated Tax</div>
              </div>
              <div className="text-center p-3 bg-background rounded-lg">
                <div className="text-xl font-bold">
                  {formatCurrencyUtil(combinedCAD.taxable_benefit, 'CAD')}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Taxable Benefit</div>
              </div>
              <div className="text-center p-3 bg-background rounded-lg">
                <div className="text-xl font-bold text-green-600 dark:text-green-400">
                  -{formatCurrencyUtil(combinedCAD.stock_option_deduction, 'CAD')}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Stock Option Deduction</div>
              </div>
              <div className="text-center p-3 bg-background rounded-lg">
                <div className={`text-xl font-bold ${combinedCAD.capital_gains >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {formatCurrencyUtil(combinedCAD.capital_gains, 'CAD')}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Capital Gains</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue={currencies[0]} className="w-full">
        <TabsList className="mb-4">
          {currencies.map(currency => (
            <TabsTrigger key={currency} value={currency}>
              {currency}
            </TabsTrigger>
          ))}
        </TabsList>

        {currencies.map(currency => {
          const currencyData = summary.by_currency![currency];
          return (
            <TabsContent key={currency} value={currency}>
              {renderTaxDetails(currencyData, currency)}
            </TabsContent>
          );
        })}
      </Tabs>

      <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-sm text-yellow-800 dark:text-yellow-200">
        <strong>Disclaimer:</strong> This is a rough estimate for planning purposes only. Combined CAD values use current exchange rates which may differ from rates at time of transaction. Actual tax liability depends on your total income, province of residence, and other factors. Consult a tax professional for accurate advice.
      </div>
    </div>
  );
}
