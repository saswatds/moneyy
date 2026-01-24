import { useParams, useNavigate } from 'react-router-dom';
import { useAccount, useDeleteAccount } from '@/hooks/use-accounts';
import { useAccountBalances } from '@/hooks/use-balances';
import { useAccountHoldings } from '@/hooks/use-holdings';
import type { Holding } from '@/lib/api-client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';
import { Line, LineChart, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { IconArrowLeft, IconTrash, IconEdit } from '@tabler/icons-react';
import { format } from 'date-fns';
import { BalanceEntryForm } from '@/components/BalanceEntryForm';
import { HoldingEntryForm } from '@/components/HoldingEntryForm';

const chartConfig = {
  amount: {
    label: 'Balance',
    color: 'hsl(var(--chart-1))',
  },
} satisfies ChartConfig;

export function AccountDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: account, isLoading: accountLoading } = useAccount(id!);
  const { data: balancesData, isLoading: balancesLoading } = useAccountBalances(id!);
  const { data: holdingsData, isLoading: holdingsLoading } = useAccountHoldings(id!);
  const deleteAccount = useDeleteAccount();

  if (accountLoading || balancesLoading || holdingsLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Account not found</div>
      </div>
    );
  }

  const balances = balancesData?.balances || [];
  const holdings = holdingsData?.holdings || [];

  // Prepare chart data (reverse to show oldest to newest)
  const chartData = [...balances]
    .reverse()
    .map((balance) => ({
      date: format(new Date(balance.date), 'MMM dd'),
      amount: balance.amount,
    }));

  const currentBalance = balances.length > 0 ? balances[0].amount : 0;

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this account?')) {
      try {
        await deleteAccount.mutateAsync(id!);
        navigate('/accounts');
      } catch (error) {
        console.error('Failed to delete account:', error);
      }
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/accounts')}
          >
            <IconArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{account.name}</h1>
            <p className="text-muted-foreground mt-2">
              {account.type} • {account.currency}
              {account.institution && ` • ${account.institution}`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon">
            <IconEdit className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleDelete}
            disabled={deleteAccount.isPending}
          >
            <IconTrash className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Account Info Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Current Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {account.currency} {currentBalance.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Category</CardTitle>
          </CardHeader>
          <CardContent>
            <span
              className={`inline-flex px-2 py-1 text-sm font-medium rounded ${
                account.is_asset
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                  : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
              }`}
            >
              {account.is_asset ? 'Asset' : 'Liability'}
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <span
              className={`inline-flex px-2 py-1 text-sm font-medium rounded ${
                account.is_active
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
              }`}
            >
              {account.is_active ? 'Active' : 'Inactive'}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Balance Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Balance History</CardTitle>
            <CardDescription>Track your account balance over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <LineChart data={chartData} accessibilityLayer>
                <XAxis dataKey="date" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke="var(--color-amount)"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Two-pane view: Balance Entry Form and History */}
      <div className="grid gap-6 md:grid-cols-5">
        {/* Add Balance Form - Left side */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Add Balance Entry</CardTitle>
            <CardDescription>Record a new balance for this account</CardDescription>
          </CardHeader>
          <CardContent>
            <BalanceEntryForm accountId={id!} currency={account.currency} />
          </CardContent>
        </Card>

        {/* Balance History - Right side */}
        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle>Balance History</CardTitle>
            <CardDescription>All balance entries for this account</CardDescription>
          </CardHeader>
          <CardContent>
            {balances.length > 0 ? (
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                {balances.map((balance) => (
                  <div
                    key={balance.id}
                    className="flex items-center justify-between py-3 border-b border-border last:border-0"
                  >
                    <div className="space-y-1">
                      <div className="font-medium">
                        {account.currency} {balance.amount.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(balance.date), 'PPP')}
                      </div>
                      {balance.notes && (
                        <div className="text-sm text-muted-foreground">
                          {balance.notes}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                No balance entries yet. Add your first balance to start tracking!
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Holdings Section */}
      <div className="grid gap-6 md:grid-cols-5">
        {/* Add Holding Form - Left side */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Add Holding</CardTitle>
            <CardDescription>Add a security or cash holding to this account</CardDescription>
          </CardHeader>
          <CardContent>
            <HoldingEntryForm accountId={id!} />
          </CardContent>
        </Card>

        {/* Holdings List - Right side */}
        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle>Holdings</CardTitle>
            <CardDescription>Securities and cash positions in this account</CardDescription>
          </CardHeader>
          <CardContent>
            {holdings.length > 0 ? (
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                {holdings.map((holding: Holding) => (
                  <div
                    key={holding.id}
                    className="flex items-center justify-between py-3 border-b border-border last:border-0"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {holding.type === 'cash' ? (
                            <>
                              {holding.currency} {holding.amount?.toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </>
                          ) : (
                            <>
                              {holding.symbol} - {holding.quantity?.toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 8,
                              })} shares
                            </>
                          )}
                        </span>
                        <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                          {holding.type}
                        </span>
                      </div>
                      {holding.type !== 'cash' && holding.cost_basis && (
                        <div className="text-sm text-muted-foreground">
                          Cost Basis: {account.currency} {holding.cost_basis.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </div>
                      )}
                      {holding.purchase_date && (
                        <div className="text-sm text-muted-foreground">
                          Purchased: {format(new Date(holding.purchase_date), 'PPP')}
                        </div>
                      )}
                      {holding.notes && (
                        <div className="text-sm text-muted-foreground">
                          {holding.notes}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                No holdings yet. Add your first holding to start tracking your portfolio!
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
