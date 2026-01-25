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
import { AddRecurringExpenseDialog } from '@/components/AddRecurringExpenseDialog';
import { EditRecurringExpenseDialog } from '@/components/EditRecurringExpenseDialog';
import { DeleteRecurringExpenseDialog } from '@/components/DeleteRecurringExpenseDialog';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
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

  const { data, isLoading, error } = useQuery({
    queryKey: ['recurring-expenses'],
    queryFn: () => apiClient.getRecurringExpenses(),
  });

  const activeExpenses = data?.expenses.filter(e => e.is_active) || [];
  const groupedExpenses = groupByCategory(activeExpenses);
  const monthlyTotal = calculateMonthlyTotal(activeExpenses);
  const annualTotal = monthlyTotal * 12;

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
            <CardTitle className="text-sm font-medium">Monthly Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(monthlyTotal)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              From {activeExpenses.length} recurring expenses
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Annual Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(annualTotal)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Projected yearly spending
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Active Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeExpenses.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Tracked expenses
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Expenses by Category */}
      {groupedExpenses.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">
                No recurring expenses tracked yet.
              </p>
              <Button onClick={() => setAddDialogOpen(true)}>
                <IconPlus className="h-4 w-4 mr-2" />
                Add Your First Expense
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {groupedExpenses.map(([category, expenses]) => {
            const categoryMonthlyTotal = calculateMonthlyTotal(expenses);

            return (
              <Card key={category}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg capitalize">{category}</CardTitle>
                      <CardDescription>
                        {formatCurrency(categoryMonthlyTotal)}/month from {expenses.length} expense{expenses.length !== 1 ? 's' : ''}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {expenses.map((expense) => (
                      <div
                        key={expense.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3">
                            <div className="flex-1">
                              <p className="font-medium">{expense.name}</p>
                              {expense.description && (
                                <p className="text-sm text-muted-foreground mt-0.5">
                                  {expense.description}
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="font-semibold">{formatCurrency(calculateYearlyAmount(expense))}/year</p>
                              <p className="text-xs text-muted-foreground">
                                {getFrequencyLabel(expense.frequency)} - {formatCurrency(expense.amount)}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-1 ml-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            title="Edit expense"
                            onClick={() => handleEdit(expense)}
                          >
                            <IconEdit className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            title="Delete expense"
                            onClick={() => handleDelete(expense)}
                          >
                            <IconTrash className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

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
