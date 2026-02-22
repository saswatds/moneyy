import { useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useBatchQuotes } from '@/hooks/use-market-data';
import { useAPIKeyStatus } from '@/hooks/use-api-keys';
import { useQueries } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Holding, QuoteResponse, ProfileResponse, ETFSectorResponse } from '@/lib/api-client';
import { PortfolioSummaryCards } from './PortfolioSummaryCards';
import { EnrichedHoldingsTable } from './EnrichedHoldingsTable';
import { SectorBreakdownChart } from './SectorBreakdownChart';
import { AssetAllocationChart } from './AssetAllocationChart';
import { GeographicExposureChart } from './GeographicExposureChart';
import { ETFLookThroughTable } from './ETFLookThroughTable';

interface HoldingsAnalysisDashboardProps {
  holdings: Holding[];
  selectedCurrency: string;
  getAccountName: (accountId: string) => string;
}

export function HoldingsAnalysisDashboard({
  holdings,
  selectedCurrency,
  getAccountName,
}: HoldingsAnalysisDashboardProps) {
  // Check if moneyy API key is configured
  const { data: apiKeyStatus } = useAPIKeyStatus('moneyy');
  const hasApiKey = apiKeyStatus?.is_configured === true;

  // Build symbol -> API symbol mapping (e.g. VEQT -> TSX:VEQT)
  const { symbolToApi, apiToSymbol } = useMemo(() => {
    const toApi: Record<string, string> = {};
    const fromApi: Record<string, string> = {};
    holdings.forEach((h) => {
      if (h.symbol && h.type !== 'cash') {
        const apiSym = h.exchange === 'TSX' ? `${h.exchange}:${h.symbol}` : h.symbol;
        toApi[h.symbol] = apiSym;
        fromApi[apiSym] = h.symbol;
      }
    });
    return { symbolToApi: toApi, apiToSymbol: fromApi };
  }, [holdings]);

  // Extract unique symbols (non-cash)
  const symbols = useMemo(() => {
    const syms = new Set<string>();
    holdings.forEach((h) => {
      if (h.symbol && h.type !== 'cash') {
        syms.add(h.symbol);
      }
    });
    return Array.from(syms);
  }, [holdings]);

  const apiSymbols = useMemo(
    () => symbols.map((s) => symbolToApi[s] || s),
    [symbols, symbolToApi],
  );

  const etfSymbols = useMemo(() => {
    const syms = new Set<string>();
    holdings.forEach((h) => {
      if (h.symbol && h.type === 'etf') {
        syms.add(h.symbol);
      }
    });
    return Array.from(syms);
  }, [holdings]);

  const stockSymbols = useMemo(() => {
    const syms = new Set<string>();
    holdings.forEach((h) => {
      if (h.symbol && h.type === 'stock') {
        syms.add(h.symbol);
      }
    });
    return Array.from(syms);
  }, [holdings]);

  // Batch fetch quotes using API symbols (only if API key configured)
  const { data: quotesData, isLoading: quotesLoading } = useBatchQuotes(
    hasApiKey ? apiSymbols : [],
  );

  // Map API response back to original symbols
  const quotes: Record<string, QuoteResponse> = useMemo(() => {
    if (!quotesData) return {};
    const mapped: Record<string, QuoteResponse> = {};
    for (const [key, value] of Object.entries(quotesData)) {
      const originalSymbol = apiToSymbol[key] || key;
      mapped[originalSymbol] = value;
    }
    return mapped;
  }, [quotesData, apiToSymbol]);

  // Fetch profiles for stocks (only if API key configured)
  const profileQueries = useQueries({
    queries: hasApiKey
      ? stockSymbols.map((symbol) => ({
          queryKey: ['market', 'profile', symbolToApi[symbol] || symbol],
          queryFn: () => apiClient.getSecurityProfile(symbolToApi[symbol] || symbol),
          staleTime: 7 * 24 * 60 * 60 * 1000,
          enabled: !!symbol,
        }))
      : [],
  });

  const profiles = useMemo(() => {
    const map: Record<string, ProfileResponse> = {};
    profileQueries.forEach((q) => {
      if (q.data) {
        const originalSymbol = apiToSymbol[q.data.symbol] || q.data.symbol;
        map[originalSymbol] = q.data;
      }
    });
    return map;
  }, [profileQueries, apiToSymbol]);

  // Fetch ETF sector data (only if API key configured)
  const etfSectorQueries = useQueries({
    queries: hasApiKey
      ? etfSymbols.map((symbol) => ({
          queryKey: ['market', 'etf', 'sector', symbolToApi[symbol] || symbol],
          queryFn: () => apiClient.getETFSector(symbolToApi[symbol] || symbol),
          staleTime: 24 * 60 * 60 * 1000,
          enabled: !!symbol,
        }))
      : [],
  });

  const etfSectors = useMemo(() => {
    const map: Record<string, ETFSectorResponse> = {};
    etfSectorQueries.forEach((q) => {
      if (q.data) {
        const originalSymbol = apiToSymbol[q.data.symbol] || q.data.symbol;
        map[originalSymbol] = q.data;
      }
    });
    return map;
  }, [etfSectorQueries, apiToSymbol]);

  const hasMarketData = Object.keys(quotes).length > 0;

  // Compute sector breakdown for the portfolio
  const sectorBreakdown = useMemo(() => {
    const sectors: Record<string, number> = {};
    let totalValue = 0;

    holdings.forEach((h) => {
      if (h.type === 'cash') return;
      const symbol = h.symbol;
      if (!symbol || !h.quantity) return;
      const quote = quotes[symbol];
      if (!quote) return;

      const value = quote.price * h.quantity;
      totalValue += value;

      if (h.type === 'stock') {
        const profile = profiles[symbol];
        const sector = profile?.sector || 'Unknown';
        sectors[sector] = (sectors[sector] || 0) + value;
      } else if (h.type === 'etf') {
        const etfSector = etfSectors[symbol];
        if (etfSector?.sectors) {
          for (const [sectorName, weight] of Object.entries(etfSector.sectors)) {
            sectors[sectorName] = (sectors[sectorName] || 0) + value * (weight / 100);
          }
        } else {
          sectors['ETF (Unknown)'] = (sectors['ETF (Unknown)'] || 0) + value;
        }
      } else {
        const typeName = h.type.charAt(0).toUpperCase() + h.type.slice(1);
        sectors[typeName] = (sectors[typeName] || 0) + value;
      }
    });

    // Convert to percentages
    const result: Record<string, number> = {};
    if (totalValue > 0) {
      for (const [sector, value] of Object.entries(sectors)) {
        result[sector] = (value / totalValue) * 100;
      }
    }
    return result;
  }, [holdings, quotes, profiles, etfSectors]);

  // Compute asset type breakdown
  const typeBreakdown = useMemo(() => {
    const types: Record<string, number> = {};
    let totalValue = 0;

    holdings.forEach((h) => {
      let value = 0;
      if (h.type === 'cash') {
        value = h.amount || 0;
      } else if (hasMarketData) {
        const quote = h.symbol ? quotes[h.symbol] : null;
        value = quote && h.quantity ? quote.price * h.quantity : 0;
      } else {
        // Fall back to cost basis when no market data
        value = h.quantity && h.cost_basis ? h.quantity * h.cost_basis : 0;
      }
      totalValue += value;
      types[h.type] = (types[h.type] || 0) + value;
    });

    const result: Record<string, number> = {};
    if (totalValue > 0) {
      for (const [type, value] of Object.entries(types)) {
        result[type] = (value / totalValue) * 100;
      }
    }
    return result;
  }, [holdings, quotes, hasMarketData]);

  // Compute geographic breakdown from ETF country data and stock profiles
  const geoBreakdown = useMemo(() => {
    const countries: Record<string, number> = {};
    let totalValue = 0;

    holdings.forEach((h) => {
      if (h.type === 'cash') return;
      const symbol = h.symbol;
      if (!symbol || !h.quantity) return;
      const quote = quotes[symbol];
      if (!quote) return;

      const value = quote.price * h.quantity;
      totalValue += value;

      if (h.type === 'stock') {
        const profile = profiles[symbol];
        const country = profile?.country || 'Unknown';
        countries[country] = (countries[country] || 0) + value;
      }
    });

    const result: Record<string, number> = {};
    if (totalValue > 0) {
      for (const [country, value] of Object.entries(countries)) {
        result[country] = (value / totalValue) * 100;
      }
    }
    return result;
  }, [holdings, quotes, profiles]);

  const etfHoldings = holdings.filter((h) => h.type === 'etf');

  if (symbols.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No securities to analyze. Add stock or ETF holdings to see portfolio analysis.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!hasApiKey && (
        <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4 shrink-0">
            <path fillRule="evenodd" d="M6.701 2.25c.577-1 2.02-1 2.598 0l5.196 9a1.5 1.5 0 0 1-1.299 2.25H2.804a1.5 1.5 0 0 1-1.3-2.25l5.197-9ZM8 4a.75.75 0 0 1 .75.75v3a.75.75 0 0 1-1.5 0v-3A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
          </svg>
          Add a Moneyy API key in Settings to see live prices, gain/loss, and detailed analysis.
        </div>
      )}
      <PortfolioSummaryCards
        holdings={holdings}
        quotes={quotes}
        selectedCurrency={selectedCurrency}
      />

      <Tabs defaultValue="holdings">
        <div className="flex items-center gap-3">
        <TabsList>
          <TabsTrigger value="holdings">Holdings</TabsTrigger>
          {hasMarketData && (
            <>
              <TabsTrigger value="sectors">Sectors</TabsTrigger>
              <TabsTrigger value="allocation">Allocation</TabsTrigger>
              <TabsTrigger value="geography">Geography</TabsTrigger>
              {etfHoldings.length > 0 && (
                <TabsTrigger value="etfs">ETF Drill-Down</TabsTrigger>
              )}
            </>
          )}
          {!hasMarketData && (
            <TabsTrigger value="allocation">Allocation</TabsTrigger>
          )}
        </TabsList>
          {hasApiKey && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
              </span>
              {quotesLoading ? 'Fetching live prices...' : 'Live'}
            </div>
          )}
        </div>

        <TabsContent value="holdings">
          <Card>
            <CardHeader>
              <CardTitle>Investment Holdings</CardTitle>
              <CardDescription>
                {hasApiKey && quotesLoading
                  ? 'Loading market data...'
                  : hasMarketData
                    ? 'Live prices and performance for all securities'
                    : 'Holdings by cost basis. Configure Moneyy API key for live prices.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EnrichedHoldingsTable
                holdings={holdings}
                quotes={quotes}
                profiles={profiles}
                getAccountName={getAccountName}
                hasApiKey={hasApiKey}
                quotesLoading={quotesLoading}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {hasMarketData && (
          <>
            <TabsContent value="sectors">
              <Card>
                <CardHeader>
                  <CardTitle>Sector Breakdown</CardTitle>
                  <CardDescription>
                    Portfolio allocation by industry sector (ETFs expanded by their sector weights)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <SectorBreakdownChart sectorData={sectorBreakdown} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="geography">
              <Card>
                <CardHeader>
                  <CardTitle>Geographic Exposure</CardTitle>
                  <CardDescription>
                    Country allocation based on security domicile
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <GeographicExposureChart countryData={geoBreakdown} />
                </CardContent>
              </Card>
            </TabsContent>

            {etfHoldings.length > 0 && (
              <TabsContent value="etfs">
                <Card>
                  <CardHeader>
                    <CardTitle>ETF Drill-Down</CardTitle>
                    <CardDescription>
                      Expand ETFs to see underlying holdings and sector allocation
                    </CardDescription>
                </CardHeader>
                  <CardContent>
                    <ETFLookThroughTable etfHoldings={etfHoldings} quotes={quotes} />
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </>
        )}

        <TabsContent value="allocation">
          <Card>
            <CardHeader>
              <CardTitle>Asset Allocation</CardTitle>
              <CardDescription>
                Portfolio distribution by asset type
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AssetAllocationChart typeBreakdown={typeBreakdown} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
