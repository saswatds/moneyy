import type { QuoteResponse, ProfileResponse, Holding } from '@/lib/api-client';

interface EnrichedHoldingsTableProps {
  holdings: Holding[];
  quotes: Record<string, QuoteResponse>;
  profiles: Record<string, ProfileResponse>;
  getAccountName: (accountId: string) => string;
}

export function EnrichedHoldingsTable({ holdings, quotes, profiles, getAccountName }: EnrichedHoldingsTableProps) {
  const formatCurrency = (amount: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  const sortedHoldings = [...holdings].sort((a, b) => {
    const aValue = getMarketValue(a, quotes);
    const bValue = getMarketValue(b, quotes);
    return bValue - aValue;
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Symbol</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Name</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Account</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Type</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Sector</th>
            <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Quantity</th>
            <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Price</th>
            <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Day Change</th>
            <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Market Value</th>
            <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Gain/Loss</th>
          </tr>
        </thead>
        <tbody>
          {sortedHoldings.length === 0 ? (
            <tr>
              <td colSpan={10} className="px-4 py-12 text-center">
                <div className="text-muted-foreground">No holdings found.</div>
              </td>
            </tr>
          ) : (
            sortedHoldings.map((holding) => {
              if (holding.type === 'cash') {
                return (
                  <tr key={holding.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="px-4 py-4 text-sm font-medium">{holding.currency}</td>
                    <td className="px-4 py-4 text-sm text-muted-foreground">Cash</td>
                    <td className="px-4 py-4 text-sm">{getAccountName(holding.account_id)}</td>
                    <td className="px-4 py-4">
                      <span className="px-2 py-1 text-xs font-medium rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                        cash
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-muted-foreground">-</td>
                    <td className="px-4 py-4 text-right text-sm text-muted-foreground">-</td>
                    <td className="px-4 py-4 text-right text-sm text-muted-foreground">-</td>
                    <td className="px-4 py-4 text-right text-sm text-muted-foreground">-</td>
                    <td className="px-4 py-4 text-right text-sm font-medium">
                      {holding.amount ? formatCurrency(holding.amount, holding.currency || 'CAD') : '-'}
                    </td>
                    <td className="px-4 py-4 text-right text-sm text-muted-foreground">-</td>
                  </tr>
                );
              }

              const symbol = holding.symbol || '';
              const quote = quotes[symbol];
              const profile = profiles[symbol];
              const quantity = holding.quantity || 0;
              const costBasis = holding.cost_basis || 0;
              const marketValue = quote ? quote.price * quantity : 0;
              const gainLoss = quote ? marketValue - costBasis : 0;
              const gainLossPercent = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0;
              const dayChange = quote ? quote.change * quantity : 0;

              return (
                <tr key={holding.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                  <td className="px-4 py-4 text-sm font-medium">{symbol}</td>
                  <td className="px-4 py-4 text-sm text-muted-foreground">
                    {profile?.name || symbol}
                  </td>
                  <td className="px-4 py-4 text-sm">{getAccountName(holding.account_id)}</td>
                  <td className="px-4 py-4">
                    <span className="px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                      {holding.type}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-muted-foreground">
                    {profile?.sector || '-'}
                  </td>
                  <td className="px-4 py-4 text-right text-sm">
                    {quantity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                  </td>
                  <td className="px-4 py-4 text-right text-sm">
                    {quote ? formatCurrency(quote.price) : '-'}
                  </td>
                  <td className="px-4 py-4 text-right text-sm">
                    {quote ? (
                      <span className={quote.change >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                        {quote.change >= 0 ? '+' : ''}{formatCurrency(dayChange)}
                        <span className="text-xs ml-1">
                          ({quote.change_percent >= 0 ? '+' : ''}{quote.change_percent.toFixed(2)}%)
                        </span>
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-4 text-right text-sm font-medium">
                    {quote ? formatCurrency(marketValue) : '-'}
                  </td>
                  <td className="px-4 py-4 text-right text-sm">
                    {quote ? (
                      <span className={gainLoss >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                        {gainLoss >= 0 ? '+' : ''}{formatCurrency(gainLoss)}
                        <span className="text-xs ml-1">
                          ({gainLossPercent >= 0 ? '+' : ''}{gainLossPercent.toFixed(2)}%)
                        </span>
                      </span>
                    ) : '-'}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function getMarketValue(holding: Holding, quotes: Record<string, QuoteResponse>): number {
  if (holding.type === 'cash') return holding.amount || 0;
  const quote = holding.symbol ? quotes[holding.symbol] : null;
  if (!quote || !holding.quantity) return 0;
  return quote.price * holding.quantity;
}
