import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAssetsSummary } from '@/hooks/use-assets';
import { useExchangeRates } from '@/hooks/use-exchange-rates';
import { useAccounts } from '@/hooks/use-accounts';
import { useAllHoldings } from '@/hooks/use-holdings';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Currency } from '@/components/ui/currency';
import { HoldingsAnalysisDashboard } from '@/components/holdings/HoldingsAnalysisDashboard';
import type { AssetWithCurrentValue } from '@/lib/api-client';

export function Assets() {
  const navigate = useNavigate();
  const { data: assetsData, isLoading } = useAssetsSummary();
  const { data: accountsData } = useAccounts();
  const { data: exchangeRates } = useExchangeRates();
  const [selectedCurrency, setSelectedCurrency] = useState<string>('CAD');
  const [filterType, setFilterType] = useState<string>('all');

  // Fetch all holdings from all accounts
  const accountIds = accountsData?.accounts.map(a => a.id) || [];
  const { holdings: allHoldings, isLoading: holdingsLoading } = useAllHoldings(accountIds);

  // Keep formatCurrency for use with specific currency symbols in tables
  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const formatAssetType = (type: string) => {
    return type.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const getAssetTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'real_estate':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'vehicle':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
      case 'collectible':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
      case 'equipment':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  const convertAmount = (amount: number, fromCurrency: string, toCurrency: string) => {
    if (!exchangeRates?.rates || fromCurrency === toCurrency) {
      return null;
    }
    const rate = exchangeRates.rates[fromCurrency]?.[toCurrency];
    if (!rate) return null;
    return amount * rate;
  };

  const getAccountCurrency = (accountId: string) => {
    const account = accountsData?.accounts.find(a => a.id === accountId);
    return account?.currency || 'CAD';
  };

  const getAccountName = (accountId: string) => {
    const account = accountsData?.accounts.find(a => a.id === accountId);
    return account?.name || 'Unknown Account';
  };

  const calculateTotals = () => {
    if (!assetsData?.assets || !exchangeRates?.rates) {
      return {
        totalValue: 0,
        totalDepreciation: 0,
        totalPurchasePrice: 0,
      };
    }

    let totalValue = 0;
    let totalDepreciation = 0;
    let totalPurchasePrice = 0;

    assetsData.assets.forEach((asset: AssetWithCurrentValue) => {
      const accountCurrency = getAccountCurrency(asset.account_id);

      let currentValueInSelected = asset.current_value;
      let purchasePriceInSelected = asset.purchase_price;
      let depreciationInSelected = asset.accumulated_depreciation;

      if (accountCurrency !== selectedCurrency) {
        const convertedValue = convertAmount(asset.current_value, accountCurrency, selectedCurrency);
        const convertedPurchase = convertAmount(asset.purchase_price, accountCurrency, selectedCurrency);
        const convertedDep = convertAmount(asset.accumulated_depreciation, accountCurrency, selectedCurrency);

        if (convertedValue !== null) currentValueInSelected = convertedValue;
        if (convertedPurchase !== null) purchasePriceInSelected = convertedPurchase;
        if (convertedDep !== null) depreciationInSelected = convertedDep;
      }

      totalValue += currentValueInSelected;
      totalDepreciation += depreciationInSelected;
      totalPurchasePrice += purchasePriceInSelected;
    });

    return { totalValue, totalDepreciation, totalPurchasePrice };
  };

  const filteredAssets = assetsData?.assets.filter((asset: AssetWithCurrentValue) => {
    if (filterType === 'all') return true;
    return asset.asset_type === filterType;
  }) || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Loading assets...</div>
      </div>
    );
  }

  const { totalValue, totalDepreciation, totalPurchasePrice } = calculateTotals();
  const netGainLoss = totalValue - totalPurchasePrice;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Assets</h1>
          <p className="text-muted-foreground mt-2">
            Track physical assets and analyze investment holdings
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">View in:</span>
            <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CAD">CAD</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="INR">INR</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Asset Value</CardDescription>
            <div className="mt-2">
              <div className="text-3xl font-bold tabular-nums text-green-600 dark:text-green-400">
                <Currency amount={totalValue} smallCents />
              </div>
              <div className="text-sm text-muted-foreground mt-1">{selectedCurrency}</div>
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Purchase Price</CardDescription>
            <div className="mt-2">
              <div className="text-3xl font-bold tabular-nums">
                <Currency amount={totalPurchasePrice} smallCents />
              </div>
              <div className="text-sm text-muted-foreground mt-1">{selectedCurrency}</div>
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Depreciation</CardDescription>
            <div className="mt-2">
              <div className="text-3xl font-bold tabular-nums text-red-600 dark:text-red-400">
                <Currency amount={totalDepreciation} smallCents />
              </div>
              <div className="text-sm text-muted-foreground mt-1">{selectedCurrency}</div>
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Net Gain/Loss</CardDescription>
            <div className="mt-2">
              <div className={`text-3xl font-bold tabular-nums ${netGainLoss >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                <Currency amount={netGainLoss} smallCents colored />
              </div>
              <div className="text-sm text-muted-foreground mt-1">{selectedCurrency}</div>
            </div>
          </CardHeader>
        </Card>
      </div>

      {/* Assets Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Asset Portfolio</CardTitle>
              <CardDescription className="mt-1.5">
                All your assets with current valuations and depreciation
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Filter:</span>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Assets</SelectItem>
                  <SelectItem value="real_estate">Real Estate</SelectItem>
                  <SelectItem value="vehicle">Vehicles</SelectItem>
                  <SelectItem value="collectible">Collectibles</SelectItem>
                  <SelectItem value="equipment">Equipment</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Account
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Depreciation Method
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                    Purchase Price
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                    Current Value
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                    Depreciation
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                    Purchase Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAssets.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center">
                      <div className="text-muted-foreground">
                        No assets found. Create an asset account to get started.
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredAssets.map((asset: AssetWithCurrentValue) => {
                    const accountCurrency = getAccountCurrency(asset.account_id);
                    let currentValue = asset.current_value;
                    let purchasePrice = asset.purchase_price;
                    let depreciation = asset.accumulated_depreciation;

                    if (accountCurrency !== selectedCurrency) {
                      const convertedValue = convertAmount(asset.current_value, accountCurrency, selectedCurrency);
                      const convertedPurchase = convertAmount(asset.purchase_price, accountCurrency, selectedCurrency);
                      const convertedDep = convertAmount(asset.accumulated_depreciation, accountCurrency, selectedCurrency);

                      if (convertedValue !== null) currentValue = convertedValue;
                      if (convertedPurchase !== null) purchasePrice = convertedPurchase;
                      if (convertedDep !== null) depreciation = convertedDep;
                    }

                    return (
                      <tr
                        key={asset.id}
                        className="border-b border-border last:border-0 cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/accounts/${asset.account_id}/asset`)}
                      >
                        <td className="px-4 py-4">
                          <div className="text-sm font-medium">
                            {getAccountName(asset.account_id)}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`px-2 py-1 text-xs font-medium rounded ${getAssetTypeBadgeClass(asset.asset_type)}`}>
                            {formatAssetType(asset.asset_type)}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-sm capitalize">
                            {asset.depreciation_method.replace('_', ' ')}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right">
                          {accountCurrency === selectedCurrency ? (
                            <div className="text-sm">{formatCurrency(asset.purchase_price, accountCurrency)}</div>
                          ) : (
                            <div>
                              <div className="text-sm">{formatCurrency(purchasePrice, selectedCurrency)}</div>
                              <div className="text-xs text-muted-foreground">
                                {formatCurrency(asset.purchase_price, accountCurrency)}
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4 text-right">
                          {accountCurrency === selectedCurrency ? (
                            <div className="text-sm font-medium text-green-600 dark:text-green-400">
                              {formatCurrency(asset.current_value, accountCurrency)}
                            </div>
                          ) : (
                            <div>
                              <div className="text-sm font-medium text-green-600 dark:text-green-400">
                                {formatCurrency(currentValue, selectedCurrency)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {formatCurrency(asset.current_value, accountCurrency)}
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4 text-right">
                          {accountCurrency === selectedCurrency ? (
                            <div className="text-sm text-red-600 dark:text-red-400">
                              {formatCurrency(asset.accumulated_depreciation, accountCurrency)}
                            </div>
                          ) : (
                            <div>
                              <div className="text-sm text-red-600 dark:text-red-400">
                                {formatCurrency(depreciation, selectedCurrency)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {formatCurrency(asset.accumulated_depreciation, accountCurrency)}
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="text-sm">
                            {new Date(asset.purchase_date).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Holdings Analysis Dashboard */}
      {holdingsLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Loading holdings...</div>
        </div>
      ) : allHoldings.length > 0 ? (
        <HoldingsAnalysisDashboard
          holdings={allHoldings}
          selectedCurrency={selectedCurrency}
          getAccountName={getAccountName}
        />
      ) : null}
    </div>
  );
}
