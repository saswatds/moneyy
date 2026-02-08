import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueries } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { ProjectionConfig, ProjectionResponse, EquityGrantWithSummary } from '@/lib/api-client';
import { useExchangeRates } from '@/hooks/use-exchange-rates';
import { useAnnualIncomeSummary, useIncomeTaxConfig } from '@/hooks/use-income';
import { EventsList } from '@/components/projections/EventsList';
import { SensitivityAnalysisDialog } from '@/components/projections/SensitivityAnalysisDialog';
import { CurrencyInput } from '@/components/projections/CurrencyInput';
import { PercentageInput } from '@/components/projections/PercentageInput';
import { TaxSimulator } from '@/components/options/tax-simulator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Line, LineChart, Area, AreaChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, ReferenceArea } from 'recharts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  IconSettings,
  IconCalculator,
  IconAlertCircle,
  IconPlus,
  IconTrash,
  IconBulb,
  IconCopy,
  IconInfoCircle,
  IconLink,
  IconRefresh,
  IconTrendingUp,
  IconCoin,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Currency } from '@/components/ui/currency';

const defaultConfig: ProjectionConfig = {
  time_horizon_years: 5,
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
    'brokerage': 0.06,
    'crypto': 0.10,
  },
  extra_debt_payments: {},
  asset_appreciation: {
    'real_estate': 0.04,
    'vehicle': -0.15,
  },
  savings_allocation: {
    'tfsa': 0.5,
    'rrsp': 0.5,
  },
  events: [],
};

export function Simulation() {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  const [config, setConfig] = useState<ProjectionConfig>(defaultConfig);
  const [projectionData, setProjectionData] = useState<ProjectionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentScenarioId, setCurrentScenarioId] = useState<string | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [scenarioName, setScenarioName] = useState('');
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [cloneName, setCloneName] = useState('');
  const [sensitivityDialogOpen, setSensitivityDialogOpen] = useState(false);
  const [useComputedIncome, setUseComputedIncome] = useState(true);
  const [useComputedExpenses, setUseComputedExpenses] = useState(true);
  const [sensitivityParameter, setSensitivityParameter] = useState<{
    name: string;
    label: string;
    value: number;
    updateFn?: (path: string, value: number) => ProjectionConfig;
  } | null>(null);
  const [activeTab, setActiveTab] = useState('financial');

  // Fetch income and tax configuration from Income & Taxes system
  const { data: incomeSummary } = useAnnualIncomeSummary(currentYear);
  const { data: taxConfig } = useIncomeTaxConfig(currentYear);

  // Computed values from Income & Taxes system
  const computedAnnualIncome = useMemo(() => {
    if (!incomeSummary) return 0;
    return incomeSummary.total_gross_income + incomeSummary.stock_options_benefit;
  }, [incomeSummary]);

  const syncedFederalBrackets = useMemo(() => {
    if (!taxConfig?.federal_brackets?.length) return defaultConfig.federal_tax_brackets;
    return taxConfig.federal_brackets;
  }, [taxConfig]);

  const syncedProvincialBrackets = useMemo(() => {
    if (!taxConfig?.provincial_brackets?.length) return defaultConfig.provincial_tax_brackets;
    return taxConfig.provincial_brackets;
  }, [taxConfig]);

  // Load scenarios
  const { data: scenariosData, refetch: refetchScenarios } = useQuery({
    queryKey: ['projection-scenarios'],
    queryFn: () => apiClient.getScenarios(),
  });

  // Load recurring expenses
  const { data: recurringExpensesData } = useQuery({
    queryKey: ['recurring-expenses'],
    queryFn: () => apiClient.getRecurringExpenses(),
  });

  // Load accounts to get account names for debts and find stock_options accounts
  const { data: accountsData } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => apiClient.getAccounts(),
  });

  // Filter for stock_options accounts
  const stockOptionsAccounts = useMemo(() => {
    return accountsData?.accounts.filter(acc => acc.type === 'stock_options') || [];
  }, [accountsData]);

  // Fetch options summary for each stock_options account
  const optionsSummaryQueries = useQueries({
    queries: stockOptionsAccounts.map(acc => ({
      queryKey: ['options-summary', acc.id],
      queryFn: () => apiClient.getOptionsSummary(acc.id),
      enabled: stockOptionsAccounts.length > 0,
    })),
  });

  // Combine all grants from all options accounts
  const allOptionsGrants = useMemo<EquityGrantWithSummary[]>(() => {
    const grants: EquityGrantWithSummary[] = [];
    for (const query of optionsSummaryQueries) {
      if (query.data?.grants) {
        grants.push(...query.data.grants);
      }
    }
    return grants;
  }, [optionsSummaryQueries]);

  const hasOptionsAccounts = stockOptionsAccounts.length > 0;

  // Load exchange rates for currency conversion
  const { data: exchangeRates } = useExchangeRates();

  // Calculate projection
  const calculateMutation = useMutation({
    mutationFn: () => {
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

  // Auto-load first scenario on mount if scenarios exist
  useEffect(() => {
    if (scenariosData?.scenarios && scenariosData.scenarios.length > 0 && !currentScenarioId && !projectionData) {
      // Find default scenario or use first one
      const defaultScenario = scenariosData.scenarios.find(s => s.is_default) || scenariosData.scenarios[0];
      const newConfig = defaultScenario.config;
      const newScenarioId = defaultScenario.id;

      // Use a microtask to batch the state updates
      Promise.resolve().then(() => {
        setConfig(newConfig);
        setCurrentScenarioId(newScenarioId);
        // Trigger calculation after state is set
        setTimeout(() => {
          calculateMutation.mutate();
        }, 100);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenariosData, currentScenarioId, projectionData]);

  // Helper to convert currency to CAD
  const convertToCAD = (amount: number, fromCurrency: string): number => {
    if (!exchangeRates?.rates || fromCurrency === 'CAD') {
      return amount;
    }
    const rate = exchangeRates.rates[fromCurrency]?.['CAD'];
    if (!rate) return amount; // Fallback to original amount if rate not found
    return amount * rate;
  };

  // Calculate monthly total from recurring expenses (converted to CAD)
  const computedRecurringExpenses = recurringExpensesData?.expenses
    .filter(e => e.is_active)
    .reduce((total, expense) => {
      let monthlyAmount = 0;
      switch (expense.frequency) {
        case 'weekly':
          monthlyAmount = expense.amount * 4.33;
          break;
        case 'bi-weekly':
          monthlyAmount = expense.amount * 2.17;
          break;
        case 'monthly':
          monthlyAmount = expense.amount;
          break;
        case 'quarterly':
          monthlyAmount = expense.amount / 3;
          break;
        case 'annually':
          monthlyAmount = expense.amount / 12;
          break;
      }
      // Convert to CAD before adding to total
      const monthlyAmountInCAD = convertToCAD(monthlyAmount, expense.currency);
      return total + monthlyAmountInCAD;
    }, 0) || 0;

  // Calculate monthly total from inferred expenses (loans/mortgages)
  const computedInferredExpenses = recurringExpensesData?.inferred_expenses?.reduce((total, expense) => {
    let monthlyAmount = 0;
    switch (expense.frequency) {
      case 'weekly':
        monthlyAmount = expense.amount * 4.33;
        break;
      case 'bi-weekly':
        monthlyAmount = expense.amount * 2.17;
        break;
      case 'monthly':
        monthlyAmount = expense.amount;
        break;
      case 'quarterly':
        monthlyAmount = expense.amount / 3;
        break;
      case 'annually':
        monthlyAmount = expense.amount / 12;
        break;
      default:
        monthlyAmount = expense.amount;
    }
    const monthlyAmountInCAD = convertToCAD(monthlyAmount, expense.currency);
    return total + monthlyAmountInCAD;
  }, 0) || 0;

  const totalRecurringExpenses = computedRecurringExpenses + computedInferredExpenses;

  // Computed monthly expenses (this is what's actually tracked)
  const computedMonthlyExpenses = totalRecurringExpenses;

  // Sync computed values when data loads (only if using computed values and not loading a scenario)
  useEffect(() => {
    if (useComputedIncome && computedAnnualIncome > 0 && !currentScenarioId) {
      setConfig(prev => ({ ...prev, annual_salary: computedAnnualIncome }));
    }
  }, [computedAnnualIncome, useComputedIncome, currentScenarioId]);

  useEffect(() => {
    if (useComputedExpenses && computedMonthlyExpenses > 0 && !currentScenarioId) {
      setConfig(prev => ({ ...prev, monthly_expenses: computedMonthlyExpenses }));
    }
  }, [computedMonthlyExpenses, useComputedExpenses, currentScenarioId]);

  useEffect(() => {
    if (taxConfig && !currentScenarioId) {
      setConfig(prev => ({
        ...prev,
        federal_tax_brackets: syncedFederalBrackets,
        provincial_tax_brackets: syncedProvincialBrackets,
      }));
    }
  }, [syncedFederalBrackets, syncedProvincialBrackets, taxConfig, currentScenarioId]);

  const handleCalculate = () => {
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

  // Get marginal tax rate for a given income
  const getMarginalRate = (income: number, brackets: { up_to_income: number; rate: number }[]) => {
    for (const bracket of brackets) {
      if (bracket.up_to_income === 0 || income <= bracket.up_to_income) {
        return bracket.rate;
      }
    }
    return brackets[brackets.length - 1]?.rate || 0;
  };

  const federalRate = getMarginalRate(config.annual_salary, config.federal_tax_brackets);
  const provincialRate = getMarginalRate(config.annual_salary, config.provincial_tax_brackets);

  const openSensitivityAnalysis = (
    name: string,
    label: string,
    value: number,
    updateFn?: (path: string, value: number) => ProjectionConfig
  ) => {
    setSensitivityParameter({ name, label, value, updateFn });
    setSensitivityDialogOpen(true);
  };


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
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
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
  const getEventLabel = (event: { type: string }) => {
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

  // Prepare net worth data with debt-to-asset ratio zone color
  const netWorthData = projectionData?.net_worth.map((point, idx) => {
    const assets = projectionData.assets[idx]?.value || 0;
    const liabilities = projectionData.liabilities[idx]?.value || 0;
    const netWorth = point.value;

    // Calculate debt-to-asset ratio at this point
    const debtToAssetRatio = assets > 0 ? Math.abs(liabilities) / assets : 0;

    // Determine zone color based on ratio
    let zoneColor = '#10b981'; // Default green
    if (debtToAssetRatio === 0) {
      zoneColor = '#10b981'; // Green - Debt-free
    } else if (debtToAssetRatio < 0.3) {
      zoneColor = '#10b981'; // Green - Excellent
    } else if (debtToAssetRatio < 0.5) {
      zoneColor = '#3b82f6'; // Blue - Good
    } else if (debtToAssetRatio < 0.7) {
      zoneColor = '#eab308'; // Yellow - Moderate
    } else {
      zoneColor = '#ef4444'; // Red - High debt
    }

    return {
      date: formatDate(point.date),
      netWorth: netWorth,
      assets: assets,
      liabilities: liabilities,
      debtToAssetRatio: debtToAssetRatio,
      zoneColor: zoneColor,
    };
  }) || [];


  // Prepare cash flow data
  const cashFlowData = projectionData?.cash_flow.map((point) => ({
    date: formatDate(point.date),
    income: point.income,
    expenses: point.expenses,
    net: point.net,
  })) || [];

  // Prepare debt payoff data with individual debts
  const debtData = projectionData?.debt_payoff.map((point) => ({
    date: formatDate(point.date),
    totalDebt: point.total_debt,
    ...point.debts, // Spread individual debt balances
  })) || [];

  // Get unique debt account IDs from the data
  const uniqueDebtAccounts = projectionData?.debt_payoff.reduce((accounts, point) => {
    Object.keys(point.debts).forEach(accountId => {
      if (!accounts.includes(accountId)) {
        accounts.push(accountId);
      }
    });
    return accounts;
  }, [] as string[]) || [];

  // Color palette for different debts
  const debtColors = [
    '#ef4444', // red
    '#f97316', // orange
    '#f59e0b', // amber
    '#eab308', // yellow
    '#84cc16', // lime
    '#22c55e', // green
    '#10b981', // emerald
    '#14b8a6', // teal
    '#06b6d4', // cyan
    '#0ea5e9', // sky
    '#3b82f6', // blue
    '#6366f1', // indigo
    '#8b5cf6', // violet
    '#a855f7', // purple
    '#d946ef', // fuchsia
    '#ec4899', // pink
  ];

  // Helper to get account name by ID
  const getAccountName = (accountId: string): string => {
    const account = accountsData?.accounts.find(acc => acc.id === accountId);
    return account?.name || accountId;
  };

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

  return (
    <div className="flex flex-col max-h-[calc(100vh-5rem)]">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Simulation</h1>
          <p className="text-muted-foreground mt-2">
            Model your financial future and plan stock option exercises
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0 mt-4">
        <TabsList className="shrink-0">
          <TabsTrigger value="financial" className="flex items-center gap-2">
            <IconTrendingUp className="h-4 w-4" />
            Financial Projection
          </TabsTrigger>
          <TabsTrigger value="options-tax" className="flex items-center gap-2" disabled={!hasOptionsAccounts}>
            <IconCoin className="h-4 w-4" />
            Options Tax
          </TabsTrigger>
        </TabsList>

        <TabsContent value="financial" className="flex-1 flex flex-col min-h-0 mt-4 data-[state=inactive]:hidden">
      <div className="flex items-center justify-end shrink-0 mb-4">
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

      {error && (
        <Card className="border-destructive shrink-0 mt-4">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <IconAlertCircle className="h-5 w-5" />
              <p>{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Two Pane Layout */}
      <div className="grid grid-cols-5 gap-6 flex-1 min-h-0 mt-4 -mx-1">
        {/* Left Pane - Charts (3/5 width) */}
        <div className="col-span-3 space-y-3 overflow-y-auto px-1 pb-1">
          {/* Summary Stats */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Projected Net Worth</CardDescription>
                <div className="mt-2">
                  <div className="text-2xl font-bold tabular-nums"><Currency amount={finalNetWorth} decimals={0} /></div>
                  <div className="text-sm text-muted-foreground mt-1">In {config.time_horizon_years} years</div>
                </div>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Net Worth Growth</CardDescription>
                <div className="mt-2">
                  <div className="text-2xl font-bold tabular-nums"><Currency amount={netWorthGrowth} decimals={0} /></div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {((netWorthGrowth / Math.max(initialNetWorth, 1)) * 100).toFixed(1)}% increase
                  </div>
                </div>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Remaining Debt</CardDescription>
                <div className="mt-2">
                  <div className="text-2xl font-bold tabular-nums"><Currency amount={finalDebt} decimals={0} /></div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {finalDebt === 0 ? 'Debt-free!' : `In ${config.time_horizon_years} years`}
                  </div>
                </div>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Inflation Adjusted</CardDescription>
                <div className="mt-2">
                  <div className="text-2xl font-bold tabular-nums"><Currency amount={realNetWorth} decimals={0} /></div>
                  <div className="text-sm text-muted-foreground mt-1">In today's dollars</div>
                </div>
              </CardHeader>
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
                  <div className="flex items-center gap-1.5">
                    <CardTitle>Net Worth Projection</CardTitle>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="text-muted-foreground hover:text-foreground transition-colors">
                          <IconInfoCircle className="h-4 w-4" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80">
                        <div className="space-y-3">
                          <div>
                            <h4 className="font-medium text-sm mb-2">Background Color Zones</h4>
                            <p className="text-xs text-muted-foreground">
                              The background color shows your debt-to-asset ratio at each point in time.
                            </p>
                          </div>
                          <div className="space-y-2 text-xs">
                            <div className="flex items-start gap-3">
                              <div className="w-16 h-4 rounded" style={{ backgroundColor: '#10b981', opacity: 0.3 }}></div>
                              <div className="flex-1">
                                <div className="font-medium text-green-600 dark:text-green-400">0-30% Debt</div>
                                <div className="text-muted-foreground">Debt-free or excellent financial position</div>
                              </div>
                            </div>
                            <div className="flex items-start gap-3">
                              <div className="w-16 h-4 rounded" style={{ backgroundColor: '#3b82f6', opacity: 0.3 }}></div>
                              <div className="flex-1">
                                <div className="font-medium text-blue-600 dark:text-blue-400">30-50% Debt</div>
                                <div className="text-muted-foreground">Good debt level, well managed</div>
                              </div>
                            </div>
                            <div className="flex items-start gap-3">
                              <div className="w-16 h-4 rounded" style={{ backgroundColor: '#eab308', opacity: 0.3 }}></div>
                              <div className="flex-1">
                                <div className="font-medium text-yellow-600 dark:text-yellow-400">50-70% Debt</div>
                                <div className="text-muted-foreground">Moderate debt level, consider paying down</div>
                              </div>
                            </div>
                            <div className="flex items-start gap-3">
                              <div className="w-16 h-4 rounded" style={{ backgroundColor: '#ef4444', opacity: 0.3 }}></div>
                              <div className="flex-1">
                                <div className="font-medium text-red-600 dark:text-red-400">&gt;70% Debt</div>
                                <div className="text-muted-foreground">High debt level, focus on debt reduction</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
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

                        {/* Dynamic background bands - colored by debt-to-asset ratio zone */}
                        {netWorthData.map((entry, index) => {
                          if (index === netWorthData.length - 1) return null;
                          const nextEntry = netWorthData[index + 1];
                          return (
                            <ReferenceArea
                              key={`zone-${index}`}
                              x1={entry.date}
                              x2={nextEntry.date}
                              fill={entry.zoneColor}
                              fillOpacity={0.05}
                              strokeOpacity={0}
                            />
                          );
                        })}

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
                  Individual debt balances over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={debtData}>
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
                      {uniqueDebtAccounts.map((accountId, idx) => (
                        <Area
                          key={accountId}
                          type="monotone"
                          dataKey={accountId}
                          stackId="1"
                          stroke={debtColors[idx % debtColors.length]}
                          fill={debtColors[idx % debtColors.length]}
                          fillOpacity={0.6}
                          name={getAccountName(accountId)}
                        />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Pane - Configuration (2/5 width) */}
        <div className="col-span-2 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-1">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <IconSettings className="h-5 w-5" />
                  <CardTitle>Configuration</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    id="timeHorizon"
                    type="number"
                    min={1}
                    max={30}
                    value={config.time_horizon_years}
                    onChange={(e) => setConfig({ ...config, time_horizon_years: parseInt(e.target.value) })}
                    className="w-16"
                  />
                  <span className="text-sm text-muted-foreground">years</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Income Section */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium border-b pb-2">Income</h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Annual Income</Label>
                    <CurrencyInput
                      value={config.annual_salary}
                      onChange={(value) => {
                        setUseComputedIncome(false);
                        setConfig({ ...config, annual_salary: value });
                      }}
                      step={1000}
                      onAnalyze={() => openSensitivityAnalysis('annual_salary', 'Annual Income', config.annual_salary)}
                    />
                    {computedAnnualIncome > 0 && (
                      config.annual_salary !== computedAnnualIncome ? (
                        <button
                          type="button"
                          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                          onClick={() => {
                            setUseComputedIncome(true);
                            setConfig(prev => ({ ...prev, annual_salary: computedAnnualIncome }));
                          }}
                        >
                          <IconRefresh className="h-3 w-3" />
                          Use tracked: ${Math.round(computedAnnualIncome).toLocaleString()}
                        </button>
                      ) : (
                        <p className="text-xs text-muted-foreground">Using tracked income</p>
                      )
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      Annual Growth
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="text-muted-foreground hover:text-foreground">
                            <IconInfoCircle className="h-3.5 w-3.5" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 text-sm">
                          Expected yearly salary increase from raises, promotions, or cost-of-living adjustments. Typical range: 2-5% annually.
                        </PopoverContent>
                      </Popover>
                    </Label>
                    <PercentageInput
                      value={config.annual_salary_growth}
                      onChange={(value) => setConfig({ ...config, annual_salary_growth: value })}
                      max={20}
                      onAnalyze={() => openSensitivityAnalysis('annual_salary_growth', 'Annual Salary Growth', config.annual_salary_growth)}
                    />
                  </div>
                </div>
              </div>

              {/* Expenses Section */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium border-b pb-2">Expenses</h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Monthly Expenses</Label>
                    <CurrencyInput
                      value={config.monthly_expenses}
                      onChange={(value) => {
                        setUseComputedExpenses(false);
                        setConfig({ ...config, monthly_expenses: value });
                      }}
                      onAnalyze={() => openSensitivityAnalysis('monthly_expenses', 'Monthly Expenses', config.monthly_expenses)}
                    />
                    {computedMonthlyExpenses > 0 && (
                      config.monthly_expenses !== computedMonthlyExpenses ? (
                        <button
                          type="button"
                          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                          onClick={() => {
                            setUseComputedExpenses(true);
                            setConfig(prev => ({ ...prev, monthly_expenses: computedMonthlyExpenses }));
                          }}
                        >
                          <IconRefresh className="h-3 w-3" />
                          Use tracked: ${Math.round(computedMonthlyExpenses).toLocaleString()}/mo
                        </button>
                      ) : (
                        <p className="text-xs text-muted-foreground">Using tracked expenses</p>
                      )
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      Annual Growth
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="text-muted-foreground hover:text-foreground">
                            <IconInfoCircle className="h-3.5 w-3.5" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 text-sm">
                          How much your expenses are expected to increase each year due to lifestyle changes. Often set to match or slightly exceed inflation.
                        </PopoverContent>
                      </Popover>
                    </Label>
                    <PercentageInput
                      value={config.annual_expense_growth}
                      onChange={(value) => setConfig({ ...config, annual_expense_growth: value })}
                      max={20}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    Inflation Rate
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="text-muted-foreground hover:text-foreground">
                          <IconInfoCircle className="h-3.5 w-3.5" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 text-sm">
                        General price increase rate used to calculate the real (inflation-adjusted) value of your future net worth. Historical average: 2-3%.
                      </PopoverContent>
                    </Popover>
                  </Label>
                  <PercentageInput
                    value={config.inflation_rate}
                    onChange={(value) => setConfig({ ...config, inflation_rate: value })}
                    max={10}
                    onAnalyze={() => openSensitivityAnalysis('inflation_rate', 'Inflation Rate', config.inflation_rate)}
                    className="w-48"
                  />
                </div>
              </div>

              {/* Investments Section */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium border-b pb-2">Investments</h4>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    % Invested
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="text-muted-foreground hover:text-foreground">
                          <IconInfoCircle className="h-3.5 w-3.5" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 text-sm">
                        Percentage of your leftover income (after expenses) that gets invested. The remainder stays as cash in checking/savings accounts.
                      </PopoverContent>
                    </Popover>
                  </Label>
                  <PercentageInput
                    value={config.monthly_savings_rate}
                    onChange={(value) => setConfig({ ...config, monthly_savings_rate: value })}
                    step={1}
                    onAnalyze={() => openSensitivityAnalysis('monthly_savings_rate', '% Invested', config.monthly_savings_rate)}
                    className="w-48"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    Expected Returns
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="text-muted-foreground hover:text-foreground">
                          <IconInfoCircle className="h-3.5 w-3.5" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 text-sm">
                        Assumed annual return for each investment account type. Stock market historical average: 7-10%. These returns are compounded monthly.
                      </PopoverContent>
                    </Popover>
                  </Label>
                  <div className="grid gap-2">
                    {Object.entries(config.investment_returns).map(([accountType, rate]) => (
                      <div key={accountType} className="flex items-center gap-3">
                        <Label className="w-24 text-xs capitalize">{accountType.replace('_', ' ')}</Label>
                        <PercentageInput
                          value={rate}
                          onChange={(value) => setConfig({
                            ...config,
                            investment_returns: { ...config.investment_returns, [accountType]: value },
                          })}
                          min={-20}
                          max={50}
                          step={0.5}
                          onAnalyze={() => openSensitivityAnalysis(
                            `investment_returns.${accountType}`,
                            `${accountType.replace('_', ' ')} Returns`,
                            rate,
                            (_path, value) => ({
                              ...config,
                              investment_returns: { ...config.investment_returns, [accountType]: value },
                            })
                          )}
                          className="flex-1"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tax Rate Display */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium border-b pb-2">Taxes</h4>
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm">
                      Marginal Rate: <span className="font-medium">{((federalRate + provincialRate) * 100).toFixed(1)}%</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(federalRate * 100).toFixed(1)}% federal + {(provincialRate * 100).toFixed(1)}% {taxConfig?.province || 'provincial'}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                    onClick={() => navigate('/income-taxes')}
                  >
                    <IconLink className="h-3 w-3" />
                    Configure
                  </button>
                </div>
              </div>

            </CardContent>
          </Card>

          {/* Events - separate card since it has its own complex UI */}
          <div className="mt-6 pb-4">
            <EventsList
              events={config.events}
              onEventsChange={(events) => setConfig({ ...config, events })}
              baseConfig={config}
            />
          </div>
          </div>

          {/* Sticky Recalculate Button */}
          <div className="shrink-0 p-3 border-t bg-background">
            <Button
              onClick={() => {
                handleCalculate();
                if (currentScenarioId) {
                  handleSaveScenario();
                }
              }}
              className="w-full"
              disabled={calculateMutation.isPending || saveMutation.isPending}
            >
              <IconCalculator className="h-4 w-4 mr-2" />
              {calculateMutation.isPending ? 'Calculating...' : saveMutation.isPending ? 'Saving...' : 'Recalculate'}
            </Button>
          </div>
        </div>
      </div>
        </TabsContent>

        <TabsContent value="options-tax" className="flex-1 overflow-y-auto mt-4 data-[state=inactive]:hidden">
          {hasOptionsAccounts ? (
            <TaxSimulator grants={allOptionsGrants} />
          ) : (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-muted-foreground">
                  <IconCoin className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No Stock Options Accounts</h3>
                  <p className="text-sm">
                    Add a stock options account to use the options tax simulator.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

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
