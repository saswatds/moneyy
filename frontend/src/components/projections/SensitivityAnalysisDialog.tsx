import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { apiClient } from '@/lib/api-client';
import type { ProjectionConfig } from '@/lib/api-client';

interface SensitivityAnalysisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parameterName: string;
  parameterLabel: string;
  currentValue: number;
  baseConfig: ProjectionConfig;
  onUpdateValue?: (path: string, value: number) => ProjectionConfig;
}

interface AnalysisPoint {
  parameterValue: number;
  finalNetWorth: number;
  debtPaidOffMonth: number | null;
}

export function SensitivityAnalysisDialog({
  open,
  onOpenChange,
  parameterName,
  parameterLabel,
  currentValue,
  baseConfig,
  onUpdateValue,
}: SensitivityAnalysisDialogProps) {
  // Calculate sensible defaults based on the current value
  const getDefaults = () => {
    // For percentage values (0-1 range)
    if (currentValue > 0 && currentValue <= 1) {
      return {
        min: Math.max(0, currentValue * 0.5),
        max: Math.min(1, currentValue * 1.5),
        step: currentValue * 0.1,
      };
    }
    // For currency or large values
    return {
      min: currentValue * 0.5,
      max: currentValue * 1.5,
      step: Math.max(1, Math.round(currentValue * 0.1)),
    };
  };

  const defaults = getDefaults();
  const [minValue, setMinValue] = useState(defaults.min);
  const [maxValue, setMaxValue] = useState(defaults.max);
  const [step, setStep] = useState(defaults.step);
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState<AnalysisPoint[]>([]);

  // Reset values when parameter changes
  useEffect(() => {
    if (open) {
      const newDefaults = getDefaults();
      setMinValue(newDefaults.min);
      setMaxValue(newDefaults.max);
      setStep(newDefaults.step);
      setResults([]);
    }
  }, [open, currentValue, parameterName]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatParameterValue = (value: number) => {
    // If the parameter is a percentage (value between 0 and 1), display as percentage
    if (currentValue > 0 && currentValue <= 1) {
      return `${(value * 100).toFixed(1)}%`;
    }
    // If it's a currency value
    if (currentValue > 100) {
      return formatCurrency(value);
    }
    // Otherwise just show the number
    return value.toFixed(2);
  };

  const runAnalysis = async () => {
    setAnalyzing(true);
    setResults([]);

    try {
      const points: AnalysisPoint[] = [];

      // Generate parameter values to test
      const values: number[] = [];
      for (let val = minValue; val <= maxValue; val += step) {
        values.push(val);
      }
      // Ensure max value is included
      if (values[values.length - 1] < maxValue) {
        values.push(maxValue);
      }

      // Run projection for each parameter value
      for (const value of values) {
        // Create modified config
        let modifiedConfig = { ...baseConfig };

        if (onUpdateValue) {
          // Use custom update function (for nested properties)
          modifiedConfig = onUpdateValue(parameterName, value);
        } else {
          // Direct property update
          (modifiedConfig as Record<string, number>)[parameterName] = value;
        }

        // Run projection
        const result = await apiClient.calculateProjection({ config: modifiedConfig });

        // Extract final net worth
        const finalNetWorth = result.net_worth[result.net_worth.length - 1]?.value || 0;

        // Find when debt is paid off
        const debtPaidOffIdx = result.debt_payoff.findIndex(point => point.total_debt === 0);
        const debtPaidOffMonth = debtPaidOffIdx >= 0 ? debtPaidOffIdx : null;

        points.push({
          parameterValue: value,
          finalNetWorth,
          debtPaidOffMonth,
        });
      }

      setResults(points);
    } catch (error) {
      console.error('Sensitivity analysis failed:', error);
    } finally {
      setAnalyzing(false);
    }
  };

  const chartData = results.map(point => ({
    parameter: point.parameterValue,
    netWorth: point.finalNetWorth,
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-6xl max-h-[90vh] overflow-y-auto w-[95vw]">
        <DialogHeader>
          <DialogTitle>Sensitivity Analysis: {parameterLabel}</DialogTitle>
          <DialogDescription>
            See how changes in {parameterLabel} affect your final net worth
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Input Controls */}
          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="current">Current Value</Label>
              <Input
                id="current"
                type="number"
                value={currentValue}
                disabled
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="min">Min Value</Label>
              <Input
                id="min"
                type="number"
                step={step}
                value={minValue}
                onChange={(e) => setMinValue(parseFloat(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max">Max Value</Label>
              <Input
                id="max"
                type="number"
                step={step}
                value={maxValue}
                onChange={(e) => setMaxValue(parseFloat(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="step">Step</Label>
              <Input
                id="step"
                type="number"
                step={step / 10}
                value={step}
                onChange={(e) => setStep(parseFloat(e.target.value))}
              />
            </div>
          </div>

          <Button onClick={runAnalysis} disabled={analyzing} className="w-full">
            {analyzing ? 'Running Analysis...' : 'Run Analysis'}
          </Button>

          {/* Results Chart */}
          {results.length > 0 && (
            <div className="space-y-4">
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="parameter"
                      tickFormatter={formatParameterValue}
                      label={{ value: parameterLabel, position: 'insideBottom', offset: -5 }}
                    />
                    <YAxis
                      domain={['dataMin', 'dataMax']}
                      tickFormatter={(value) => formatCurrency(value)}
                      label={{ value: 'Final Net Worth', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      labelFormatter={(value: number) => `${parameterLabel}: ${formatParameterValue(value)}`}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="netWorth"
                      stroke="#8b5cf6"
                      strokeWidth={3}
                      name="Final Net Worth"
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Results Table */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-2 text-left">{parameterLabel}</th>
                      <th className="p-2 text-right">Final Net Worth</th>
                      <th className="p-2 text-right">Change from Current</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((point, idx) => {
                      const currentResult = results.find(r => r.parameterValue === currentValue);
                      const change = currentResult ? point.finalNetWorth - currentResult.finalNetWorth : 0;
                      const isCurrentValue = Math.abs(point.parameterValue - currentValue) < step / 10;

                      return (
                        <tr key={idx} className={`border-t ${isCurrentValue ? 'bg-blue-50 font-medium' : ''}`}>
                          <td className="p-2">{formatParameterValue(point.parameterValue)}</td>
                          <td className="p-2 text-right">{formatCurrency(point.finalNetWorth)}</td>
                          <td className={`p-2 text-right ${change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : ''}`}>
                            {change > 0 ? '+' : ''}{formatCurrency(change)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
