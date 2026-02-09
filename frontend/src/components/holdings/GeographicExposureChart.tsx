import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface GeographicExposureChartProps {
  countryData: Record<string, number>;
}

export function GeographicExposureChart({ countryData }: GeographicExposureChartProps) {
  const data = Object.entries(countryData)
    .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
    .sort((a, b) => b.value - a.value);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        No geographic data available. Geographic allocation requires a Pro API key.
      </div>
    );
  }

  return (
    <div className="h-[350px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 80 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" tickFormatter={(value) => `${value}%`} />
          <YAxis type="category" dataKey="name" width={70} />
          <Tooltip formatter={(value: number) => `${value.toFixed(2)}%`} />
          <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
