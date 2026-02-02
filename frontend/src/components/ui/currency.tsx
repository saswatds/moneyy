import { cn } from '@/lib/utils';

interface CurrencyProps {
  amount: number;
  className?: string;
  /** Show as negative with minus sign */
  negative?: boolean;
  /** Use compact notation (e.g., 50K, 1.5M) */
  compact?: boolean;
  /** Show cents in smaller text */
  smallCents?: boolean;
  /** Show currency symbol (default: false) */
  showSymbol?: boolean;
  /** Show positive/negative colors */
  colored?: boolean;
  /** Number of decimal places (default: 2, compact: 1) */
  decimals?: number;
}

const formatAmount = (amount: number, compact: boolean, decimals?: number) => {
  if (compact) {
    const absAmount = Math.abs(amount);
    if (absAmount >= 1000000) {
      return (absAmount / 1000000).toFixed(decimals ?? 1) + 'M';
    }
    if (absAmount >= 1000) {
      return (absAmount / 1000).toFixed(decimals ?? 0) + 'K';
    }
    return absAmount.toFixed(decimals ?? 0);
  }

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals ?? 2,
    maximumFractionDigits: decimals ?? 2,
  }).format(Math.abs(amount));
};

export function Currency({
  amount,
  className,
  negative = false,
  compact = false,
  smallCents = false,
  showSymbol = false,
  colored = false,
  decimals,
}: CurrencyProps) {
  const isNegative = negative || amount < 0;
  const formatted = formatAmount(amount, compact, decimals);

  const colorClass = colored
    ? isNegative
      ? 'text-negative'
      : 'text-positive'
    : '';

  if (smallCents && !compact) {
    const [dollars, cents] = formatted.split('.');
    return (
      <span className={cn(colorClass, className)}>
        {isNegative && '-'}
        {showSymbol && '$'}
        {dollars}
        {cents && <span className="text-[0.65em] opacity-70">.{cents}</span>}
      </span>
    );
  }

  return (
    <span className={cn(colorClass, className)}>
      {isNegative && '-'}
      {showSymbol && '$'}
      {formatted}
    </span>
  );
}

// Utility functions for non-component usage
export const formatCurrencyValue = (amount: number, decimals = 2): string => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
};

export const formatCurrencyCompactValue = (amount: number): string => {
  const absAmount = Math.abs(amount);
  if (absAmount >= 1000000) {
    return (absAmount / 1000000).toFixed(1) + 'M';
  }
  if (absAmount >= 1000) {
    return (absAmount / 1000).toFixed(0) + 'K';
  }
  return absAmount.toFixed(0);
};
