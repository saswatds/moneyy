import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient, type ProjectionConfig, type ProjectionResponse, type ProjectionScenario } from '@/lib/api-client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Line, LineChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
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
  IconAlertCircle,
  IconPlus,
  IconTrash,
  IconDeviceFloppy,
  IconFolder
} from '@tabler/icons-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const defaultConfig: ProjectionConfig = {
  time_horizon_years: 10,
  inflation_rate: 0.02,
  annual_salary: 80000,
  annual_salary_growth: 0.03,
  federal_tax_brackets: [
    { up_to_income: 55867, rate: 0.15 },
    { up_to_income: 111733, rate: 0.205 },
    { up_to_income: 173205, rate: 0.26 },
    { up_to_income: 246752, rate: 0.29 },
    { up_to_income: 0, rate: 0.33 },
  ],
  provincial_tax_brackets: [
    { up_to_income: 47937, rate: 0.0506 },
    { up_to_income: 95875, rate: 0.077 },
    { up_to_income: 110076, rate: 0.105 },
    { up_to_income: 133664, rate: 0.1229 },
    { up_to_income: 181232, rate: 0.147 },
    { up_to_income: 252752, rate: 0.168 },
    { up_to_income: 0, rate: 0.205 },
  ],
  monthly_expenses: 3000,
  annual_expense_growth: 0.02,
  monthly_savings_rate: 0.20,
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
  const [currentScenarioId, setCurrentScenarioId] = useState<string | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [scenarioName, setScenarioName] = useState('');

  // Load scenarios
  const { data: scenariosData, refetch: refetchScenarios } = useQuery({
    queryKey: ['projection-scenarios'],
    queryFn: () => apiClient.getScenarios(),
  });

  // Calculate projection
  const calculateMutation = useMutation({
    mutationFn: () => apiClient.calculateProjection({ config }),
    onSuccess: (data) => {
      console.log('Projection data received:', data);
      setProjectionData(data);
      setError(null);
    },
    onError: (error: Error) => {
      console.error('Projection error:', error);
      setError(`Failed to calculate projection: ${error.message}`);
    },
    onSettled: () => {
      setIsCalculating(false);
    },
  });

  // Save scenario
  const saveMutation = useMutation({
    mutationFn: (name: string) => {
      if (currentScenarioId) {
        return apiClient.updateScenario(currentScenarioId, { config });
      } else {
        return apiClient.createScenario({ name, is_default: false, config });
      }
    },
    onSuccess: (data) => {
      setCurrentScenarioId(data.id);
      setSaveDialogOpen(false);
      setScenarioName('');
      refetchScenarios();
      handleCalculate(); // Auto-calculate after saving
    },
  });

  // Delete scenario
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteScenario(id),
    onSuccess: () => {
      if (currentScenarioId) {
        setCurrentScenarioId(null);
        setConfig(defaultConfig);
      }
      refetchScenarios();
    },
  });

  const handleCalculate = () => {
    setIsCalculating(true);
    calculateMutation.mutate();
  };

  const handleSaveScenario = () => {
    if (currentScenarioId) {
      saveMutation.mutate(scenarioName || 'Unnamed Scenario');
    } else {
      setSaveDialogOpen(true);
    }
  };

  const handleLoadScenario = (scenarioId: string) => {
    const scenario = scenariosData?.scenarios.find(s => s.id === scenarioId);
    if (scenario) {
      setConfig(scenario.config);
      setCurrentScenarioId(scenario.id);
    }
  };

  const handleNewScenario = () => {
    setConfig(defaultConfig);
    setCurrentScenarioId(null);
  };

  // Load default scenario on mount
  useEffect(() => {
    if (scenariosData?.scenarios && scenariosData.scenarios.length > 0) {
      const defaultScenario = scenariosData.scenarios.find(s => s.is_default) || scenariosData.scenarios[0];
      if (defaultScenario && !currentScenarioId) {
        setConfig(defaultScenario.config);
        setCurrentScenarioId(defaultScenario.id);
      }
    }
  }, [scenariosData, currentScenarioId]);

  // Auto-calculate on mount or when config changes
  useEffect(() => {
    handleCalculate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Debug logging
  console.log('Chart data:', {
    netWorthDataLength: netWorthData.length,
    cashFlowDataLength: cashFlowData.length,
    debtDataLength: debtData.length,
    finalNetWorth,
    initialNetWorth
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Financial Projections</h1>
          <p className="text-muted-foreground mt-2">
            Configure parameters and visualize your financial future
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={currentScenarioId || 'new'} onValueChange={(value) => {
            if (value === 'new') {
              handleNewScenario();
            } else {
              handleLoadScenario(value);
            }
          }}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select scenario" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="new">
                <div className="flex items-center gap-2">
                  <IconPlus className="h-4 w-4" />
                  New Scenario
                </div>
              </SelectItem>
              {scenariosData?.scenarios.map((scenario) => (
                <SelectItem key={scenario.id} value={scenario.id}>
                  {scenario.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Scenario</DialogTitle>
            <DialogDescription>
              Give your projection scenario a name to save it for later use.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="scenarioName">Scenario Name</Label>
              <Input
                id="scenarioName"
                placeholder="e.g., Conservative Estimate"
                value={scenarioName}
                onChange={(e) => setScenarioName(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => saveMutation.mutate(scenarioName)} disabled={!scenarioName}>
              Save Scenario
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {isCalculating && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
              <p>Calculating projection...</p>
            </div>
          </CardContent>
        </Card>
      )}

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

      {!isCalculating && !projectionData && !error && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">
              <p>Configure your parameters and save to see your financial projections.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="charts" className="space-y-6">
        <div className="flex items-center justify-between">
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

          {/* Time Horizon Control */}
          <div className="flex items-center gap-2">
            <Label htmlFor="timeHorizon" className="text-xs text-muted-foreground">Horizon:</Label>
            <Input
              id="timeHorizon"
              type="number"
              min={1}
              max={30}
              value={config.time_horizon_years}
              onChange={(e) => setConfig({ ...config, time_horizon_years: parseInt(e.target.value) })}
              className="w-14 h-7 text-sm"
            />
            <span className="text-xs text-muted-foreground">yrs</span>
            <Button onClick={handleCalculate} variant="outline" size="sm" className="h-7 text-xs px-2">
              <IconCalculator className="h-3 w-3 mr-1" />
              Update
            </Button>
          </div>
        </div>

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
                  Savings Rate
                </CardTitle>
                <IconCash className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(config.monthly_savings_rate * 100).toFixed(0)}%</div>
                <p className="text-xs text-muted-foreground">
                  Of net income saved
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
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={netWorthData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis tickFormatter={(value) => formatCurrency(value)} />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      labelStyle={{ color: '#000' }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="netWorth"
                      stroke="#8b5cf6"
                      name="Net Worth"
                      strokeWidth={3}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="assets"
                      stroke="#10b981"
                      name="Assets"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="liabilities"
                      stroke="#ef4444"
                      name="Liabilities"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
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
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={cashFlowData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis tickFormatter={(value) => formatCurrency(value)} />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      labelStyle={{ color: '#000' }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="income"
                      stroke="#3b82f6"
                      name="Income"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="expenses"
                      stroke="#f59e0b"
                      name="Expenses"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
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
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={debtData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis tickFormatter={(value) => formatCurrency(value)} />
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                        labelStyle={{ color: '#000' }}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="totalDebt"
                        stroke="#ef4444"
                        name="Total Debt"
                        strokeWidth={3}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
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
              {/* Income */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="annualSalary">Annual Salary ($)</Label>
                  <Input
                    id="annualSalary"
                    type="number"
                    min={0}
                    step={1000}
                    value={config.annual_salary}
                    onChange={(e) => setConfig({ ...config, annual_salary: parseFloat(e.target.value) })}
                  />
                  <p className="text-sm text-muted-foreground">
                    Gross annual salary before taxes
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="salaryGrowth">Annual Salary Growth (%)</Label>
                  <Input
                    id="salaryGrowth"
                    type="number"
                    min={0}
                    max={20}
                    step={0.1}
                    value={config.annual_salary_growth * 100}
                    onChange={(e) => setConfig({ ...config, annual_salary_growth: parseFloat(e.target.value) / 100 })}
                  />
                  <p className="text-sm text-muted-foreground">
                    Expected annual raise percentage
                  </p>
                </div>
              </div>

              {/* Tax Brackets */}
              <div className="space-y-2">
                <Label className="text-sm">Tax Brackets</Label>
                <div className="grid gap-4 md:grid-cols-2">
                  {/* Federal Brackets */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">Federal</span>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-6 text-xs px-1.5"
                          onClick={() => {
                            setConfig({
                              ...config,
                              federal_tax_brackets: [
                                { up_to_income: 55867, rate: 0.15 },
                                { up_to_income: 111733, rate: 0.205 },
                                { up_to_income: 173205, rate: 0.26 },
                                { up_to_income: 246752, rate: 0.29 },
                                { up_to_income: 0, rate: 0.33 },
                              ]
                            });
                          }}
                        >
                          CA
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => {
                            const newBrackets = [...config.federal_tax_brackets];
                            const lastBracket = newBrackets[newBrackets.length - 1];
                            if (lastBracket.up_to_income === 0) {
                              newBrackets.splice(newBrackets.length - 1, 0, {
                                up_to_income: 50000,
                                rate: 0.15
                              });
                            } else {
                              newBrackets.push({ up_to_income: 50000, rate: 0.15 });
                            }
                            setConfig({ ...config, federal_tax_brackets: newBrackets });
                          }}
                        >
                          <IconPlus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      {config.federal_tax_brackets.map((bracket, idx) => (
                        <div key={idx} className="flex items-center gap-1 p-1 border rounded">
                          <Input
                            type="number"
                            min={0}
                            step={1000}
                            value={bracket.up_to_income === 0 ? '' : bracket.up_to_income}
                            onChange={(e) => {
                              const newBrackets = [...config.federal_tax_brackets];
                              newBrackets[idx] = {
                                ...bracket,
                                up_to_income: e.target.value === '' ? 0 : parseFloat(e.target.value)
                              };
                              setConfig({ ...config, federal_tax_brackets: newBrackets });
                            }}
                            placeholder={bracket.up_to_income === 0 ? 'Above' : 'Up to $'}
                            disabled={bracket.up_to_income === 0}
                            className="h-7 text-xs flex-1"
                          />
                          <div className="relative w-20">
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              step={0.1}
                              value={(bracket.rate * 100).toFixed(1)}
                              onChange={(e) => {
                                const newBrackets = [...config.federal_tax_brackets];
                                newBrackets[idx] = { ...bracket, rate: parseFloat(e.target.value) / 100 };
                                setConfig({ ...config, federal_tax_brackets: newBrackets });
                              }}
                              className="h-7 text-xs pr-5"
                            />
                            <span className="absolute right-1 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                          </div>
                          {config.federal_tax_brackets.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const newBrackets = config.federal_tax_brackets.filter((_, i) => i !== idx);
                                setConfig({ ...config, federal_tax_brackets: newBrackets });
                              }}
                              className="h-7 w-7 p-0"
                            >
                              <IconTrash className="h-3 w-3 text-destructive" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Provincial Brackets */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">Provincial/State</span>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-6 text-xs px-1.5"
                          onClick={() => {
                            setConfig({
                              ...config,
                              provincial_tax_brackets: [
                                { up_to_income: 47937, rate: 0.0506 },
                                { up_to_income: 95875, rate: 0.077 },
                                { up_to_income: 110076, rate: 0.105 },
                                { up_to_income: 133664, rate: 0.1229 },
                                { up_to_income: 181232, rate: 0.147 },
                                { up_to_income: 252752, rate: 0.168 },
                                { up_to_income: 0, rate: 0.205 },
                              ]
                            });
                          }}
                        >
                          BC
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => {
                            const newBrackets = [...config.provincial_tax_brackets];
                            const lastBracket = newBrackets[newBrackets.length - 1];
                            if (lastBracket.up_to_income === 0) {
                              newBrackets.splice(newBrackets.length - 1, 0, {
                                up_to_income: 50000,
                                rate: 0.05
                              });
                            } else {
                              newBrackets.push({ up_to_income: 50000, rate: 0.05 });
                            }
                            setConfig({ ...config, provincial_tax_brackets: newBrackets });
                          }}
                        >
                          <IconPlus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      {config.provincial_tax_brackets.map((bracket, idx) => (
                        <div key={idx} className="flex items-center gap-1 p-1 border rounded">
                          <Input
                            type="number"
                            min={0}
                            step={1000}
                            value={bracket.up_to_income === 0 ? '' : bracket.up_to_income}
                            onChange={(e) => {
                              const newBrackets = [...config.provincial_tax_brackets];
                              newBrackets[idx] = {
                                ...bracket,
                                up_to_income: e.target.value === '' ? 0 : parseFloat(e.target.value)
                              };
                              setConfig({ ...config, provincial_tax_brackets: newBrackets });
                            }}
                            placeholder={bracket.up_to_income === 0 ? 'Above' : 'Up to $'}
                            disabled={bracket.up_to_income === 0}
                            className="h-7 text-xs flex-1"
                          />
                          <div className="relative w-20">
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              step={0.1}
                              value={(bracket.rate * 100).toFixed(1)}
                              onChange={(e) => {
                                const newBrackets = [...config.provincial_tax_brackets];
                                newBrackets[idx] = { ...bracket, rate: parseFloat(e.target.value) / 100 };
                                setConfig({ ...config, provincial_tax_brackets: newBrackets });
                              }}
                              className="h-7 text-xs pr-5"
                            />
                            <span className="absolute right-1 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                          </div>
                          {config.provincial_tax_brackets.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const newBrackets = config.provincial_tax_brackets.filter((_, i) => i !== idx);
                                setConfig({ ...config, provincial_tax_brackets: newBrackets });
                              }}
                              className="h-7 w-7 p-0"
                            >
                              <IconTrash className="h-3 w-3 text-destructive" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Progressive tax brackets. Empty income = unlimited. Federal and provincial calculated separately.
                </p>
              </div>

              {/* Expenses */}
              <div className="grid gap-4 md:grid-cols-2">

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
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="savingsRate">Savings Rate (%)</Label>
                  <Input
                    id="savingsRate"
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={config.monthly_savings_rate * 100}
                    onChange={(e) => setConfig({ ...config, monthly_savings_rate: parseFloat(e.target.value) / 100 })}
                  />
                  <p className="text-sm text-muted-foreground">
                    Percentage of net income to save/invest
                  </p>
                </div>

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

              {/* Save/Update Button */}
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  onClick={handleSaveScenario}
                  disabled={saveMutation.isPending}
                  size="lg"
                >
                  <IconDeviceFloppy className="h-4 w-4 mr-2" />
                  {saveMutation.isPending ? 'Saving...' : currentScenarioId ? 'Update & Calculate' : 'Save & Calculate'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
