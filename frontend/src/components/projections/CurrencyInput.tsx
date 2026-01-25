import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { IconChartBar } from '@tabler/icons-react';

interface CurrencyInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  onAnalyze?: () => void;
  disabled?: boolean;
  className?: string;
}

export function CurrencyInput({
  value,
  onChange,
  min = 0,
  max,
  step = 100,
  onAnalyze,
  disabled = false,
  className = '',
}: CurrencyInputProps) {
  return (
    <div className={`flex gap-2 ${className}`}>
      <div className="relative flex-1">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
        <Input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Math.round(parseFloat(e.target.value) || 0))}
          disabled={disabled}
          className="pl-7"
        />
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
