import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { ProjectionConfig, ProjectionResponse } from '@/lib/api-client';
import { EventsList } from '@/components/projections/EventsList';
import { SensitivityAnalysisDialog } from '@/components/projections/SensitivityAnalysisDialog';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Line, LineChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  IconTrendingUp,
  IconChartLine,
  IconCreditCard,
  IconSettings,
  IconCalculator,
  IconAlertCircle,
  IconPlus,
  IconTrash,
  IconDeviceFloppy,
  IconBulb,
  IconCopy,
  IconChartBar
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
  asset_appreciation: {
    'real_estate': 0.04,
    'vehicle': -0.15,
  },
  savings_allocation: {
    'tfsa': 0.4,
    'rrsp': 0.3,
    'stocks': 0.3,
  },
  events: [],
};

export function Projections() {
  const [config, setConfig] = useState<ProjectionConfig>(defaultConfig);
  const [projectionData, setProjectionData] = useState<ProjectionResponse | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentScenarioId, setCurrentScenarioId] = useState<string | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [scenarioName, setScenarioName] = useState('');
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [cloneName, setCloneName] = useState('');
  const [sensitivityDialogOpen, setSensitivityDialogOpen] = useState(false);
  const [sensitivityParameter, setSensitivityParameter] = useState<{
    name: string;
    label: string;
    value: number;
    updateFn?: (path: string, value: number) => ProjectionConfig;
  } | null>(null);

  // Load scenarios
  const { data: scenariosData, refetch: refetchScenarios } = useQuery({
    queryKey: ['projection-scenarios'],
    queryFn: () => apiClient.getScenarios(),
  });

  // Calculate projection
  const calculateMutation = useMutation({
    mutationFn: () => {
      console.log('Calculating projection with config:', config);
      console.log('Events being sent:', config.events);
      return apiClient.calculateProjection({ config });
    },
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
      setCurrentScenarioId(null);
      setConfig(defaultConfig);
      refetchScenarios();
      // Trigger recalculation with default config
      setTimeout(() => handleCalculate(), 100);
    },
  });

  const handleDeleteScenario = () => {
    if (currentScenarioId && confirm('Are you sure you want to delete this scenario?')) {
      deleteMutation.mutate(currentScenarioId);
    }
  };

  // Clone scenario
  const cloneMutation = useMutation({
    mutationFn: (name: string) => apiClient.createScenario({ name, is_default: false, config }),
    onSuccess: (data) => {
      setCurrentScenarioId(data.id);
      setCloneDialogOpen(false);
      setCloneName('');
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
      // Trigger recalculation with new config
      setTimeout(() => handleCalculate(), 100);
    }
  };

  const handleNewScenario = () => {
    setConfig(defaultConfig);
    setCurrentScenarioId(null);
    // Trigger recalculation with default config
    setTimeout(() => handleCalculate(), 100);
  };

  const handleCloneScenario = () => {
    const currentScenario = scenariosData?.scenarios.find(s => s.id === currentScenarioId);
    if (currentScenario) {
      setCloneName(`${currentScenario.name} (Copy)`);
      setCloneDialogOpen(true);
    }
  };

  const openSensitivityAnalysis = (
    name: string,
    label: string,
    value: number,
    updateFn?: (path: string, value: number) => ProjectionConfig
  ) => {
    setSensitivityParameter({ name, label, value, updateFn });
    setSensitivityDialogOpen(true);
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

  // Auto-calculate on mount
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

  // Get event color for markers
  const getEventColor = (type: string) => {
    switch (type) {
      case 'one_time_income': return '#10b981'; // green
      case 'one_time_expense': return '#ef4444'; // red
      case 'extra_debt_payment': return '#f97316'; // orange
      case 'salary_change': return '#3b82f6'; // blue
      case 'expense_level_change': return '#a855f7'; // purple
      case 'savings_rate_change': return '#6366f1'; // indigo
      default: return '#8b5cf6';
    }
  };

  // Get short event label
  const getEventLabel = (event: any) => {
    switch (event.type) {
      case 'one_time_income': return '💰';
      case 'one_time_expense': return '💸';
      case 'extra_debt_payment': return '💳';
      case 'salary_change': return '📈';
      case 'expense_level_change': return '🏠';
      case 'savings_rate_change': return '💵';
      default: return '📅';
    }
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

  // Calculate inflation-adjusted "real value" (in today's dollars)
  const realNetWorth = finalNetWorth / Math.pow(1 + config.inflation_rate, config.time_horizon_years);

  // Map events to chart dates
  const eventMarkers = config.events.map(event => {
    const eventDate = formatDate(event.date);
    return {
      ...event,
      chartDate: eventDate,
    };
  });

  // Helper function to calculate relative time
  const getRelativeTime = (futureDate: Date): string => {
    const now = new Date();
    const diffMs = futureDate.getTime() - now.getTime();
    const diffMonths = Math.round(diffMs / (1000 * 60 * 60 * 24 * 30.44));

    if (diffMonths < 12) {
      return `${diffMonths} month${diffMonths !== 1 ? 's' : ''}`;
    } else {
      const years = Math.floor(diffMonths / 12);
      const months = diffMonths % 12;
      if (months === 0) {
        return `${years} year${years !== 1 ? 's' : ''}`;
      }
      return `${years} year${years !== 1 ? 's' : ''} ${months} month${months !== 1 ? 's' : ''}`;
    }
  };

  // Helper function to calculate years from now
  const getYearsFromNow = (futureDate: Date): number => {
    const now = new Date();
    const diffMs = futureDate.getTime() - now.getTime();
    return diffMs / (1000 * 60 * 60 * 24 * 365.25);
  };

  // Calculate interesting points
  const interestingPoints: Array<{ date: string; relativeTime: string; description: string; icon: string; realValue?: number }> = [];

  if (projectionData) {
    // When net worth exceeds liabilities
    const netWorthExceedsDebtIdx = projectionData.net_worth.findIndex((point, idx) => {
      const netWorth = point.value;
      const liabilities = projectionData.liabilities[idx]?.value || 0;
      return netWorth > liabilities && liabilities > 0;
    });
    if (netWorthExceedsDebtIdx > 0) {
      const milestoneDate = new Date(projectionData.net_worth[netWorthExceedsDebtIdx].date);
      interestingPoints.push({
        date: milestoneDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        relativeTime: getRelativeTime(milestoneDate),
        description: 'Net worth exceeds liabilities',
        icon: '📈',
      });
    }

    // When debt is fully paid off
    const debtPaidOffIdx = projectionData.debt_payoff.findIndex(point => point.total_debt === 0);
    if (debtPaidOffIdx > 0) {
      const milestoneDate = new Date(projectionData.debt_payoff[debtPaidOffIdx].date);
      interestingPoints.push({
        date: milestoneDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        relativeTime: getRelativeTime(milestoneDate),
        description: 'All debt paid off',
        icon: '🎉',
      });
    }

    // When net worth crosses $0 (positive net worth)
    if (initialNetWorth < 0) {
      const positiveNetWorthIdx = projectionData.net_worth.findIndex(point => point.value > 0);
      if (positiveNetWorthIdx > 0) {
        const milestoneDate = new Date(projectionData.net_worth[positiveNetWorthIdx].date);
        interestingPoints.push({
          date: milestoneDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          relativeTime: getRelativeTime(milestoneDate),
          description: 'Net worth becomes positive',
          icon: '💰',
        });
      }
    }

    // Net worth milestones
    const milestones = [100000, 250000, 500000, 1000000, 2000000];
    milestones.forEach(milestone => {
      const milestoneIdx = projectionData.net_worth.findIndex(point => point.value >= milestone);
      if (milestoneIdx > 0) {
        const milestoneDate = new Date(projectionData.net_worth[milestoneIdx].date);
        const yearsFromNow = getYearsFromNow(milestoneDate);
        const realValue = milestone / Math.pow(1 + config.inflation_rate, yearsFromNow);

        interestingPoints.push({
          date: milestoneDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          relativeTime: getRelativeTime(milestoneDate),
          description: `Net worth reaches ${formatCurrency(milestone)}`,
          icon: '🎯',
          realValue: realValue,
        });
      }
    });
  }

  // Debug logging
  console.log('Chart data:', {
    netWorthDataLength: netWorthData.length,
    cashFlowDataLength: cashFlowData.length,
    debtDataLength: debtData.length,
    finalNetWorth,
    initialNetWorth,
    events: eventMarkers.length
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
          {currentScenarioId && (
            <>
              <Button onClick={handleCloneScenario} variant="outline" size="sm">
                <IconCopy className="h-4 w-4 mr-2" />
                Clone
              </Button>
              <Button onClick={handleDeleteScenario} variant="outline" size="sm" className="text-destructive hover:text-destructive">
                <IconTrash className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Clone Scenario Dialog */}
      <Dialog open={cloneDialogOpen} onOpenChange={setCloneDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clone Scenario</DialogTitle>
            <DialogDescription>
              Create a copy of the current scenario
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="cloneName">Scenario Name</Label>
              <Input
                id="cloneName"
                placeholder="e.g., My Scenario (Copy)"
                value={cloneName}
                onChange={(e) => setCloneName(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCloneDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => cloneMutation.mutate(cloneName)} disabled={!cloneName || cloneMutation.isPending}>
              {cloneMutation.isPending ? 'Cloning...' : 'Clone Scenario'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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

      {/* Two Pane Layout */}
      <div className="grid grid-cols-5 gap-6 h-[calc(100vh-16rem)]">
        {/* Left Pane - Charts (3/5 width) */}
        <div className="col-span-3 space-y-6 overflow-y-auto pr-2">
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
                  Inflation Adj. Net Worth
                </CardTitle>
                <IconTrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(realNetWorth)}</div>
                <p className="text-xs text-muted-foreground">
                  In today's dollars
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Key Milestones */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconBulb className="h-5 w-5 text-yellow-500" />
                Key Milestones
              </CardTitle>
              <CardDescription>
                Important moments in your financial journey
              </CardDescription>
            </CardHeader>
            <CardContent>
              {interestingPoints.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No milestones to show yet. Adjust your configuration and recalculate.
                </p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {interestingPoints.map((point, idx) => (
                    <div key={idx} className="flex gap-3 p-3 rounded-lg border bg-muted/30">
                      <div className="text-2xl flex-shrink-0">{point.icon}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-tight">{point.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {point.date} • {point.relativeTime}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Charts */}
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
                        {eventMarkers.map((event) => (
                          <ReferenceLine
                            key={event.id}
                            x={event.chartDate}
                            stroke={getEventColor(event.type)}
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            label={{
                              value: getEventLabel(event),
                              position: 'top',
                              fill: getEventColor(event.type),
                              fontSize: 14,
                            }}
                          />
                        ))}
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
                    {eventMarkers.map((event) => (
                      <ReferenceLine
                        key={event.id}
                        x={event.chartDate}
                        stroke={getEventColor(event.type)}
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        label={{
                          value: getEventLabel(event),
                          position: 'top',
                          fill: getEventColor(event.type),
                          fontSize: 14,
                        }}
                      />
                    ))}
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
                      {eventMarkers.map((event) => (
                        <ReferenceLine
                          key={event.id}
                          x={event.chartDate}
                          stroke={getEventColor(event.type)}
                          strokeWidth={2}
                          strokeDasharray="5 5"
                          label={{
                            value: getEventLabel(event),
                            position: 'top',
                            fill: getEventColor(event.type),
                            fontSize: 14,
                          }}
                        />
                      ))}
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
        </div>

        {/* Right Pane - Configuration (2/5 width) */}
        <div className="col-span-2 space-y-6 overflow-y-auto pr-2">
          {/* Header */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <IconSettings className="h-5 w-5" />
                Configuration
              </h3>
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
            <p className="text-sm text-muted-foreground">
              Set your starting financial situation. The projection engine will apply automatic growth (salary increases, expense inflation)
              each year based on these rates. Use Events below to add one-time changes or overrides.
            </p>
          </div>

          {/* Section Header */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Base Configuration</h3>
            <p className="text-sm text-muted-foreground">
              Set your starting financial situation. The projection engine will apply automatic growth (salary increases, expense inflation)
              each year based on these rates. Loan and mortgage payments are calculated automatically from your accounts. Use Events below to add one-time changes or overrides.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Income & Salary</CardTitle>
              <CardDescription>
                Starting salary and automatic annual growth rate
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Income */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="annualSalary">Starting Annual Salary ($)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="annualSalary"
                      type="number"
                      min={0}
                      step={1000}
                      value={config.annual_salary}
                      onChange={(e) => setConfig({ ...config, annual_salary: Math.round(parseFloat(e.target.value) || 0) })}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="px-2"
                      onClick={() => openSensitivityAnalysis('annual_salary', 'Annual Salary', config.annual_salary)}
                      title="Analyze sensitivity"
                    >
                      <IconChartBar className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Your current gross annual salary
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="salaryGrowth">Automatic Annual Growth (%)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="salaryGrowth"
                      type="number"
                      min={0}
                      max={20}
                      step={0.1}
                      value={Math.round(config.annual_salary_growth * 10000) / 100}
                      onChange={(e) => setConfig({ ...config, annual_salary_growth: Math.round(parseFloat(e.target.value) * 100) / 10000 })}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="px-2"
                      onClick={() => openSensitivityAnalysis('annual_salary_growth', 'Annual Salary Growth', config.annual_salary_growth)}
                      title="Analyze sensitivity"
                    >
                      <IconChartBar className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Typical annual raise (e.g., 3% = inflation + merit)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tax Brackets</CardTitle>
              <CardDescription>
                Federal and provincial/state tax rates for calculating after-tax income
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
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
                                up_to_income: e.target.value === '' ? 0 : Math.round(parseFloat(e.target.value))
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
                              value={Math.round(bracket.rate * 10000) / 100}
                              onChange={(e) => {
                                const newBrackets = [...config.federal_tax_brackets];
                                newBrackets[idx] = { ...bracket, rate: Math.round(parseFloat(e.target.value) * 100) / 10000 };
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
                                up_to_income: e.target.value === '' ? 0 : Math.round(parseFloat(e.target.value))
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
                              value={Math.round(bracket.rate * 10000) / 100}
                              onChange={(e) => {
                                const newBrackets = [...config.provincial_tax_brackets];
                                newBrackets[idx] = { ...bracket, rate: Math.round(parseFloat(e.target.value) * 100) / 10000 };
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Expenses & Inflation</CardTitle>
              <CardDescription>
                Starting monthly expenses and automatic inflation rate
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="monthlyExpenses">Starting Monthly Expenses ($)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="monthlyExpenses"
                      type="number"
                      min={0}
                      step={100}
                      value={config.monthly_expenses}
                      onChange={(e) => setConfig({ ...config, monthly_expenses: Math.round(parseFloat(e.target.value) || 0) })}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="px-2"
                      onClick={() => openSensitivityAnalysis('monthly_expenses', 'Monthly Expenses', config.monthly_expenses)}
                      title="Analyze sensitivity"
                    >
                      <IconChartBar className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Living expenses (rent, food, utilities, etc.). Excludes loan/mortgage payments - those are calculated automatically.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expenseGrowth">Automatic Annual Growth (%)</Label>
                  <Input
                    id="expenseGrowth"
                    type="number"
                    min={0}
                    max={20}
                    step={0.1}
                    value={Math.round(config.annual_expense_growth * 10000) / 100}
                    onChange={(e) => setConfig({ ...config, annual_expense_growth: Math.round(parseFloat(e.target.value) * 100) / 10000 })}
                  />
                  <p className="text-sm text-muted-foreground">
                    Typically matches inflation rate (2-3%)
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="inflationRate">General Inflation Rate (%)</Label>
                <div className="flex gap-2">
                  <Input
                    id="inflationRate"
                    type="number"
                    min={0}
                    max={10}
                    step={0.1}
                    value={Math.round(config.inflation_rate * 10000) / 100}
                    onChange={(e) => setConfig({ ...config, inflation_rate: Math.round(parseFloat(e.target.value) * 100) / 10000 })}
                    className="w-32"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="px-2"
                    onClick={() => openSensitivityAnalysis('inflation_rate', 'Inflation Rate', config.inflation_rate)}
                    title="Analyze sensitivity"
                  >
                    <IconChartBar className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Used for future value calculations
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Investment Returns</CardTitle>
              <CardDescription>
                Investment allocation and expected returns by account type
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="savingsRate">Savings Invested (%)</Label>
                <div className="flex gap-2">
                  <Input
                    id="savingsRate"
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={Math.round(config.monthly_savings_rate * 10000) / 100}
                    onChange={(e) => setConfig({ ...config, monthly_savings_rate: Math.round(parseFloat(e.target.value) * 100) / 10000 })}
                    className="w-32"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="px-2"
                    onClick={() => openSensitivityAnalysis('monthly_savings_rate', 'Savings Invested Rate', config.monthly_savings_rate)}
                    title="Analyze sensitivity"
                  >
                    <IconChartBar className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  % of leftover money (after expenses) that gets invested. Remainder goes to cash/checking.
                </p>
              </div>

              <div className="space-y-4">
                <Label>Expected Annual Returns (%)</Label>
                <p className="text-xs text-muted-foreground">
                  Expected returns by investment account type (compounded monthly)
                </p>
                <div className="grid gap-3">
                  {Object.entries(config.investment_returns).map(([accountType, rate]) => (
                    <div key={accountType} className="flex items-center gap-3">
                      <Label className="w-32 capitalize">{accountType.replace('_', ' ')}</Label>
                      <Input
                        type="number"
                        min={-20}
                        max={50}
                        step={0.5}
                        value={Math.round(rate * 10000) / 100}
                        onChange={(e) => setConfig({
                          ...config,
                          investment_returns: {
                            ...config.investment_returns,
                            [accountType]: Math.round(parseFloat(e.target.value) * 100) / 10000,
                          },
                        })}
                        className="w-32"
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="px-2"
                        onClick={() => openSensitivityAnalysis(
                          `investment_returns.${accountType}`,
                          `${accountType.replace('_', ' ')} Returns`,
                          rate,
                          (path, value) => ({
                            ...config,
                            investment_returns: {
                              ...config.investment_returns,
                              [accountType]: value,
                            },
                          })
                        )}
                        title="Analyze sensitivity"
                      >
                        <IconChartBar className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section Divider */}
          <div className="space-y-2 pt-4">
            <h3 className="text-lg font-semibold">Events & Milestones</h3>
            <p className="text-sm text-muted-foreground">
              Add specific life events that override the baseline. For example: promotions change your salary,
              major expenses like buying a car, or extra debt payments. Events apply at a specific date and can
              have lasting effects on your projection.
            </p>
          </div>

          {/* Events & Milestones */}
          <EventsList
            events={config.events}
            onEventsChange={(events) => setConfig({ ...config, events })}
            baseConfig={config}
          />

          <Card>
            <CardContent className="pt-6">
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
        </div>
      </div>

      {/* Sensitivity Analysis Dialog */}
      {sensitivityParameter && (
        <SensitivityAnalysisDialog
          open={sensitivityDialogOpen}
          onOpenChange={setSensitivityDialogOpen}
          parameterName={sensitivityParameter.name}
          parameterLabel={sensitivityParameter.label}
          currentValue={sensitivityParameter.value}
          baseConfig={config}
          onUpdateValue={sensitivityParameter.updateFn}
        />
      )}
    </div>
  );
}
