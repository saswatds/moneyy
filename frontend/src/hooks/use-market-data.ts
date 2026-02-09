import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export function useSecurityQuote(symbol: string) {
  return useQuery({
    queryKey: ['market', 'quote', symbol],
    queryFn: () => apiClient.getSecurityQuote(symbol),
    enabled: !!symbol,
    staleTime: 15 * 60 * 1000, // 15 minutes
  });
}

export function useBatchQuotes(symbols: string[]) {
  return useQuery({
    queryKey: ['market', 'quotes', ...symbols.sort()],
    queryFn: () => apiClient.getBatchQuotes(symbols),
    enabled: symbols.length > 0,
    staleTime: 15 * 60 * 1000,
  });
}

export function useSecurityProfile(symbol: string) {
  return useQuery({
    queryKey: ['market', 'profile', symbol],
    queryFn: () => apiClient.getSecurityProfile(symbol),
    enabled: !!symbol,
    staleTime: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

export function useETFHoldings(symbol: string) {
  return useQuery({
    queryKey: ['market', 'etf', 'holdings', symbol],
    queryFn: () => apiClient.getETFHoldings(symbol),
    enabled: !!symbol,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
  });
}

export function useETFSector(symbol: string) {
  return useQuery({
    queryKey: ['market', 'etf', 'sector', symbol],
    queryFn: () => apiClient.getETFSector(symbol),
    enabled: !!symbol,
    staleTime: 24 * 60 * 60 * 1000,
  });
}

export function useETFCountry(symbol: string) {
  return useQuery({
    queryKey: ['market', 'etf', 'country', symbol],
    queryFn: () => apiClient.getETFCountry(symbol),
    enabled: !!symbol,
    staleTime: 24 * 60 * 60 * 1000,
  });
}

export function useETFProfile(symbol: string) {
  return useQuery({
    queryKey: ['market', 'etf', 'profile', symbol],
    queryFn: () => apiClient.getETFProfile(symbol),
    enabled: !!symbol,
    staleTime: 24 * 60 * 60 * 1000,
  });
}
