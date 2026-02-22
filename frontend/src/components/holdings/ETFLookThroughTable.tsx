import { useState } from 'react';
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react';
import { useETFHoldings, useETFSector } from '@/hooks/use-market-data';
import type { Holding, QuoteResponse } from '@/lib/api-client';
import { SectorBreakdownChart } from './SectorBreakdownChart';

interface ETFLookThroughTableProps {
  etfHoldings: Holding[];
  quotes: Record<string, QuoteResponse>;
}

export function ETFLookThroughTable({ etfHoldings, quotes }: ETFLookThroughTableProps) {
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);

  if (etfHoldings.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        No ETF holdings in your portfolio.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {etfHoldings.map((holding) => {
        const symbol = holding.symbol || '';
        const isExpanded = expandedSymbol === symbol;
        const quote = quotes[symbol];
        const marketValue = quote && holding.quantity ? quote.price * holding.quantity : 0;

        return (
          <div key={holding.id} className="border border-border rounded-lg">
            <button
              onClick={() => setExpandedSymbol(isExpanded ? null : symbol)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                {isExpanded ? (
                  <IconChevronDown className="size-4 text-muted-foreground" />
                ) : (
                  <IconChevronRight className="size-4 text-muted-foreground" />
                )}
                <span className="font-medium text-sm">
                  {symbol}
                  {holding.exchange && (
                    <span className="text-[10px] font-normal text-muted-foreground ml-1">{holding.exchange}</span>
                  )}
                </span>
                <span className="text-sm text-muted-foreground">
                  {holding.quantity?.toLocaleString('en-US', { minimumFractionDigits: 2 })} shares
                </span>
              </div>
              <div className="text-sm font-medium">
                {marketValue > 0
                  ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(marketValue)
                  : '-'}
              </div>
            </button>
            {isExpanded && <ETFDetail symbol={holding.exchange === 'TSX' ? `TSX:${symbol}` : symbol} />}
          </div>
        );
      })}
    </div>
  );
}

function ETFDetail({ symbol }: { symbol: string }) {
  const { data: holdingsData, isLoading: holdingsLoading } = useETFHoldings(symbol);
  const { data: sectorData, isLoading: sectorLoading } = useETFSector(symbol);

  if (holdingsLoading || sectorLoading) {
    return (
      <div className="px-4 py-6 text-center text-muted-foreground border-t border-border">
        Loading ETF data...
      </div>
    );
  }

  return (
    <div className="border-t border-border px-4 py-4 space-y-4">
      {sectorData?.sectors && Object.keys(sectorData.sectors).length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">Sector Allocation</h4>
          <SectorBreakdownChart sectorData={sectorData.sectors} />
        </div>
      )}

      {holdingsData?.holdings && holdingsData.holdings.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">Top Holdings</h4>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Symbol</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Name</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Weight</th>
                </tr>
              </thead>
              <tbody>
                {holdingsData.holdings.map((h, idx) => (
                  <tr key={idx} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 text-xs font-medium">{h.symbol}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{h.name}</td>
                    <td className="px-3 py-2 text-right text-xs">{h.weight.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(!holdingsData?.holdings || holdingsData.holdings.length === 0) &&
       (!sectorData?.sectors || Object.keys(sectorData.sectors).length === 0) && (
        <div className="text-center text-muted-foreground text-sm py-4">
          No detailed data available for this ETF.
        </div>
      )}
    </div>
  );
}
