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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  IconArrowLeft,
  IconPlus,
  IconChartPie,
  IconCalendar,
  IconReceipt,
  IconCoin,
} from '@tabler/icons-react';
import { useAccount } from '@/hooks/use-accounts';
import { useExchangeRates } from '@/hooks/use-exchange-rates';
import {
  useOptionsSummary,
  useUpcomingVestingEvents,
  useTaxSummary,
  useSales,
  useAllExercises,
  useDeleteEquityGrant,
} from '@/hooks/use-options';
import type { EquityGrantWithSummary } from '@/lib/api-client';
import { formatCurrency, convertCurrency, aggregateToCAD } from '@/lib/currency';
import { GrantForm } from '@/components/options/GrantForm';
import { FMVForm } from '@/components/options/FMVForm';
import { ExerciseForm } from '@/components/options/ExerciseForm';
import { SaleForm } from '@/components/options/SaleForm';
import { VestingScheduleForm } from '@/components/options/VestingScheduleForm';
import { VestingScheduleChart } from '@/components/options/VestingScheduleChart';
import { OptionsValueChart } from '@/components/options/OptionsValueChart';
import { TaxSummaryCard } from '@/components/options/TaxSummaryCard';
import { GrantsTable } from '@/components/options/GrantsTable';
import { SalesTable } from '@/components/options/SalesTable';
import { ExercisesTable } from '@/components/options/ExercisesTable';

export function OptionsDashboard() {
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();
  const { data: account } = useAccount(accountId || '');
  const { data: summary, isLoading: summaryLoading, isError: summaryError } = useOptionsSummary(accountId || '');
  const { data: upcomingEvents } = useUpcomingVestingEvents(accountId || '', 365);
  const { data: taxSummary, isLoading: taxLoading, isError: taxError } = useTaxSummary(accountId || '', new Date().getFullYear());
  const { data: salesData } = useSales(accountId || '');
  const { data: exercisesData } = useAllExercises(accountId || '');
  const { data: exchangeRates } = useExchangeRates();

  const [grantDialogOpen, setGrantDialogOpen] = useState(false);
  const [editGrantDialogOpen, setEditGrantDialogOpen] = useState(false);
  const [vestingDialogOpen, setVestingDialogOpen] = useState(false);
  const [fmvDialogOpen, setFmvDialogOpen] = useState(false);
  const [exerciseDialogOpen, setExerciseDialogOpen] = useState(false);
  const [saleDialogOpen, setSaleDialogOpen] = useState(false);
  const [selectedGrantId, setSelectedGrantId] = useState<string | null>(null);
  const [editingGrant, setEditingGrant] = useState<EquityGrantWithSummary | null>(null);
  const [vestingGrant, setVestingGrant] = useState<EquityGrantWithSummary | null>(null);

  const deleteGrant = useDeleteEquityGrant(accountId || '');

  // Redirect to setup if no grants exist
  useEffect(() => {
    if (!summaryLoading && (summaryError || (summary && summary.total_grants === 0))) {
      navigate(`/accounts/${accountId}/options/setup`, { replace: true });
    }
  }, [summaryLoading, summaryError, summary, accountId, navigate]);

  // Get currencies from the summary
  const currencies = summary?.by_currency ? Object.keys(summary.by_currency) : [];
  const hasMultipleCurrencies = currencies.length > 1;

  // Calculate total CAD value across all currencies
  const totalVestedCAD = summary?.by_currency
    ? aggregateToCAD(
        Object.entries(summary.by_currency).map(([curr, data]) => ({
          amount: data.vested_value,
          currency: curr,
        })),
        exchangeRates
      )
    : 0;

  const totalUnvestedCAD = summary?.by_currency
    ? aggregateToCAD(
        Object.entries(summary.by_currency).map(([curr, data]) => ({
          amount: data.unvested_value,
          currency: curr,
        })),
        exchangeRates
      )
    : 0;

  const totalIntrinsicCAD = summary?.by_currency
    ? aggregateToCAD(
        Object.entries(summary.by_currency).map(([curr, data]) => ({
          amount: data.total_intrinsic_value,
          currency: curr,
        })),
        exchangeRates
      )
    : 0;

  const handleGrantSuccess = () => {
    setGrantDialogOpen(false);
  };

  const handleFMVSuccess = () => {
    setFmvDialogOpen(false);
  };

  const handleExerciseSuccess = () => {
    setExerciseDialogOpen(false);
    setSelectedGrantId(null);
  };

  const handleSaleSuccess = () => {
    setSaleDialogOpen(false);
  };

  const handleExerciseClick = (grantId: string) => {
    setSelectedGrantId(grantId);
    setExerciseDialogOpen(true);
  };

  const handleEditClick = (grant: EquityGrantWithSummary) => {
    setEditingGrant(grant);
    setEditGrantDialogOpen(true);
  };

  const handleEditSuccess = () => {
    setEditGrantDialogOpen(false);
    setEditingGrant(null);
  };

  const handleDeleteClick = async (grantId: string) => {
    if (window.confirm('Are you sure you want to delete this grant? This action cannot be undone.')) {
      try {
        await deleteGrant.mutateAsync(grantId);
      } catch (err) {
        console.error('Failed to delete grant:', err);
      }
    }
  };

  const handleSetVestingClick = (grant: EquityGrantWithSummary) => {
    setVestingGrant(grant);
    setVestingDialogOpen(true);
  };

  const handleVestingSuccess = () => {
    setVestingDialogOpen(false);
    setVestingGrant(null);
  };

  if (summaryLoading || !summary) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Loading options data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
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
            <h1 className="text-3xl font-bold tracking-tight">Stock Options</h1>
            <p className="text-muted-foreground mt-1">
              {account?.name || 'Equity Compensation'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Dialog open={fmvDialogOpen} onOpenChange={setFmvDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <IconCoin className="h-4 w-4 mr-2" />
                Update FMV
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Update Fair Market Value</DialogTitle>
                <DialogDescription>
                  Enter the current FMV per share for valuation
                </DialogDescription>
              </DialogHeader>
              <FMVForm
                accountId={accountId!}
                onSuccess={handleFMVSuccess}
                onCancel={() => setFmvDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>

          <Dialog open={grantDialogOpen} onOpenChange={setGrantDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <IconPlus className="h-4 w-4 mr-2" />
                Add Grant
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add Equity Grant</DialogTitle>
                <DialogDescription>
                  Add a new stock option, RSU, or RSA grant
                </DialogDescription>
              </DialogHeader>
              <GrantForm
                accountId={accountId!}
                onSuccess={handleGrantSuccess}
                onCancel={() => setGrantDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Total CAD Summary - shown when multiple currencies */}
      {hasMultipleCurrencies && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
          <div className="text-center">
            <div className="text-sm text-muted-foreground">Total Vested (CAD)</div>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {formatCurrency(totalVestedCAD, 'CAD')}
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm text-muted-foreground">Total Unvested (CAD)</div>
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              {formatCurrency(totalUnvestedCAD, 'CAD')}
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm text-muted-foreground">Total Intrinsic (CAD)</div>
            <div className="text-2xl font-bold">
              {formatCurrency(totalIntrinsicCAD, 'CAD')}
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      {summary.by_currency && currencies.length > 0 ? (
        // Per-currency summary cards
        <div className="space-y-4">
          {currencies.map(currency => {
            const currData = summary.by_currency![currency];
            const vestedCAD = convertCurrency(currData.vested_value, currency, 'CAD', exchangeRates);
            const unvestedCAD = convertCurrency(currData.unvested_value, currency, 'CAD', exchangeRates);
            const intrinsicCAD = convertCurrency(currData.total_intrinsic_value, currency, 'CAD', exchangeRates);
            const showCAD = currency !== 'CAD';

            return (
              <div key={currency} className="space-y-2">
                {hasMultipleCurrencies && (
                  <h3 className="text-sm font-semibold text-muted-foreground">{currency}</h3>
                )}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardDescription>Vested Value</CardDescription>
                      <CardTitle className="text-2xl text-green-600 dark:text-green-400">
                        {formatCurrency(currData.vested_value, currency)}
                      </CardTitle>
                      {showCAD && (
                        <div className="text-sm text-muted-foreground">
                          ≈ {formatCurrency(vestedCAD, 'CAD')}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground mt-1">
                        {currData.vested_shares.toLocaleString()} shares
                      </div>
                    </CardHeader>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardDescription>Unvested Value</CardDescription>
                      <CardTitle className="text-2xl text-yellow-600 dark:text-yellow-400">
                        {formatCurrency(currData.unvested_value, currency)}
                      </CardTitle>
                      {showCAD && (
                        <div className="text-sm text-muted-foreground">
                          ≈ {formatCurrency(unvestedCAD, 'CAD')}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground mt-1">
                        {currData.unvested_shares.toLocaleString()} shares
                      </div>
                    </CardHeader>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardDescription>Intrinsic Value</CardDescription>
                      <CardTitle className="text-2xl">
                        {formatCurrency(currData.total_intrinsic_value, currency)}
                      </CardTitle>
                      {showCAD && (
                        <div className="text-sm text-muted-foreground">
                          ≈ {formatCurrency(intrinsicCAD, 'CAD')}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground mt-1">
                        Unrealized gain if exercised today
                      </div>
                    </CardHeader>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardDescription>Current FMV ({currency})</CardDescription>
                      <CardTitle className="text-2xl">
                        {currData.current_fmv ? formatCurrency(currData.current_fmv, currency) : 'Not Set'}
                      </CardTitle>
                      <div className="text-xs text-muted-foreground mt-1">
                        Per share
                      </div>
                    </CardHeader>
                  </Card>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // Fallback for legacy data without currency breakdown
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Vested Value</CardDescription>
              <CardTitle className="text-2xl text-green-600 dark:text-green-400">
                {formatCurrency(summary.vested_value, 'USD')}
              </CardTitle>
              <div className="text-xs text-muted-foreground mt-1">
                {summary.vested_shares.toLocaleString()} shares
              </div>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Unvested Value</CardDescription>
              <CardTitle className="text-2xl text-yellow-600 dark:text-yellow-400">
                {formatCurrency(summary.unvested_value, 'USD')}
              </CardTitle>
              <div className="text-xs text-muted-foreground mt-1">
                {summary.unvested_shares.toLocaleString()} shares
              </div>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Intrinsic Value</CardDescription>
              <CardTitle className="text-2xl">
                {formatCurrency(summary.total_intrinsic_value, 'USD')}
              </CardTitle>
              <div className="text-xs text-muted-foreground mt-1">
                Unrealized gain if exercised today
              </div>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Current FMV</CardDescription>
              <CardTitle className="text-2xl">
                {summary.current_fmv ? formatCurrency(summary.current_fmv, 'USD') : 'Not Set'}
              </CardTitle>
              <div className="text-xs text-muted-foreground mt-1">
                Per share
              </div>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="grants" className="space-y-4">
        <TabsList>
          <TabsTrigger value="grants" className="flex items-center gap-2">
            <IconChartPie className="h-4 w-4" />
            Grants
          </TabsTrigger>
          <TabsTrigger value="vesting" className="flex items-center gap-2">
            <IconCalendar className="h-4 w-4" />
            Vesting Timeline
          </TabsTrigger>
          <TabsTrigger value="transactions" className="flex items-center gap-2">
            <IconReceipt className="h-4 w-4" />
            Transactions
          </TabsTrigger>
          <TabsTrigger value="tax" className="flex items-center gap-2">
            <IconCoin className="h-4 w-4" />
            Tax Planning
          </TabsTrigger>
        </TabsList>

        <TabsContent value="grants" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Equity Grants</CardTitle>
                  <CardDescription>
                    All your stock options, RSUs, and RSAs
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <GrantsTable
                    grants={summary.grants}
                    onExercise={handleExerciseClick}
                    onEdit={handleEditClick}
                    onDelete={handleDeleteClick}
                    onSetVesting={handleSetVestingClick}
                  />
                </CardContent>
              </Card>
            </div>
            <div>
              <OptionsValueChart
                grants={summary.grants}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="vesting" className="space-y-4">
          <VestingScheduleChart
            events={upcomingEvents?.events || []}
            grants={summary.grants}
          />
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4">
          <div className="flex justify-end mb-4">
            <Dialog open={saleDialogOpen} onOpenChange={setSaleDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <IconPlus className="h-4 w-4 mr-2" />
                  Record Sale
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Record Share Sale</DialogTitle>
                  <DialogDescription>
                    Record a sale of shares
                  </DialogDescription>
                </DialogHeader>
                <SaleForm
                  accountId={accountId!}
                  grants={summary.grants}
                  onSuccess={handleSaleSuccess}
                  onCancel={() => setSaleDialogOpen(false)}
                />
              </DialogContent>
            </Dialog>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Exercise History</CardTitle>
              <CardDescription>
                Record of all option exercises
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ExercisesTable
                exercises={exercisesData?.exercises || []}
                grants={summary.grants}
                accountId={accountId!}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Sales History</CardTitle>
              <CardDescription>
                Record of all share sales
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SalesTable
                sales={salesData?.sales || []}
                grants={summary.grants}
                accountId={accountId!}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tax" className="space-y-4">
          {(() => {
            // Check if tax summary has meaningful data
            const hasTaxData = taxSummary && (
              taxSummary.total_taxable_benefit > 0 ||
              taxSummary.total_capital_gains !== 0 ||
              (taxSummary.by_currency && Object.keys(taxSummary.by_currency).length > 0)
            );

            if (taxLoading) {
              return (
                <Card>
                  <CardHeader>
                    <CardTitle>Tax Planning</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8 text-muted-foreground">
                      Loading tax data...
                    </div>
                  </CardContent>
                </Card>
              );
            }

            if (taxError) {
              return (
                <Card>
                  <CardHeader>
                    <CardTitle>Tax Planning</CardTitle>
                    <CardDescription>
                      Tax implications from exercises and sales
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8 text-muted-foreground">
                      <p>Unable to load tax data.</p>
                      <p className="text-sm mt-2">
                        Please try refreshing the page.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            }

            if (hasTaxData) {
              return <TaxSummaryCard summary={taxSummary!} />;
            }

            return (
              <Card>
                <CardHeader>
                  <CardTitle>Tax Planning</CardTitle>
                  <CardDescription>
                    Tax implications from exercises and sales
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No tax data available for {new Date().getFullYear()}.</p>
                    <p className="text-sm mt-2">
                      Record option exercises or share sales to see tax planning information.
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })()}
        </TabsContent>
      </Tabs>

      {/* Exercise Dialog */}
      <Dialog open={exerciseDialogOpen} onOpenChange={setExerciseDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Exercise Options</DialogTitle>
            <DialogDescription>
              Record an exercise of your stock options
            </DialogDescription>
          </DialogHeader>
          {selectedGrantId && (
            <ExerciseForm
              accountId={accountId!}
              grantId={selectedGrantId}
              grant={summary.grants.find(g => g.id === selectedGrantId)}
              onSuccess={handleExerciseSuccess}
              onCancel={() => {
                setExerciseDialogOpen(false);
                setSelectedGrantId(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Grant Dialog */}
      <Dialog open={editGrantDialogOpen} onOpenChange={setEditGrantDialogOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit Grant</DialogTitle>
            <DialogDescription>
              Update the details of your equity grant
            </DialogDescription>
          </DialogHeader>
          {editingGrant && (
            <GrantForm
              accountId={accountId!}
              editGrant={editingGrant}
              onSuccess={handleEditSuccess}
              onCancel={() => {
                setEditGrantDialogOpen(false);
                setEditingGrant(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Vesting Schedule Dialog */}
      <Dialog open={vestingDialogOpen} onOpenChange={setVestingDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Set Vesting Schedule</DialogTitle>
            <DialogDescription>
              Configure how {vestingGrant?.company_name} grant vests over time
            </DialogDescription>
          </DialogHeader>
          {vestingGrant && (
            <VestingScheduleForm
              accountId={accountId!}
              grantId={vestingGrant.id}
              onSuccess={handleVestingSuccess}
              onCancel={() => {
                setVestingDialogOpen(false);
                setVestingGrant(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
