import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiClient, type ProjectionConfig, type ProjectionResponse } from '@/lib/api-client';
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
import { Line, LineChart, Area, ComposedChart, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  IconTrendingUp,
  IconChartLine,
  IconCash,
  IconCreditCard,
  IconSettings,
  IconCalculator,
  IconAlertCircle
} from '@tabler/icons-react';

const chartConfig = {
  netWorth: {
    label: 'Net Worth',
    color: 'hsl(var(--chart-1))',
  },
  assets: {
    label: 'Assets',
    color: 'hsl(var(--chart-2))',
  },
  liabilities: {
    label: 'Liabilities',
    color: 'hsl(var(--chart-3))',
  },
  income: {
    label: 'Income',
    color: 'hsl(var(--chart-4))',
  },
  expenses: {
    label: 'Expenses',
    color: 'hsl(var(--chart-5))',
  },
} satisfies ChartConfig;

const defaultConfig: ProjectionConfig = {
  time_horizon_years: 10,
  inflation_rate: 0.02,
  monthly_income: 5000,
  annual_income_growth: 0.03,
  monthly_expenses: 3000,
  annual_expense_growth: 0.02,
  monthly_savings: 1000,
  investment_returns: {
    'tfsa': 0.07,
    'rrsp': 0.07,
    'stocks': 0.08,
    'brokerage': 0.06,
    'crypto': 0.10,
  },
  extra_debt_payments: {},
  one_time_expenses: [],
  one_time_incomes: [],
  asset_appreciation: {
    'real_estate': 0.04,
    'vehicle': -0.15,
  },
  tax_rate: 0.25,
  savings_allocation: {
    'tfsa': 0.4,
    'rrsp': 0.3,
    'stocks': 0.3,
  },
};

export function Projections() {
  const [config, setConfig] = useState<ProjectionConfig>(defaultConfig);
  const [projectionData, setProjectionData] = useState<ProjectionResponse | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate projection
  const calculateMutation = useMutation({
    mutationFn: () => apiClient.calculateProjection({ config }),
    onSuccess: (data) => {
      setProjectionData(data);
      setError(null);
    },
    onError: (error: Error) => {
      setError(`Failed to calculate projection: ${error.message}`);
    },
    onSettled: () => {
      setIsCalculating(false);
    },
  });

  const handleCalculate = () => {
    setIsCalculating(true);
    calculateMutation.mutate();
  };

  // Auto-calculate on mount
  useEffect(() => {
    handleCalculate();
  }, []);

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Format date for charts
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getFullYear().toString().slice(2)}`;
  };

  // Prepare net worth data
  const netWorthData = projectionData?.net_worth.map((point, idx) => ({
    date: formatDate(point.date),
    netWorth: point.value,
    assets: projectionData.assets[idx]?.value || 0,
    liabilities: projectionData.liabilities[idx]?.value || 0,
  })) || [];

  // Prepare cash flow data
  const cashFlowData = projectionData?.cash_flow.map((point) => ({
    date: formatDate(point.date),
    income: point.income,
    expenses: point.expenses,
    net: point.net,
  })) || [];

  // Prepare debt payoff data
  const debtData = projectionData?.debt_payoff.map((point) => ({
    date: formatDate(point.date),
    totalDebt: point.total_debt,
  })) || [];

  // Get final values
  const finalNetWorth = netWorthData[netWorthData.length - 1]?.netWorth || 0;
  const initialNetWorth = netWorthData[0]?.netWorth || 0;
  const netWorthGrowth = finalNetWorth - initialNetWorth;
  const finalDebt = debtData[debtData.length - 1]?.totalDebt || 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Financial Projections</h1>
        <p className="text-muted-foreground mt-2">
          Configure parameters and visualize your financial future
        </p>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <IconAlertCircle className="h-5 w-5" />
              <p>{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="charts" className="space-y-6">
        <TabsList>
          <TabsTrigger value="charts">
            <IconChartLine className="h-4 w-4 mr-2" />
            Charts
          </TabsTrigger>
          <TabsTrigger value="config">
            <IconSettings className="h-4 w-4 mr-2" />
            Configuration
          </TabsTrigger>
        </TabsList>

        <TabsContent value="charts" className="space-y-6">
          {/* Summary Stats */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Projected Net Worth
                </CardTitle>
                <IconTrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(finalNetWorth)}</div>
                <p className="text-xs text-muted-foreground">
                  In {config.time_horizon_years} years
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Net Worth Growth
                </CardTitle>
                <IconChartLine className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(netWorthGrowth)}</div>
                <p className="text-xs text-muted-foreground">
                  {((netWorthGrowth / Math.max(initialNetWorth, 1)) * 100).toFixed(1)}% increase
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Remaining Debt
                </CardTitle>
                <IconCreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(finalDebt)}</div>
                <p className="text-xs text-muted-foreground">
                  {finalDebt === 0 ? 'Debt-free!' : `In ${config.time_horizon_years} years`}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Monthly Savings
                </CardTitle>
                <IconCash className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(config.monthly_savings)}</div>
                <p className="text-xs text-muted-foreground">
                  Allocated to investments
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Net Worth Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Net Worth Projection</CardTitle>
              <CardDescription>
                Assets vs liabilities over the next {config.time_horizon_years} years
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="aspect-auto h-[400px] w-full">
                <ComposedChart data={netWorthData} accessibilityLayer>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <YAxis
                    tickFormatter={(value) => formatCurrency(value)}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Area
                    type="monotone"
                    dataKey="assets"
                    stackId="1"
                    stroke="var(--color-assets)"
                    fill="var(--color-assets)"
                    fillOpacity={0.6}
                  />
                  <Area
                    type="monotone"
                    dataKey="liabilities"
                    stackId="2"
                    stroke="var(--color-liabilities)"
                    fill="var(--color-liabilities)"
                    fillOpacity={0.6}
                  />
                  <Line
                    type="monotone"
                    dataKey="netWorth"
                    stroke="var(--color-netWorth)"
                    strokeWidth={3}
                    dot={false}
                  />
                </ComposedChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Cash Flow Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Cash Flow Projection</CardTitle>
              <CardDescription>
                Income vs expenses over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="aspect-auto h-[300px] w-full">
                <LineChart data={cashFlowData} accessibilityLayer>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <YAxis
                    tickFormatter={(value) => formatCurrency(value)}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Line
                    type="monotone"
                    dataKey="income"
                    stroke="var(--color-income)"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="expenses"
                    stroke="var(--color-expenses)"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Debt Payoff Chart */}
          {debtData.length > 0 && debtData[0].totalDebt > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Debt Payoff Timeline</CardTitle>
                <CardDescription>
                  Total debt balance over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="aspect-auto h-[300px] w-full">
                  <LineChart data={debtData} accessibilityLayer>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                    />
                    <YAxis
                      tickFormatter={(value) => formatCurrency(value)}
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line
                      type="monotone"
                      dataKey="totalDebt"
                      stroke="var(--color-liabilities)"
                      strokeWidth={3}
                      dot={false}
                    />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="config" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Projection Parameters</CardTitle>
              <CardDescription>
                Configure your financial assumptions and see how they affect your future
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Time Horizon */}
              <div className="space-y-2">
                <Label htmlFor="timeHorizon">Time Horizon (Years)</Label>
                <Input
                  id="timeHorizon"
                  type="number"
                  min={1}
                  max={30}
                  value={config.time_horizon_years}
                  onChange={(e) => setConfig({ ...config, time_horizon_years: parseInt(e.target.value) })}
                />
                <p className="text-sm text-muted-foreground">
                  How many years to project into the future (1-30)
                </p>
              </div>

              {/* Income & Expenses */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="monthlyIncome">Monthly Income ($)</Label>
                  <Input
                    id="monthlyIncome"
                    type="number"
                    min={0}
                    step={100}
                    value={config.monthly_income}
                    onChange={(e) => setConfig({ ...config, monthly_income: parseFloat(e.target.value) })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="incomeGrowth">Annual Income Growth (%)</Label>
                  <Input
                    id="incomeGrowth"
                    type="number"
                    min={0}
                    max={20}
                    step={0.1}
                    value={config.annual_income_growth * 100}
                    onChange={(e) => setConfig({ ...config, annual_income_growth: parseFloat(e.target.value) / 100 })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="monthlyExpenses">Monthly Expenses ($)</Label>
                  <Input
                    id="monthlyExpenses"
                    type="number"
                    min={0}
                    step={100}
                    value={config.monthly_expenses}
                    onChange={(e) => setConfig({ ...config, monthly_expenses: parseFloat(e.target.value) })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expenseGrowth">Annual Expense Growth (%)</Label>
                  <Input
                    id="expenseGrowth"
                    type="number"
                    min={0}
                    max={20}
                    step={0.1}
                    value={config.annual_expense_growth * 100}
                    onChange={(e) => setConfig({ ...config, annual_expense_growth: parseFloat(e.target.value) / 100 })}
                  />
                </div>
              </div>

              {/* Savings */}
              <div className="space-y-2">
                <Label htmlFor="monthlySavings">Monthly Savings ($)</Label>
                <Input
                  id="monthlySavings"
                  type="number"
                  min={0}
                  step={100}
                  value={config.monthly_savings}
                  onChange={(e) => setConfig({ ...config, monthly_savings: parseFloat(e.target.value) })}
                />
                <p className="text-sm text-muted-foreground">
                  Amount to invest each month
                </p>
              </div>

              {/* Economic Assumptions */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="inflationRate">Inflation Rate (%)</Label>
                  <Input
                    id="inflationRate"
                    type="number"
                    min={0}
                    max={10}
                    step={0.1}
                    value={config.inflation_rate * 100}
                    onChange={(e) => setConfig({ ...config, inflation_rate: parseFloat(e.target.value) / 100 })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="taxRate">Tax Rate (%)</Label>
                  <Input
                    id="taxRate"
                    type="number"
                    min={0}
                    max={50}
                    step={1}
                    value={config.tax_rate * 100}
                    onChange={(e) => setConfig({ ...config, tax_rate: parseFloat(e.target.value) / 100 })}
                  />
                </div>
              </div>

              {/* Investment Returns */}
              <div className="space-y-4">
                <Label>Investment Returns (Annual %)</Label>
                <div className="grid gap-3">
                  {Object.entries(config.investment_returns).map(([accountType, rate]) => (
                    <div key={accountType} className="flex items-center gap-3">
                      <Label className="w-32 capitalize">{accountType.replace('_', ' ')}</Label>
                      <Input
                        type="number"
                        min={-20}
                        max={50}
                        step={0.5}
                        value={rate * 100}
                        onChange={(e) => setConfig({
                          ...config,
                          investment_returns: {
                            ...config.investment_returns,
                            [accountType]: parseFloat(e.target.value) / 100,
                          },
                        })}
                        className="w-32"
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Calculate Button */}
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  onClick={handleCalculate}
                  disabled={isCalculating}
                  size="lg"
                >
                  <IconCalculator className="h-4 w-4 mr-2" />
                  {isCalculating ? 'Calculating...' : 'Calculate Projection'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
