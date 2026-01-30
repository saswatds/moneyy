import type { ExchangeRates } from './api-client';

// Convert amount from one currency to another using exchange rates
export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: ExchangeRates | undefined
): number {
  if (fromCurrency === toCurrency) {
    return amount;
  }

  if (!rates?.rates) {
    // Fallback rates if API not available
    const fallbackRates: Record<string, Record<string, number>> = {
      USD: { CAD: 1.44, INR: 83.0 },
      CAD: { USD: 0.69, INR: 57.6 },
      INR: { CAD: 0.017, USD: 0.012 },
    };
    const rate = fallbackRates[fromCurrency]?.[toCurrency] || 1;
    return amount * rate;
  }

  const rate = rates.rates[fromCurrency]?.[toCurrency];
  if (rate) {
    return amount * rate;
  }

  // Try inverse
  const inverseRate = rates.rates[toCurrency]?.[fromCurrency];
  if (inverseRate) {
    return amount / inverseRate;
  }

  return amount;
}

export function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

export function formatCurrencyCompact(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amount);
}

// Format with CAD equivalent shown below
export function formatWithCADEquivalent(
  amount: number,
  currency: string,
  rates: ExchangeRates | undefined
): { original: string; cadEquivalent: string | null; cadAmount: number } {
  const original = formatCurrency(amount, currency);

  if (currency === 'CAD') {
    return { original, cadEquivalent: null, cadAmount: amount };
  }

  const cadAmount = convertCurrency(amount, currency, 'CAD', rates);
  const cadEquivalent = formatCurrency(cadAmount, 'CAD');

  return { original, cadEquivalent, cadAmount };
}

// Aggregate amounts in different currencies to CAD
export function aggregateToCAD(
  amounts: { amount: number; currency: string }[],
  rates: ExchangeRates | undefined
): number {
  return amounts.reduce((total, { amount, currency }) => {
    return total + convertCurrency(amount, currency, 'CAD', rates);
  }, 0);
}
