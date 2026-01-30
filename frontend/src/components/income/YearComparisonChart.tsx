import type { YearSummary } from '@/lib/api-client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface YearComparisonChartProps {
  years: YearSummary[];
}

const formatNumber = (amount: number) => {
  if (amount >= 1000000) {
    return '$' + (amount / 1000000).toFixed(1) + 'M';
  }
  if (amount >= 1000) {
    return '$' + (amount / 1000).toFixed(0) + 'K';
  }
  return '$' + amount.toFixed(0);
};

const formatFullNumber = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export function YearComparisonChart({ years }: YearComparisonChartProps) {
  if (years.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Multi-Year Comparison</CardTitle>
          <CardDescription>Compare income across years</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No comparison data available
          </div>
        </CardContent>
      </Card>
    );
  }

  const sortedYears = [...years].sort((a, b) => a.year - b.year);
  const maxValue = Math.max(...sortedYears.map((y) => y.total_gross_income)) * 1.1; // 10% padding
  const chartHeight = 200;

  // Generate line path
  const generateLinePath = (data: number[]) => {
    if (data.length === 0) return '';
    const points = data.map((value, index) => {
      const x = (index / (data.length - 1)) * 100;
      const y = chartHeight - (value / maxValue) * chartHeight;
      return `${x},${y}`;
    });
    return `M${points.join(' L')}`;
  };

  // Generate stacked area path (from bottom value to top value)
  const generateStackedAreaPath = (bottomData: number[], topData: number[]) => {
    if (bottomData.length === 0) return '';

    // Top line (left to right)
    const topPoints = topData.map((value, index) => {
      const x = (index / (topData.length - 1)) * 100;
      const y = chartHeight - (value / maxValue) * chartHeight;
      return `${x},${y}`;
    });

    // Bottom line (right to left)
    const bottomPoints = bottomData.map((value, index) => {
      const x = (index / (bottomData.length - 1)) * 100;
      const y = chartHeight - (value / maxValue) * chartHeight;
      return `${x},${y}`;
    }).reverse();

    return `M${topPoints.join(' L')} L${bottomPoints.join(' L')} Z`;
  };

  // Generate area path from zero
  const generateAreaPath = (data: number[]) => {
    if (data.length === 0) return '';
    const points = data.map((value, index) => {
      const x = (index / (data.length - 1)) * 100;
      const y = chartHeight - (value / maxValue) * chartHeight;
      return `${x},${y}`;
    });
    return `M0,${chartHeight} L${points.join(' L')} L100,${chartHeight} Z`;
  };

  const grossData = sortedYears.map((y) => y.total_gross_income);
  const netData = sortedYears.map((y) => y.net_income);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Multi-Year Comparison</CardTitle>
        <CardDescription>
          Income trends from {sortedYears[0]?.year} to {sortedYears[sortedYears.length - 1]?.year}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Stacked Area Chart */}
          <div className="relative h-[220px] ml-12">
            <svg
              viewBox={`0 0 100 ${chartHeight}`}
              preserveAspectRatio="none"
              className="w-full h-[200px]"
            >
              {/* Grid lines */}
              {[0, 25, 50, 75, 100].map((pct) => (
                <line
                  key={pct}
                  x1="0"
                  y1={chartHeight - (pct / 100) * chartHeight}
                  x2="100"
                  y2={chartHeight - (pct / 100) * chartHeight}
                  stroke="currentColor"
                  strokeOpacity="0.1"
                  strokeWidth="0.2"
                />
              ))}

              {/* Tax Area (Red) - from net income to gross income */}
              <path
                d={generateStackedAreaPath(netData, grossData)}
                fill="rgb(239, 68, 68)"
                fillOpacity="0.4"
              />

              {/* Net Income Area (Green) - from 0 to net income */}
              <path
                d={generateAreaPath(netData)}
                fill="rgb(34, 197, 94)"
                fillOpacity="0.4"
              />

              {/* Gross Income Line (Blue dashed) */}
              <path
                d={generateLinePath(grossData)}
                fill="none"
                stroke="rgb(59, 130, 246)"
                strokeWidth="0.5"
                strokeDasharray="2,1"
              />

              {/* Data points */}
              {sortedYears.map((year, index) => {
                const x = (index / (sortedYears.length - 1)) * 100;
                return (
                  <g key={year.year}>
                    <circle
                      cx={x}
                      cy={chartHeight - (year.total_gross_income / maxValue) * chartHeight}
                      r="1"
                      fill="rgb(59, 130, 246)"
                    />
                  </g>
                );
              })}
            </svg>

            {/* Y-axis labels */}
            <div className="absolute -left-12 top-0 h-[200px] flex flex-col justify-between text-xs text-muted-foreground">
              <span>{formatNumber(maxValue)}</span>
              <span>{formatNumber(maxValue * 0.5)}</span>
              <span>$0</span>
            </div>

            {/* X-axis labels */}
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              {sortedYears.map((year) => (
                <span key={year.year}>{year.year}</span>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="flex justify-center gap-6 pt-2 border-t">
            <div className="flex items-center gap-2">
              <div className="w-4 h-0 border-t-2 border-dashed border-blue-500" />
              <span className="text-sm text-muted-foreground">Gross Income</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm bg-green-500/50" />
              <span className="text-sm text-muted-foreground">Net Income</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm bg-red-500/50" />
              <span className="text-sm text-muted-foreground">Tax</span>
            </div>
          </div>

          {/* Data Table */}
          <div className="grid gap-2 pt-2">
            <div className="grid grid-cols-4 gap-4 text-xs font-medium text-muted-foreground pb-1 border-b">
              <div>Year</div>
              <div>Gross</div>
              <div>Tax</div>
              <div>Net</div>
            </div>
            {[...sortedYears].reverse().map((year) => {
              const isCurrentYear = year.year === new Date().getFullYear();
              return (
                <div
                  key={year.year}
                  className={`grid grid-cols-4 gap-4 text-sm py-1 ${isCurrentYear ? 'font-bold' : ''}`}
                >
                  <div className="font-medium">{year.year}</div>
                  <div className="text-blue-600">{formatFullNumber(year.total_gross_income)}</div>
                  <div className="text-red-600">{formatFullNumber(year.total_tax)}</div>
                  <div className="text-green-600">{formatFullNumber(year.net_income)}</div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
