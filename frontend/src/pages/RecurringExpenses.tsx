import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { RecurringExpense } from '@/lib/api-client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { IconPlus, IconEdit, IconTrash } from '@tabler/icons-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AddRecurringExpenseDialog } from '@/components/AddRecurringExpenseDialog';
import { EditRecurringExpenseDialog } from '@/components/EditRecurringExpenseDialog';
import { DeleteRecurringExpenseDialog } from '@/components/DeleteRecurringExpenseDialog';

const formatNumberOnly = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));
};

const formatNumberWithSmallCents = (amount: number) => {
  const formatted = formatNumberOnly(amount);
  const [dollars, cents] = formatted.split('.');
  return (
    <>
      {dollars}
      <span className="text-xl">.{cents}</span>
    </>
  );
};

const getFrequencyLabel = (frequency: string) => {
  switch (frequency) {
    case 'weekly':
      return 'Weekly';
    case 'bi-weekly':
      return 'Bi-Weekly';
    case 'monthly':
      return 'Monthly';
    case 'quarterly':
      return 'Quarterly';
    case 'annually':
      return 'Annually';
    default:
      return frequency;
  }
};

const groupByCategory = (expenses: RecurringExpense[]) => {
  const grouped = expenses.reduce((acc, expense) => {
    if (!acc[expense.category]) {
      acc[expense.category] = [];
    }
    acc[expense.category].push(expense);
    return acc;
  }, {} as Record<string, RecurringExpense[]>);

  return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
};

const getCategoryBadgeColor = (category: string) => {
  const colors: Record<string, string> = {
    housing: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    utilities: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    transportation: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    food: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    healthcare: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    insurance: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
    entertainment: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400',
    subscriptions: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
    debt: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    savings: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    other: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  };
  return colors[category] || colors.other;
};

const calculateYearlyAmount = (expense: RecurringExpense) => {
  switch (expense.frequency) {
    case 'weekly':
      return expense.amount * 52;
    case 'bi-weekly':
      return expense.amount * 26;
    case 'monthly':
      return expense.amount * 12;
    case 'quarterly':
      return expense.amount * 4;
    case 'annually':
      return expense.amount;
    default:
      return 0;
  }
};

const calculateMonthlyTotal = (expenses: RecurringExpense[]) => {
  return expenses.reduce((total, expense) => {
    let monthlyAmount = 0;
    switch (expense.frequency) {
      case 'weekly':
        monthlyAmount = expense.amount * 4.33; // Average weeks per month
        break;
      case 'bi-weekly':
        monthlyAmount = expense.amount * 2.17; // 26 payments per year / 12
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
    return total + monthlyAmount;
  }, 0);
};

export function RecurringExpenses() {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<RecurringExpense | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [frequencyFilter, setFrequencyFilter] = useState<string>('all');
  const [currencyFilter, setCurrencyFilter] = useState<string>('all');

  const { data, isLoading, error } = useQuery({
    queryKey: ['recurring-expenses'],
    queryFn: () => apiClient.getRecurringExpenses(),
  });

  const activeExpenses = data?.expenses.filter(e => e.is_active) || [];

  // Apply filters
  const filteredExpenses = activeExpenses.filter((expense) => {
    if (categoryFilter !== 'all' && expense.category !== categoryFilter) return false;
    if (frequencyFilter !== 'all' && expense.frequency !== frequencyFilter) return false;
    if (currencyFilter !== 'all' && expense.currency !== currencyFilter) return false;
    return true;
  });

  const groupedExpenses = groupByCategory(filteredExpenses);
  const monthlyTotal = calculateMonthlyTotal(filteredExpenses);
  const annualTotal = monthlyTotal * 12;

  // Get unique categories, frequencies, and currencies for filters
  const categories = Array.from(new Set(activeExpenses.map(e => e.category))).sort();
  const frequencies = Array.from(new Set(activeExpenses.map(e => e.frequency))).sort();
  const currencies = Array.from(new Set(activeExpenses.map(e => e.currency))).sort();

  const handleEdit = (expense: RecurringExpense) => {
    setSelectedExpense(expense);
    setEditDialogOpen(true);
  };

  const handleDelete = (expense: RecurringExpense) => {
    setSelectedExpense(expense);
    setDeleteDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">Failed to load recurring expenses</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Recurring Expenses</h1>
          <p className="text-muted-foreground mt-2">
            Track your recurring monthly expenses
          </p>
        </div>
        <Button onClick={() => setAddDialogOpen(true)}>
          <IconPlus className="h-4 w-4 mr-2" />
          Add Expense
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Monthly Total</CardDescription>
            <div className="mt-2">
              <div className="text-3xl font-bold tabular-nums">
                {formatNumberWithSmallCents(monthlyTotal)}
              </div>
              <div className="text-sm text-muted-foreground mt-1">CAD</div>
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Annual Total</CardDescription>
            <div className="mt-2">
              <div className="text-3xl font-bold tabular-nums">
                {formatNumberWithSmallCents(annualTotal)}
              </div>
              <div className="text-sm text-muted-foreground mt-1">CAD</div>
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Active Expenses</CardDescription>
            <div className="mt-2">
              <div className="text-3xl font-bold tabular-nums">
                {activeExpenses.length}
              </div>
              <div className="text-sm text-muted-foreground mt-1">Tracked</div>
            </div>
          </CardHeader>
        </Card>
      </div>

      {/* Expenses Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Recurring Expenses</CardTitle>
              <CardDescription>
                Manage your recurring expenses
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      <span className="capitalize">{category}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={frequencyFilter} onValueChange={setFrequencyFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Frequencies</SelectItem>
                  {frequencies.map((frequency) => (
                    <SelectItem key={frequency} value={frequency}>
                      {getFrequencyLabel(frequency)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={currencyFilter} onValueChange={setCurrencyFilter}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Currencies</SelectItem>
                  {currencies.map((currency) => (
                    <SelectItem key={currency} value={currency}>
                      {currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredExpenses.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">
                {activeExpenses.length === 0
                  ? 'No recurring expenses tracked yet.'
                  : 'No expenses match the selected filters.'}
              </p>
              {activeExpenses.length === 0 && (
                <Button onClick={() => setAddDialogOpen(true)}>
                  <IconPlus className="h-4 w-4 mr-2" />
                  Add Your First Expense
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Yearly Total</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExpenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{expense.name}</div>
                        {expense.description && (
                          <div className="text-sm text-muted-foreground mt-0.5">
                            {expense.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`capitalize ${getCategoryBadgeColor(expense.category)}`}>
                        {expense.category}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {getFrequencyLabel(expense.frequency)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div>{formatNumberOnly(expense.amount)}</div>
                      <div className="text-xs text-muted-foreground">{expense.currency}</div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div>{formatNumberOnly(calculateYearlyAmount(expense))}</div>
                      <div className="text-xs text-muted-foreground">{expense.currency}</div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          title="Edit expense"
                          onClick={() => handleEdit(expense)}
                        >
                          <IconEdit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          title="Delete expense"
                          onClick={() => handleDelete(expense)}
                        >
                          <IconTrash className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AddRecurringExpenseDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
      />

      <EditRecurringExpenseDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        expense={selectedExpense}
      />

      <DeleteRecurringExpenseDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        expense={selectedExpense}
      />
    </div>
  );
}
