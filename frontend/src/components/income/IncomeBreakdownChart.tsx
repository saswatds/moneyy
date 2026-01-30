import type { AnnualIncomeSummary } from '@/lib/api-client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface IncomeBreakdownChartProps {
  summary: AnnualIncomeSummary;
}

const COLORS = {
  employment: '#3b82f6', // blue
  investment: '#22c55e', // green
  rental: '#a855f7', // purple
  business: '#f97316', // orange
  other: '#6b7280', // gray
  stock_options: '#ec4899', // pink
};

const formatNumber = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export function IncomeBreakdownChart({ summary }: IncomeBreakdownChartProps) {
  const data = [
    { name: 'Employment', value: summary.employment_income, color: COLORS.employment },
    { name: 'Investment', value: summary.investment_income, color: COLORS.investment },
    { name: 'Rental', value: summary.rental_income, color: COLORS.rental },
    { name: 'Business', value: summary.business_income, color: COLORS.business },
    { name: 'Other', value: summary.other_income, color: COLORS.other },
    { name: 'Stock Options', value: summary.stock_options_benefit, color: COLORS.stock_options },
  ].filter((item) => item.value > 0);

  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Income by Category</CardTitle>
          <CardDescription>Breakdown of income sources</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No income data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Income by Category</CardTitle>
        <CardDescription>Breakdown of income sources for {summary.tax_year}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Visual Bar Chart */}
          <div className="h-8 flex rounded-lg overflow-hidden">
            {data.map((item, index) => {
              const width = (item.value / total) * 100;
              return (
                <div
                  key={index}
                  style={{ width: `${width}%`, backgroundColor: item.color }}
                  className="transition-all hover:opacity-80"
                  title={`${item.name}: $${formatNumber(item.value)}`}
                />
              );
            })}
          </div>

          {/* Legend */}
          <div className="grid grid-cols-2 gap-3">
            {data.map((item, index) => {
              const percentage = ((item.value / total) * 100).toFixed(1);
              return (
                <div key={index} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{item.name}</div>
                    <div className="text-xs text-muted-foreground">
                      ${formatNumber(item.value)} ({percentage}%)
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Total */}
          <div className="border-t pt-3 flex justify-between items-center">
            <span className="font-medium">Total Gross Income</span>
            <span className="text-lg font-bold">${formatNumber(total)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
