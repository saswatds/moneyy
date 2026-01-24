import { useAccountsSummary, useAccounts } from '@/hooks/use-accounts';
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
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';
import { Bar, BarChart } from 'recharts';
import { IconTrendingUp, IconWallet, IconChartBar, IconCreditCard } from '@tabler/icons-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const chartConfig = {
  assets: {
    label: 'Assets',
    color: 'hsl(var(--chart-1))',
  },
  liabilities: {
    label: 'Liabilities',
    color: 'hsl(var(--chart-2))',
  },
  CAD: {
    label: 'CAD',
    color: 'hsl(var(--chart-1))',
  },
  USD: {
    label: 'USD',
    color: 'hsl(var(--chart-2))',
  },
  INR: {
    label: 'INR',
    color: 'hsl(var(--chart-3))',
  },
} satisfies ChartConfig;

export function Dashboard() {
  const navigate = useNavigate();
  const { data: summary, isLoading: summaryLoading } = useAccountsSummary();
  const { data: accountsData, isLoading: accountsLoading } = useAccounts();

  if (summaryLoading || accountsLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Prepare data for assets vs liabilities chart
  const assetLiabilityData = [
    {
      name: 'Assets',
      value: summary?.asset_accounts || 0,
      fill: 'var(--color-assets)',
    },
    {
      name: 'Liabilities',
      value: summary?.liability_accounts || 0,
      fill: 'var(--color-liabilities)',
    },
  ];

  // Prepare data for currency breakdown
  const currencyData = summary?.by_currency
    ? Object.entries(summary.by_currency).map(([currency, count]) => ({
        currency,
        count: count as number,
        fill: `var(--color-${currency})`,
      }))
    : [];

  // Prepare data for account type distribution
  const accountTypeData = summary?.by_type
    ? Object.entries(summary.by_type).map(([type, count]) => ({
        type,
        count: count as number,
      }))
    : [];

  const hasAccounts = accountsData?.accounts && accountsData.accounts.length > 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Overview of your financial accounts and net worth
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Accounts</CardTitle>
            <IconWallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.total_accounts || 0}</div>
            <p className="text-xs text-muted-foreground">
              Across all currencies
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Accounts</CardTitle>
            <IconTrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {summary?.active_accounts || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Currently active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Asset Accounts</CardTitle>
            <IconChartBar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {summary?.asset_accounts || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Savings & investments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Liabilities</CardTitle>
            <IconCreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {summary?.liability_accounts || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Debts & loans
            </p>
          </CardContent>
        </Card>
      </div>

      {hasAccounts ? (
        <>
          {/* Charts Grid */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Assets vs Liabilities Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Assets vs Liabilities</CardTitle>
                <CardDescription>
                  Distribution of account types
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[300px]">
                  <BarChart data={assetLiabilityData} accessibilityLayer>
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="value" radius={8} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Currency Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Currency Distribution</CardTitle>
                <CardDescription>
                  Accounts by currency
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[300px]">
                  <BarChart data={currencyData} accessibilityLayer>
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar dataKey="count" radius={8} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>

          {/* Account Type Distribution */}
          {accountTypeData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Account Type Distribution</CardTitle>
                <CardDescription>
                  Breakdown by account type
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[300px]">
                  <BarChart data={accountTypeData} accessibilityLayer>
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" fill="hsl(var(--chart-1))" radius={8} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          )}

          {/* Recent Accounts */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Recent Accounts</CardTitle>
                  <CardDescription>
                    Your latest financial accounts
                  </CardDescription>
                </div>
                <Link
                  to="/accounts"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  View all
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {accountsData.accounts.slice(0, 5).map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between py-3 border-b border-border last:border-0"
                  >
                    <div className="space-y-1">
                      <Link
                        to={`/accounts/${account.id}`}
                        className="font-medium hover:underline"
                      >
                        {account.name}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        {account.type} • {account.currency}
                        {account.institution && ` • ${account.institution}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${
                          account.is_asset
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                        }`}
                      >
                        {account.is_asset ? 'Asset' : 'Liability'}
                      </span>
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${
                          account.is_active
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                        }`}
                      >
                        {account.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <IconWallet className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No accounts yet</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Get started by creating your first financial account
              </p>
              <Button
                onClick={() => navigate('/accounts/new')}
                size="lg"
                className="mt-4"
              >
                Create Account
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
