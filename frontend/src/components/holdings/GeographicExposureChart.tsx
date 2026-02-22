import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';

interface GeographicExposureChartProps {
  countryData: Record<string, number>;
}

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
  '#14b8a6', '#e11d48',
];

function TreemapCell(props: any) {
  const { x, y, width, height, index, name, value } = props;
  const color = COLORS[index % COLORS.length];
  const showLabel = width > 50 && height > 30;

  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={color} rx={4} stroke="#fff" strokeWidth={2} />
      {showLabel && (
        <>
          <text x={x + width / 2} y={y + height / 2 - 6} textAnchor="middle" fill="#fff" fontSize={12} fontWeight={600}>
            {name}
          </text>
          <text x={x + width / 2} y={y + height / 2 + 10} textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize={11}>
            {value.toFixed(1)}%
          </text>
        </>
      )}
    </g>
  );
}

export function GeographicExposureChart({ countryData }: GeographicExposureChartProps) {
  const data = Object.entries(countryData)
    .map(([name, value], index) => ({ name, value: Math.round(value * 100) / 100, color: COLORS[index % COLORS.length] }))
    .sort((a, b) => b.value - a.value);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        No geographic data available. Geographic allocation requires a Pro API key.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <Treemap
            data={data}
            dataKey="value"
            aspectRatio={4 / 3}
            content={<TreemapCell />}
          >
            <Tooltip formatter={(value: number) => `${value.toFixed(2)}%`} />
          </Treemap>
        </ResponsiveContainer>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Country</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Weight</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-[40%]" />
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr key={item.name} className="border-b border-border last:border-0">
                <td className="px-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: item.color }} />
                    {item.name}
                  </div>
                </td>
                <td className="px-3 py-2 text-right text-sm tabular-nums">{item.value.toFixed(1)}%</td>
                <td className="px-3 py-2">
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${item.value}%`, backgroundColor: item.color }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
