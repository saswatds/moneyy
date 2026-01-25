import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { IconArrowLeft, IconPlus, IconRefresh } from '@tabler/icons-react';
import { DepreciationChart } from '@/components/DepreciationChart';
import { DepreciationEntryForm } from '@/components/DepreciationEntryForm';
import {
  useAssetDetails,
  useAssetValuation,
  useDepreciationHistory,
  useDepreciationSchedule,
  useSyncAssetBalance,
} from '@/hooks/use-assets';
import { useAccount } from '@/hooks/use-accounts';

export function AssetDashboard() {
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();
  const { data: account } = useAccount(accountId || '');
  const { data: details, isLoading: detailsLoading, isError: detailsError } = useAssetDetails(accountId || '');
  const { data: valuation, refetch: refetchValuation } = useAssetValuation(accountId || '');

  const isManualDepreciation = details?.depreciation_method === 'manual';

  // Only fetch schedule for calculated depreciation methods (and only if details exist)
  const { data: scheduleData } = useDepreciationSchedule(
    accountId || '',
    !!details && !isManualDepreciation
  );

  // Only fetch history for manual depreciation (and only if details exist)
  const { data: historyData } = useDepreciationHistory(
    accountId || '',
    !!details && isManualDepreciation
  );

  const syncBalance = useSyncAssetBalance();

  // Redirect to setup if asset details don't exist
  useEffect(() => {
    if (!detailsLoading && detailsError) {
      navigate(`/accounts/${accountId}/asset/setup`, { replace: true });
    }
  }, [detailsLoading, detailsError, accountId, navigate]);

  const [depreciationDialogOpen, setDepreciationDialogOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: account?.currency || 'CAD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatAssetType = (type: string) => {
    return type.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const handleSyncBalance = async () => {
    if (!accountId) return;

    setSyncing(true);
    try {
      await syncBalance.mutateAsync(accountId);
      alert('Balance synced successfully!');
    } catch (error) {
      console.error('Failed to sync balance:', error);
      alert('Failed to sync balance. Please try again.');
    } finally {
      setSyncing(false);
    }
  };

  const handleDepreciationSuccess = () => {
    setDepreciationDialogOpen(false);
    refetchValuation();
  };

  if (detailsLoading || !details || !valuation) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Loading asset details...</div>
      </div>
    );
  }

  const depreciationPercentage = details.purchase_price > 0
    ? ((valuation.accumulated_depreciation / details.purchase_price) * 100).toFixed(2)
    : 0;

  // Parse type-specific data
  const typeData = details.type_specific_data || {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/accounts')}
          >
            <IconArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Asset Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              {account?.name || 'Asset Details'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {isManualDepreciation && (
            <Dialog open={depreciationDialogOpen} onOpenChange={setDepreciationDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <IconPlus className="h-4 w-4 mr-2" />
                  Record Depreciation
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Record Manual Depreciation</DialogTitle>
                  <DialogDescription>
                    Enter the current value of the asset to record depreciation
                  </DialogDescription>
                </DialogHeader>
                <DepreciationEntryForm
                  accountId={accountId!}
                  purchasePrice={details.purchase_price}
                  onSuccess={handleDepreciationSuccess}
                  onCancel={() => setDepreciationDialogOpen(false)}
                />
              </DialogContent>
            </Dialog>
          )}
          <Button onClick={handleSyncBalance} disabled={syncing}>
            <IconRefresh className="h-4 w-4 mr-2" />
            {syncing ? 'Syncing...' : 'Sync to Balance'}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Current Value</CardDescription>
            <CardTitle className="text-2xl text-green-600 dark:text-green-400">
              {formatCurrency(valuation.current_value)}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Purchase Price</CardDescription>
            <CardTitle className="text-2xl">
              {formatCurrency(details.purchase_price)}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Accumulated Depreciation</CardDescription>
            <CardTitle className="text-2xl text-red-600 dark:text-red-400">
              {formatCurrency(valuation.accumulated_depreciation)}
            </CardTitle>
            <div className="text-xs text-muted-foreground mt-1">
              {depreciationPercentage}% of purchase price
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Net Change</CardDescription>
            <CardTitle className={`text-2xl ${valuation.current_value - details.purchase_price >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {formatCurrency(valuation.current_value - details.purchase_price)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Asset Details */}
      <Card>
        <CardHeader>
          <CardTitle>Asset Information</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Asset Type</span>
            <span className="font-medium">{formatAssetType(details.asset_type)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Depreciation Method</span>
            <span className="font-medium capitalize">
              {details.depreciation_method.replace('_', ' ')}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Purchase Date</span>
            <span className="font-medium">{formatDate(details.purchase_date)}</span>
          </div>
          {details.useful_life_years && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Useful Life</span>
              <span className="font-medium">{details.useful_life_years} years</span>
            </div>
          )}
          {details.salvage_value !== undefined && details.salvage_value > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Salvage Value</span>
              <span className="font-medium">{formatCurrency(details.salvage_value)}</span>
            </div>
          )}
          {details.depreciation_rate && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Depreciation Rate</span>
              <span className="font-medium">{(details.depreciation_rate * 100).toFixed(2)}%</span>
            </div>
          )}

          {/* Type-specific fields */}
          {details.asset_type === 'real_estate' && (
            <>
              {typeData.address && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Address</span>
                  <span className="font-medium">{typeData.address}</span>
                </div>
              )}
              {typeData.city && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">City</span>
                  <span className="font-medium">{typeData.city}</span>
                </div>
              )}
              {typeData.property_type && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Property Type</span>
                  <span className="font-medium">{typeData.property_type}</span>
                </div>
              )}
            </>
          )}

          {details.asset_type === 'vehicle' && (
            <>
              {typeData.make && typeData.model && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Make & Model</span>
                  <span className="font-medium">{typeData.make} {typeData.model}</span>
                </div>
              )}
              {typeData.year && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Year</span>
                  <span className="font-medium">{typeData.year}</span>
                </div>
              )}
              {typeData.vin && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">VIN</span>
                  <span className="font-medium">{typeData.vin}</span>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Depreciation Chart */}
      {!isManualDepreciation && scheduleData?.schedule && scheduleData.schedule.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Depreciation Over Time</CardTitle>
            <CardDescription>
              Projected depreciation schedule showing asset value decline
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DepreciationChart
              schedule={scheduleData.schedule}
              purchasePrice={details.purchase_price}
              purchaseDate={details.purchase_date}
            />
          </CardContent>
        </Card>
      )}

      {/* Depreciation Schedule Table */}
      {!isManualDepreciation && scheduleData?.schedule && scheduleData.schedule.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Depreciation Schedule</CardTitle>
            <CardDescription>
              Year-by-year breakdown of depreciation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                      Year
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                      Date
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                      Depreciation Amount
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                      Accumulated Depreciation
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                      Book Value
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {scheduleData.schedule.slice(0, 10).map((entry) => (
                    <tr key={entry.year} className="border-b border-border last:border-0">
                      <td className="px-4 py-4 text-sm">{entry.year}</td>
                      <td className="px-4 py-4 text-sm">{formatDate(entry.date)}</td>
                      <td className="px-4 py-4 text-sm text-right text-red-600 dark:text-red-400">
                        {formatCurrency(entry.depreciation_amount)}
                      </td>
                      <td className="px-4 py-4 text-sm text-right text-red-600 dark:text-red-400">
                        {formatCurrency(entry.accumulated_depreciation)}
                      </td>
                      <td className="px-4 py-4 text-sm text-right font-medium">
                        {formatCurrency(entry.book_value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {scheduleData.schedule.length > 10 && (
              <div className="text-sm text-muted-foreground text-center mt-4">
                Showing first 10 years of {scheduleData.schedule.length} total years
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Manual Depreciation History */}
      {isManualDepreciation && historyData?.entries && historyData.entries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Depreciation History</CardTitle>
            <CardDescription>
              Manual depreciation entries
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                      Date
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                      Current Value
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                      Accumulated Depreciation
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                      Notes
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {historyData.entries.map((entry) => (
                    <tr key={entry.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-4 text-sm">{formatDate(entry.entry_date)}</td>
                      <td className="px-4 py-4 text-sm text-right font-medium text-green-600 dark:text-green-400">
                        {formatCurrency(entry.current_value)}
                      </td>
                      <td className="px-4 py-4 text-sm text-right text-red-600 dark:text-red-400">
                        {formatCurrency(entry.accumulated_depreciation)}
                      </td>
                      <td className="px-4 py-4 text-sm text-muted-foreground">
                        {entry.notes || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
