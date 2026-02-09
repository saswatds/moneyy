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

  // Batch fetch quotes for all symbols
  const { data: quotesData, isLoading: quotesLoading } = useBatchQuotes(symbols);
  const quotes: Record<string, QuoteResponse> = quotesData || {};

  // Fetch profiles for stocks
  const profileQueries = useQueries({
    queries: stockSymbols.map((symbol) => ({
      queryKey: ['market', 'profile', symbol],
      queryFn: () => apiClient.getSecurityProfile(symbol),
      staleTime: 7 * 24 * 60 * 60 * 1000,
      enabled: !!symbol,
    })),
  });

  const profiles = useMemo(() => {
    const map: Record<string, ProfileResponse> = {};
    profileQueries.forEach((q) => {
      if (q.data) {
        map[q.data.symbol] = q.data;
      }
    });
    return map;
  }, [profileQueries]);

  // Fetch ETF sector data
  const etfSectorQueries = useQueries({
    queries: etfSymbols.map((symbol) => ({
      queryKey: ['market', 'etf', 'sector', symbol],
      queryFn: () => apiClient.getETFSector(symbol),
      staleTime: 24 * 60 * 60 * 1000,
      enabled: !!symbol,
    })),
  });

  const etfSectors = useMemo(() => {
    const map: Record<string, ETFSectorResponse> = {};
    etfSectorQueries.forEach((q) => {
      if (q.data) {
        map[q.data.symbol] = q.data;
      }
    });
    return map;
  }, [etfSectorQueries]);

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
      } else {
        const quote = h.symbol ? quotes[h.symbol] : null;
        value = quote && h.quantity ? quote.price * h.quantity : 0;
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
  }, [holdings, quotes]);

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
  const isLoading = quotesLoading;

  if (symbols.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No securities to analyze. Add stock or ETF holdings to see portfolio analysis.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PortfolioSummaryCards
        holdings={holdings}
        quotes={quotes}
        selectedCurrency={selectedCurrency}
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          Loading market data...
        </div>
      ) : (
        <Tabs defaultValue="holdings">
          <TabsList>
            <TabsTrigger value="holdings">Holdings</TabsTrigger>
            <TabsTrigger value="sectors">Sectors</TabsTrigger>
            <TabsTrigger value="allocation">Allocation</TabsTrigger>
            <TabsTrigger value="geography">Geography</TabsTrigger>
            {etfHoldings.length > 0 && (
              <TabsTrigger value="etfs">ETF Drill-Down</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="holdings">
            <Card>
              <CardHeader>
                <CardTitle>Investment Holdings</CardTitle>
                <CardDescription>
                  Live prices and performance for all securities
                </CardDescription>
              </CardHeader>
              <CardContent>
                <EnrichedHoldingsTable
                  holdings={holdings}
                  quotes={quotes}
                  profiles={profiles}
                  getAccountName={getAccountName}
                />
              </CardContent>
            </Card>
          </TabsContent>

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
        </Tabs>
      )}
    </div>
  );
}
