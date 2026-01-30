import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { EquityGrantWithSummary } from '@/lib/api-client';
import { useExchangeRates } from '@/hooks/use-exchange-rates';
import { formatCurrency as formatCurrencyUtil, convertCurrency } from '@/lib/currency';

interface OptionsValueChartProps {
  grants: EquityGrantWithSummary[];
}

export function OptionsValueChart({ grants }: OptionsValueChartProps) {
  const { data: exchangeRates } = useExchangeRates();

  // Group grants by currency
  const byCurrency: Record<string, EquityGrantWithSummary[]> = {};
  grants.forEach(grant => {
    const currency = grant.currency || 'USD';
    if (!byCurrency[currency]) {
      byCurrency[currency] = [];
    }
    byCurrency[currency].push(grant);
  });

  const currencies = Object.keys(byCurrency);

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(amount);
  };

  const formatCAD = (amount: number, currency: string) => {
    if (currency === 'CAD') return null;
    const cadAmount = convertCurrency(amount, currency, 'CAD', exchangeRates);
    return formatCurrencyUtil(cadAmount, 'CAD');
  };

  const colors: Record<string, string> = {
    iso: 'bg-blue-500',
    nso: 'bg-purple-500',
    rsu: 'bg-green-500',
    rsa: 'bg-amber-500',
  };

  const typeLabels: Record<string, string> = {
    iso: 'ISO',
    nso: 'NSO',
    rsu: 'RSU',
    rsa: 'RSA',
  };

  if (grants.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Value Breakdown</CardTitle>
          <CardDescription>By grant type</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No grants to display
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Value Breakdown</CardTitle>
        <CardDescription>By grant type and currency</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {currencies.map(currency => {
          const currencyGrants = byCurrency[currency];

          // Calculate totals by grant type for this currency
          const byType: Record<string, { vested: number; unvested: number; shares: number }> = {};
          let totalVested = 0;
          let totalUnvested = 0;

          currencyGrants.forEach(grant => {
            const type = grant.grant_type;
            if (!byType[type]) {
              byType[type] = { vested: 0, unvested: 0, shares: 0 };
            }
            byType[type].vested += grant.vested_value;
            byType[type].unvested += grant.unvested_value;
            byType[type].shares += grant.quantity;
            totalVested += grant.vested_value;
            totalUnvested += grant.unvested_value;
          });

          const totalValue = totalVested + totalUnvested;

          return (
            <div key={currency} className="space-y-4">
              {currencies.length > 1 && (
                <div className="text-sm font-semibold text-muted-foreground border-b pb-1">
                  {currency}
                </div>
              )}

              {/* Simple bar visualization */}
              <div className="space-y-3">
                {Object.entries(byType).map(([type, data]) => {
                  const typeTotal = data.vested + data.unvested;
                  const percentage = totalValue > 0 ? (typeTotal / totalValue) * 100 : 0;

                  return (
                    <div key={type} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{typeLabels[type] || type.toUpperCase()}</span>
                        <div className="text-right">
                          <span className="text-muted-foreground">{formatCurrency(typeTotal, currency)}</span>
                          {currency !== 'CAD' && (
                            <span className="text-xs text-muted-foreground/70 ml-1">
                              ({formatCAD(typeTotal, currency)})
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full ${colors[type] || 'bg-gray-500'} rounded-full transition-all`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{data.shares.toLocaleString()} shares</span>
                        <span>{percentage.toFixed(1)}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Vested vs Unvested breakdown */}
              <div className="pt-4 border-t">
                <div className="text-sm font-medium mb-2">Vesting Status</div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                      <span className="text-sm">Vested</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-medium text-green-600 dark:text-green-400">
                        {formatCurrency(totalVested, currency)}
                      </span>
                      {currency !== 'CAD' && (
                        <span className="text-xs text-green-600/70 ml-1">
                          ({formatCAD(totalVested, currency)})
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-yellow-500" />
                      <span className="text-sm">Unvested</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                        {formatCurrency(totalUnvested, currency)}
                      </span>
                      {currency !== 'CAD' && (
                        <span className="text-xs text-yellow-600/70 ml-1">
                          ({formatCAD(totalUnvested, currency)})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Vested/Unvested bar */}
                <div className="mt-3 h-3 bg-muted rounded-full overflow-hidden flex">
                  <div
                    className="bg-green-500 h-full transition-all"
                    style={{ width: `${totalValue > 0 ? (totalVested / totalValue) * 100 : 0}%` }}
                  />
                  <div
                    className="bg-yellow-500 h-full transition-all"
                    style={{ width: `${totalValue > 0 ? (totalUnvested / totalValue) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
