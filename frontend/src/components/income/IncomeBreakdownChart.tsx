import type { AnnualIncomeSummary } from '@/lib/api-client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Currency } from '@/components/ui/currency';

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

  // Donut chart calculations
  const size = 200;
  const strokeWidth = 40;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  let cumulativePercent = 0;
  const segments = data.map((item) => {
    const percent = item.value / total;
    const strokeDasharray = `${percent * circumference} ${circumference}`;
    const rotation = cumulativePercent * 360 - 90; // Start from top
    cumulativePercent += percent;
    return {
      ...item,
      percent,
      strokeDasharray,
      rotation,
    };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Income by Category</CardTitle>
        <CardDescription>Breakdown of income sources for {summary.tax_year}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6">
          {/* Donut Chart */}
          <div className="relative flex-shrink-0">
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
              {segments.map((segment, index) => (
                <circle
                  key={index}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={segment.strokeDasharray}
                  strokeLinecap="butt"
                  transform={`rotate(${segment.rotation} ${center} ${center})`}
                  className="transition-opacity hover:opacity-80"
                />
              ))}
            </svg>
            {/* Center text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <Currency amount={total} compact className="text-xl font-bold" />
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
          </div>

          {/* Legend */}
          <div className="flex-1 space-y-2">
            {data.map((item, index) => {
              const percentage = ((item.value / total) * 100).toFixed(1);
              return (
                <div key={index} className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                    <span className="text-sm truncate">{item.name}</span>
                    <span className="text-sm text-muted-foreground tabular-nums">
                      <Currency amount={item.value} decimals={0} /> ({percentage}%)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
