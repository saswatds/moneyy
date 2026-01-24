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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';
import { Button } from '@/components/ui/button';
import { IconArrowLeft, IconTrash, IconEdit } from '@tabler/icons-react';
import { format } from 'date-fns';
import { BalanceEntryForm } from '@/components/BalanceEntryForm';
import { HoldingEntryForm } from '@/components/HoldingEntryForm';

const chartConfig = {
  amount: {
    label: 'Balance',
    color: 'hsl(142 76% 36%)',
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
  const startBalance = balances.length > 1 ? balances[balances.length - 1].amount : currentBalance;
  const growth = currentBalance - startBalance;
  const growthPercent = startBalance !== 0 ? (growth / startBalance) * 100 : 0;

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

      {/* Balance Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl font-bold">
              {account.currency} {currentBalance.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </CardTitle>
            <CardDescription>
              {balances.length > 1 && (
                <span className={growth >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                  {growth >= 0 ? '+' : ''}{account.currency} {growth.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })} ({growth >= 0 ? '+' : ''}{growthPercent.toFixed(2)}%)
                </span>
              )}
              {balances.length <= 1 && 'Balance history over time'}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
            <ChartContainer config={chartConfig} className="aspect-auto h-[300px] w-full">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="fillAmount" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="var(--color-amount)"
                      stopOpacity={0.8}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--color-amount)"
                      stopOpacity={0.1}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={32}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(value) => `${value.toLocaleString()}`}
                />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      labelFormatter={(value) => value}
                      indicator="dot"
                    />
                  }
                />
                <Area
                  dataKey="amount"
                  type="natural"
                  fill="url(#fillAmount)"
                  stroke="var(--color-amount)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Tabbed view: Forms and History */}
      <div className="grid gap-6 md:grid-cols-5">
        {/* Forms - Left side */}
        <Card className="md:col-span-2">
          <Tabs defaultValue="balance" className="w-full">
            <CardHeader>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="balance">Balance</TabsTrigger>
                <TabsTrigger value="holding">Holding</TabsTrigger>
              </TabsList>
            </CardHeader>
            <CardContent>
              <TabsContent value="balance" className="mt-0">
                <div className="space-y-2 mb-4">
                  <CardTitle>Add Balance Entry</CardTitle>
                  <CardDescription>Record a new balance for this account</CardDescription>
                </div>
                <BalanceEntryForm accountId={id!} currency={account.currency} />
              </TabsContent>
              <TabsContent value="holding" className="mt-0">
                <div className="space-y-2 mb-4">
                  <CardTitle>Add Holding</CardTitle>
                  <CardDescription>Add a security or cash holding to this account</CardDescription>
                </div>
                <HoldingEntryForm accountId={id!} />
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>

        {/* History - Right side */}
        <Card className="md:col-span-3">
          <Tabs defaultValue="balances" className="w-full">
            <CardHeader>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="balances">Balance History</TabsTrigger>
                <TabsTrigger value="holdings">Holdings</TabsTrigger>
              </TabsList>
            </CardHeader>
            <CardContent>
              <TabsContent value="balances" className="mt-0">
                <CardDescription className="mb-3 text-xs">All balance entries for this account</CardDescription>
                {balances.length > 0 ? (
                  <div className="space-y-0 max-h-[600px] overflow-y-auto pr-2">
                    {balances.map((balance) => (
                      <div
                        key={balance.id}
                        className="flex items-center justify-between py-2 border-b border-border/50 last:border-0 hover:bg-muted/50 transition-colors"
                      >
                        <div className="space-y-0.5">
                          <div className="text-sm font-medium">
                            {account.currency} {balance.amount.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(balance.date), 'MMM dd, yyyy')}
                          </div>
                          {balance.notes && (
                            <div className="text-xs text-muted-foreground/80 truncate max-w-[300px]">
                              {balance.notes}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    No balance entries yet. Add your first balance to start tracking!
                  </div>
                )}
              </TabsContent>
              <TabsContent value="holdings" className="mt-0">
                <CardDescription className="mb-3 text-xs">Securities and cash positions in this account</CardDescription>
                {holdings.length > 0 ? (
                  <div className="space-y-0 max-h-[600px] overflow-y-auto pr-2">
                    {holdings.map((holding: Holding) => (
                      <div
                        key={holding.id}
                        className="flex items-center justify-between py-2 border-b border-border/50 last:border-0 hover:bg-muted/50 transition-colors"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
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
                            <span className="inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                              {holding.type}
                            </span>
                          </div>
                          {holding.type !== 'cash' && holding.cost_basis && (
                            <div className="text-xs text-muted-foreground">
                              Cost Basis: {account.currency} {holding.cost_basis.toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </div>
                          )}
                          {holding.purchase_date && (
                            <div className="text-xs text-muted-foreground">
                              Purchased: {format(new Date(holding.purchase_date), 'MMM dd, yyyy')}
                            </div>
                          )}
                          {holding.notes && (
                            <div className="text-xs text-muted-foreground/80 truncate max-w-[300px]">
                              {holding.notes}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    No holdings yet. Add your first holding to start tracking your portfolio!
                  </div>
                )}
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
