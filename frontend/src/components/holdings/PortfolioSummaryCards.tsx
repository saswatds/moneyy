import {
  Card,
  CardDescription,
  CardHeader,
} from '@/components/ui/card';
import { Currency } from '@/components/ui/currency';
import type { QuoteResponse, Holding } from '@/lib/api-client';

interface PortfolioSummaryCardsProps {
  holdings: Holding[];
  quotes: Record<string, QuoteResponse>;
  selectedCurrency: string;
}

export function PortfolioSummaryCards({ holdings, quotes, selectedCurrency }: PortfolioSummaryCardsProps) {
  let totalMarketValue = 0;
  let totalCostBasis = 0;
  let totalDayChange = 0;

  holdings.forEach((h) => {
    if (h.type === 'cash' && h.amount) {
      totalMarketValue += h.amount;
      totalCostBasis += h.amount;
      return;
    }

    const symbol = h.symbol;
    if (!symbol || !h.quantity) return;

    const quote = quotes[symbol];
    if (quote) {
      const marketValue = quote.price * h.quantity;
      totalMarketValue += marketValue;
      totalDayChange += quote.change * h.quantity;
    }

    if (h.cost_basis) {
      totalCostBasis += h.cost_basis;
    }
  });

  const totalGainLoss = totalMarketValue - totalCostBasis;
  const totalGainLossPercent = totalCostBasis > 0 ? (totalGainLoss / totalCostBasis) * 100 : 0;
  const dayChangePercent = totalMarketValue > 0 ? (totalDayChange / (totalMarketValue - totalDayChange)) * 100 : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="pb-3">
          <CardDescription>Market Value</CardDescription>
          <div className="mt-2">
            <div className="text-3xl font-bold tabular-nums text-green-600 dark:text-green-400">
              <Currency amount={totalMarketValue} smallCents />
            </div>
            <div className="text-sm text-muted-foreground mt-1">{selectedCurrency}</div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardDescription>Cost Basis</CardDescription>
          <div className="mt-2">
            <div className="text-3xl font-bold tabular-nums">
              <Currency amount={totalCostBasis} smallCents />
            </div>
            <div className="text-sm text-muted-foreground mt-1">{selectedCurrency}</div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardDescription>Total Gain/Loss</CardDescription>
          <div className="mt-2">
            <div className={`text-3xl font-bold tabular-nums ${totalGainLoss >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              <Currency amount={totalGainLoss} smallCents colored />
            </div>
            <div className={`text-sm mt-1 ${totalGainLossPercent >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {totalGainLossPercent >= 0 ? '+' : ''}{totalGainLossPercent.toFixed(2)}%
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardDescription>Day Change</CardDescription>
          <div className="mt-2">
            <div className={`text-3xl font-bold tabular-nums ${totalDayChange >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              <Currency amount={totalDayChange} smallCents colored />
            </div>
            <div className={`text-sm mt-1 ${dayChangePercent >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {dayChangePercent >= 0 ? '+' : ''}{dayChangePercent.toFixed(2)}%
            </div>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}
