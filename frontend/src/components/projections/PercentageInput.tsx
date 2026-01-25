import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { IconChartBar } from '@tabler/icons-react';

interface PercentageInputProps {
  value: number; // Decimal value (e.g., 0.02 for 2%)
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  onAnalyze?: () => void;
  disabled?: boolean;
  className?: string;
}

export function PercentageInput({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 0.1,
  onAnalyze,
  disabled = false,
  className = '',
}: PercentageInputProps) {
  // Convert decimal to percentage for display
  const displayValue = Math.round(value * 10000) / 100;

  // Convert percentage back to decimal
  const handleChange = (percentValue: number) => {
    const decimalValue = Math.round(percentValue * 100) / 10000;
    onChange(decimalValue);
  };

  return (
    <div className={`flex gap-2 ${className}`}>
      <div className="relative flex-1">
        <Input
          type="number"
          min={min}
          max={max}
          step={step}
          value={displayValue}
          onChange={(e) => handleChange(parseFloat(e.target.value) || 0)}
          disabled={disabled}
          className="pr-7"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
      </div>
      {onAnalyze && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="px-2"
          onClick={onAnalyze}
          title="Analyze sensitivity"
        >
          <IconChartBar className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
