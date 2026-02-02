import type { YearSummary } from '@/lib/api-client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Currency } from '@/components/ui/currency';

interface YearComparisonChartProps {
  years: YearSummary[];
}

export function YearComparisonChart({ years }: YearComparisonChartProps) {
  const currentYear = new Date().getFullYear();
  const startYear = currentYear - 19;

  const allYears = Array.from({ length: 20 }, (_, i) => {
    const year = startYear + i;
    const data = years.find((y) => y.year === year);
    return {
      year,
      total_gross_income: data?.total_gross_income || 0,
      net_income: data?.net_income || 0,
      total_tax: data?.total_tax || 0,
      hasData: !!data,
    };
  });

  const maxGross = Math.max(...allYears.map((y) => y.total_gross_income), 1);

  const yearsWithData = allYears.filter((y) => y.hasData);
  const latestWithData = yearsWithData[yearsWithData.length - 1];
  const previousWithData = yearsWithData.length >= 2 ? yearsWithData[yearsWithData.length - 2] : null;
  const yoyGrowth = previousWithData && latestWithData
    ? ((latestWithData.net_income - previousWithData.net_income) / previousWithData.net_income) * 100
    : null;

  const barHeight = 140;
  const svgWidth = 400;
  const svgHeight = barHeight;

  // Generate line points for gross income
  const linePoints = allYears
    .map((year, i) => {
      if (!year.hasData) return null;
      const x = (i + 0.5) * (svgWidth / 20);
      const y = svgHeight - (year.total_gross_income / maxGross) * svgHeight;
      return { x, y, year };
    })
    .filter(Boolean) as { x: number; y: number; year: typeof allYears[0] }[];

  const linePath = linePoints.length > 1
    ? `M ${linePoints.map(p => `${p.x},${p.y}`).join(' L ')}`
    : '';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Income Over Time</CardTitle>
        <CardDescription>
          20 year view ({startYear} - {currentYear})
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex">
            {/* Y-axis labels */}
            <div className="w-12 flex flex-col justify-between text-xs text-muted-foreground pr-2" style={{ height: barHeight }}>
              <Currency amount={maxGross} compact />
              <Currency amount={maxGross / 2} compact />
              <Currency amount={0} compact />
            </div>

            {/* Chart area */}
            <div className="flex-1 relative" style={{ height: barHeight }}>
              {/* Bars */}
              <div className="absolute inset-0 flex items-end gap-px">
                {allYears.map((year) => {
                  const netPct = year.hasData ? (year.net_income / maxGross) * 100 : 0;
                  const taxPct = year.hasData ? ((year.total_gross_income - year.net_income) / maxGross) * 100 : 0;
                  const isCurrentYear = year.year === currentYear;

                  return (
                    <div
                      key={year.year}
                      className="flex-1 flex flex-col justify-end group relative"
                      style={{ height: '100%' }}
                    >
                      {year.hasData ? (
                        <>
                          <div
                            className={`w-full bg-red-500/80 dark:bg-red-400/80 ${isCurrentYear ? '' : 'opacity-60'} group-hover:opacity-100 transition-opacity`}
                            style={{ height: `${taxPct}%` }}
                          />
                          <div
                            className={`w-full bg-green-500/80 dark:bg-green-400/80 ${isCurrentYear ? '' : 'opacity-60'} group-hover:opacity-100 transition-opacity`}
                            style={{ height: `${netPct}%` }}
                          />
                        </>
                      ) : (
                        <div className="w-full bg-muted/20 rounded-sm" style={{ height: 2 }} />
                      )}

                      {/* Tooltip */}
                      {year.hasData && (
                        <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-popover border rounded px-2 py-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20 shadow-md">
                          <div className="font-semibold">{year.year}</div>
                          <div className="text-blue-600 dark:text-blue-400"><Currency amount={year.total_gross_income} compact /> gross</div>
                          <div className="text-green-600 dark:text-green-400"><Currency amount={year.net_income} compact /> net</div>
                          <div className="text-red-600 dark:text-red-400"><Currency amount={year.total_tax} compact /> tax</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Gross line overlay */}
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                preserveAspectRatio="none"
              >
                {linePath && (
                  <path
                    d={linePath}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
                {linePoints.map((p, i) => (
                  <circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r="1"
                    fill="#3b82f6"
                  />
                ))}
              </svg>
            </div>
          </div>

          {/* X-axis labels */}
          <div className="flex">
            <div className="w-12" />
            <div className="flex-1 flex">
              {allYears.map((year) => {
                const showLabel = year.year % 5 === 0 || year.year === currentYear;
                return (
                  <div key={year.year} className="flex-1 text-center">
                    {showLabel && (
                      <span className={`text-xs ${year.year === currentYear ? 'font-semibold' : 'text-muted-foreground'}`}>
                        '{year.year.toString().slice(-2)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-0.5 bg-blue-500 rounded" />
                <span className="text-xs text-muted-foreground">Gross</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-green-500/80" />
                <span className="text-xs text-muted-foreground">Net</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-red-500/80" />
                <span className="text-xs text-muted-foreground">Tax</span>
              </div>
            </div>
            {yoyGrowth !== null && (
              <div className={`text-sm font-medium ${yoyGrowth >= 0 ? 'text-positive' : 'text-negative'}`}>
                {yoyGrowth >= 0 ? '+' : ''}{yoyGrowth.toFixed(1)}% YoY
              </div>
            )}
          </div>

          {/* Summary */}
          {latestWithData && (
            <div className="grid grid-cols-3 gap-3 pt-2 border-t text-center">
              <div>
                <Currency amount={latestWithData.total_gross_income} compact className="text-lg font-semibold" />
                <div className="text-xs text-muted-foreground">Gross ({latestWithData.year})</div>
              </div>
              <div>
                <Currency amount={latestWithData.net_income} compact className="text-lg font-semibold text-positive" />
                <div className="text-xs text-muted-foreground">Net Income</div>
              </div>
              <div>
                <Currency amount={latestWithData.total_tax} compact className="text-lg font-semibold text-negative" />
                <div className="text-xs text-muted-foreground">Total Tax</div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
