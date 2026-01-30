import { useState } from 'react';
import { useIncomeRecords, useAnnualIncomeSummary, useIncomeComparison } from '@/hooks/use-income';
import type { IncomeRecord, IncomeCategory } from '@/lib/api-client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { IconPlus } from '@tabler/icons-react';
import {
  AddIncomeDialog,
  EditIncomeDialog,
  DeleteIncomeDialog,
  IncomeTable,
  TaxSummaryCard,
  IncomeBreakdownChart,
  YearComparisonChart,
  YearSelector,
} from '@/components/income';

const formatNumber = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

const formatNumberWithSmallCents = (amount: number) => {
  const formatted = formatNumber(amount);
  const [dollars, cents] = formatted.split('.');
  return (
    <>
      {dollars}
      <span className="text-xl">.{cents}</span>
    </>
  );
};

const INCOME_CATEGORIES: { value: IncomeCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All Categories' },
  { value: 'employment', label: 'Employment' },
  { value: 'investment', label: 'Investment' },
  { value: 'rental', label: 'Rental' },
  { value: 'business', label: 'Business' },
  { value: 'other', label: 'Other' },
];

export function IncomeTaxes() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [categoryFilter, setCategoryFilter] = useState<IncomeCategory | 'all'>('all');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedIncome, setSelectedIncome] = useState<IncomeRecord | null>(null);

  // Fetch data
  const { data: recordsData, isLoading: recordsLoading } = useIncomeRecords(
    selectedYear,
    categoryFilter === 'all' ? undefined : categoryFilter
  );
  const { data: summary, isLoading: summaryLoading } = useAnnualIncomeSummary(selectedYear);
  const { data: comparison } = useIncomeComparison(currentYear - 4, currentYear);

  const records = recordsData?.records || [];

  const handleEdit = (income: IncomeRecord) => {
    setSelectedIncome(income);
    setEditDialogOpen(true);
  };

  const handleDelete = (income: IncomeRecord) => {
    setSelectedIncome(income);
    setDeleteDialogOpen(true);
  };

  if (recordsLoading || summaryLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Income & Taxes</h1>
          <p className="text-muted-foreground mt-2">
            Track your income sources and view tax calculations
          </p>
        </div>
        <div className="flex items-center gap-4">
          <YearSelector
            selectedYear={selectedYear}
            onYearChange={setSelectedYear}
          />
          <Button onClick={() => setAddDialogOpen(true)}>
            <IconPlus className="h-4 w-4 mr-2" />
            Add Income
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Gross Income</CardDescription>
              <div className="mt-2">
                <div className="text-3xl font-bold tabular-nums">
                  ${formatNumberWithSmallCents(summary.total_gross_income + summary.stock_options_benefit)}
                </div>
                <div className="text-sm text-muted-foreground mt-1">CAD</div>
              </div>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Tax</CardDescription>
              <div className="mt-2">
                <div className="text-3xl font-bold tabular-nums text-red-600">
                  ${formatNumberWithSmallCents(summary.total_tax)}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {(summary.effective_tax_rate * 100).toFixed(1)}% effective rate
                </div>
              </div>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Net Income</CardDescription>
              <div className="mt-2">
                <div className="text-3xl font-bold tabular-nums text-green-600">
                  ${formatNumberWithSmallCents(summary.net_income)}
                </div>
                <div className="text-sm text-muted-foreground mt-1">After all taxes</div>
              </div>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Tax Breakdown and Income Chart */}
      {summary && (
        <div className="grid gap-6 md:grid-cols-2">
          <TaxSummaryCard summary={summary} />
          <IncomeBreakdownChart summary={summary} />
        </div>
      )}

      {/* Income Records Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Income Records</CardTitle>
              <CardDescription>
                Manage your income sources for {selectedYear}
              </CardDescription>
            </div>
            <Select
              value={categoryFilter}
              onValueChange={(value) => setCategoryFilter(value as IncomeCategory | 'all')}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                {INCOME_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <IncomeTable
            records={records}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </CardContent>
      </Card>

      {/* Multi-Year Comparison */}
      {comparison && comparison.years.length > 0 && (
        <YearComparisonChart years={comparison.years} />
      )}

      {/* Dialogs */}
      <AddIncomeDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        defaultYear={selectedYear}
      />

      <EditIncomeDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        income={selectedIncome}
      />

      <DeleteIncomeDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        income={selectedIncome}
      />
    </div>
  );
}
