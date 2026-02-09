import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface AssetAllocationChartProps {
  typeBreakdown: Record<string, number>;
}

const TYPE_COLORS: Record<string, string> = {
  stock: '#3b82f6',
  etf: '#10b981',
  mutual_fund: '#f59e0b',
  bond: '#8b5cf6',
  cash: '#6b7280',
  crypto: '#f97316',
  option: '#ec4899',
  other: '#94a3b8',
};

const TYPE_LABELS: Record<string, string> = {
  stock: 'Stocks',
  etf: 'ETFs',
  mutual_fund: 'Mutual Funds',
  bond: 'Bonds',
  cash: 'Cash',
  crypto: 'Crypto',
  option: 'Options',
  other: 'Other',
};

export function AssetAllocationChart({ typeBreakdown }: AssetAllocationChartProps) {
  const data = Object.entries(typeBreakdown)
    .map(([type, value]) => ({
      name: TYPE_LABELS[type] || type,
      value: Math.round(value * 100) / 100,
      type,
    }))
    .sort((a, b) => b.value - a.value);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        No allocation data available
      </div>
    );
  }

  return (
    <div className="h-[350px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={120}
            paddingAngle={2}
            dataKey="value"
            label={({ name, value }) => `${name} ${value.toFixed(1)}%`}
          >
            {data.map((entry) => (
              <Cell key={entry.type} fill={TYPE_COLORS[entry.type] || '#94a3b8'} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => `${value.toFixed(2)}%`}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
