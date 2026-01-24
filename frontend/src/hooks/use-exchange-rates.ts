import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export function useExchangeRates() {
  return useQuery({
    queryKey: ['exchangeRates'],
    queryFn: () => apiClient.getExchangeRates(),
    staleTime: 1000 * 60 * 60, // Consider rates fresh for 1 hour
  });
}
