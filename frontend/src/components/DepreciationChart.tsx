import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { DepreciationScheduleEntry } from '@/lib/api-client';

interface DepreciationChartProps {
  schedule: DepreciationScheduleEntry[];
  purchasePrice: number;
  purchaseDate: string;
}

export function DepreciationChart({ schedule, purchasePrice, purchaseDate }: DepreciationChartProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'CAD',
    }).format(amount);
  };

  // Add the purchase date as the first data point
  const chartData = [
    {
      year: 0,
      date: new Date(purchaseDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
      }),
      bookValue: purchasePrice,
      accumulatedDepreciation: 0,
      dateObj: new Date(purchaseDate),
    },
    ...schedule.map((entry) => ({
      year: entry.year,
      date: new Date(entry.date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
      }),
      bookValue: entry.book_value,
      accumulatedDepreciation: entry.accumulated_depreciation,
      dateObj: new Date(entry.date),
    })),
  ];

  // Find today's date for reference line
  const today = new Date();
  const todayYear = chartData.find(d => d.dateObj >= today)?.year || null;
  const todayData = chartData.find(d => d.year === todayYear);

  return (
    <div className="h-[400px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis
            tickFormatter={(value) => formatCurrency(value)}
          />
          <Tooltip
            formatter={(value: number) => formatCurrency(value)}
            labelStyle={{ color: '#000' }}
          />
          <Legend />
          {todayData && (
            <ReferenceLine
              x={todayData.date}
              stroke="#8b5cf6"
              strokeWidth={2}
              strokeDasharray="5 5"
              label={{ value: 'Today', position: 'top', fill: '#8b5cf6' }}
            />
          )}
          <Line
            type="monotone"
            dataKey="bookValue"
            stroke="#10b981"
            name="Book Value"
            strokeWidth={2}
          />
          <Line
            type="monotone"
            dataKey="accumulatedDepreciation"
            stroke="#ef4444"
            name="Accumulated Depreciation"
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
