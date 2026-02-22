import type { QuoteResponse, ProfileResponse, Holding } from '@/lib/api-client';

interface EnrichedHoldingsTableProps {
  holdings: Holding[];
  quotes: Record<string, QuoteResponse>;
  profiles: Record<string, ProfileResponse>;
  getAccountName: (accountId: string) => string;
  hasApiKey?: boolean;
  quotesLoading?: boolean;
}

export function EnrichedHoldingsTable({ holdings, quotes, profiles, getAccountName, hasApiKey, quotesLoading }: EnrichedHoldingsTableProps) {
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
              const costBasisTotal = costBasis * quantity;
              const marketValue = quote ? quote.price * quantity : 0;
              const gainLoss = quote ? marketValue - costBasisTotal : 0;
              const gainLossPercent = costBasisTotal > 0 ? (gainLoss / costBasisTotal) * 100 : 0;
              const dayChange = quote ? quote.change * quantity : 0;
              // Symbol failed to fetch if API key is set, quotes finished loading, but this symbol has no quote
              const quoteFailed = hasApiKey && !quotesLoading && !quote;

              return (
                <tr key={holding.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                  <td className="px-4 py-4 text-sm font-medium">
                    <div className="flex items-center gap-1.5">
                      {symbol}
                      {holding.exchange && (
                        <span className="text-[10px] font-normal text-muted-foreground">{holding.exchange}</span>
                      )}
                      {quoteFailed && (
                        <span title={`Failed to fetch market data for ${symbol}`} className="text-red-500 dark:text-red-400">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                            <path fillRule="evenodd" d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14ZM8 4a.75.75 0 0 1 .75.75v3a.75.75 0 0 1-1.5 0v-3A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
                          </svg>
                        </span>
                      )}
                    </div>
                  </td>
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
                    {quote ? formatCurrency(marketValue) : costBasisTotal > 0 ? (
                      <span className="text-muted-foreground" title="Cost basis (no live price)">
                        {formatCurrency(costBasisTotal)}
                      </span>
                    ) : '-'}
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
  const quantity = holding.quantity || 0;
  if (quote) return quote.price * quantity;
  // Fall back to cost basis value for sorting
  return (holding.cost_basis || 0) * quantity;
}
