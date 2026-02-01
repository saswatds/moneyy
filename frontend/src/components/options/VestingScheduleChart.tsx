import React, { useMemo } from 'react';
import {
  Line,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import type { VestingEvent, EquityGrantWithSummary } from '@/lib/api-client';

interface VestingScheduleChartProps {
  events: VestingEvent[];
  grants: EquityGrantWithSummary[];
}

// Chart config type (matches ChartContainer's expected config)
type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode;
    icon?: React.ComponentType;
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<'light' | 'dark', string> }
  );
};

// Color palette for different grants
const COLORS = [
  'hsl(221, 83%, 53%)', // blue
  'hsl(142, 71%, 45%)', // green
  'hsl(262, 83%, 58%)', // purple
  'hsl(24, 95%, 53%)',  // orange
  'hsl(343, 80%, 52%)', // pink
  'hsl(187, 85%, 43%)', // cyan
  'hsl(45, 93%, 47%)',  // yellow
];

interface SingleGrantChartProps {
  grant: EquityGrantWithSummary | undefined;
  events: VestingEvent[];
  color: string;
  index: number;
}

function SingleGrantChart({ grant, events, color, index }: SingleGrantChartProps) {
  const title = grant?.grant_number || grant?.company_name || `Grant ${index + 1}`;
  const today = new Date().toISOString().slice(0, 7);

  const chartConfig: ChartConfig = {
    shares: {
      label: 'Shares',
      color: color,
    },
  };

  // Process events into chart data
  const chartData = useMemo(() => {
    if (events.length === 0) return [];

    const sortedEvents = [...events].sort((a, b) =>
      new Date(a.vest_date).getTime() - new Date(b.vest_date).getTime()
    );

    let cumulative = 0;
    const dataMap = new Map<string, number>();

    sortedEvents.forEach(event => {
      if (event.status === 'forfeited') return;

      const date = new Date(event.vest_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      cumulative += event.quantity;
      dataMap.set(monthKey, cumulative);
    });

    // Ensure today is included in the data range for the reference line
    const todayKey = today;
    if (!dataMap.has(todayKey)) {
      // Find the cumulative value at today (last value before or at today)
      const sortedKeys = Array.from(dataMap.keys()).sort();
      let valueAtToday = 0;
      for (const key of sortedKeys) {
        if (key <= todayKey) {
          valueAtToday = dataMap.get(key) || 0;
        }
      }
      // Only add today if it's within the range of our data
      const firstDate = sortedKeys[0];
      const lastDate = sortedKeys[sortedKeys.length - 1];
      if (todayKey >= firstDate && todayKey <= lastDate) {
        dataMap.set(todayKey, valueAtToday);
      }
    }

    // Convert to array and sort
    const data = Array.from(dataMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, shares]) => ({ date, shares }));

    return data;
  }, [events, today]);

  const vestedCount = events.filter(e => e.status === 'vested').reduce((sum, e) => sum + e.quantity, 0);
  const pendingCount = events.filter(e => e.status === 'pending').reduce((sum, e) => sum + e.quantity, 0);
  const isComplete = pendingCount === 0 && vestedCount > 0;

  if (events.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{title}</CardTitle>
          {isComplete && (
            <Badge variant="outline" className="text-green-600 border-green-600/30">
              Done
            </Badge>
          )}
        </div>
        <CardDescription>
          {vestedCount.toLocaleString()} vested · {pendingCount.toLocaleString()} pending
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[200px] w-full">
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => {
                const [year, month] = value.split('-');
                return `${month}/${year.slice(2)}`;
              }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => value.toLocaleString()}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => {
                    const [year, month] = value.split('-');
                    const date = new Date(parseInt(year), parseInt(month) - 1);
                    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                  }}
                />
              }
            />
            <ReferenceLine
              x={today}
              stroke="hsl(0, 72%, 51%)"
              strokeWidth={2}
              label={{ value: 'Today', position: 'top', fontSize: 10, fill: 'hsl(0, 72%, 51%)' }}
            />
            <Line
              type="stepAfter"
              dataKey="shares"
              stroke={color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

export function VestingScheduleChart({ events, grants }: VestingScheduleChartProps) {
  // Create a map of grant_id to grant info
  const grantMap = useMemo(() => {
    const map = new Map<string, EquityGrantWithSummary>();
    grants.forEach(grant => map.set(grant.id, grant));
    return map;
  }, [grants]);

  // Group events by grant
  const eventsByGrant = useMemo(() => {
    const grouped = new Map<string, VestingEvent[]>();
    events.forEach(event => {
      const existing = grouped.get(event.grant_id) || [];
      existing.push(event);
      grouped.set(event.grant_id, existing);
    });
    return grouped;
  }, [events]);

  const grantIds = Array.from(eventsByGrant.keys());

  if (events.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Vesting Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No vesting events scheduled. Add a vesting schedule to your grants to see the charts.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {grantIds.map((grantId, index) => (
        <SingleGrantChart
          key={grantId}
          grant={grantMap.get(grantId)}
          events={eventsByGrant.get(grantId) || []}
          color={COLORS[index % COLORS.length]}
          index={index}
        />
      ))}
    </div>
  );
}
