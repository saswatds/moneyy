import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  apiClient,
  type SaveAPIKeyRequest,
} from '@/lib/api-client';

// API Key Status

export function useAPIKeyStatus(provider: string, enabled = true) {
  return useQuery({
    queryKey: ['api-keys', 'status', provider],
    queryFn: () => apiClient.getAPIKeyStatus(provider),
    enabled: !!provider && enabled,
  });
}

// Save API Key

export function useSaveAPIKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SaveAPIKeyRequest) => apiClient.saveAPIKey(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['api-keys', 'status', data.provider] });
    },
  });
}

// Delete API Key

export function useDeleteAPIKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (provider: string) => apiClient.deleteAPIKey(provider),
    onSuccess: (_data, provider) => {
      queryClient.invalidateQueries({ queryKey: ['api-keys', 'status', provider] });
    },
  });
}

// Fetch Tax Brackets from Moneyy API

export function useFetchTaxBrackets() {
  return useMutation({
    mutationFn: ({ country, year, region }: { country: string; year: number; region: string }) =>
      apiClient.fetchTaxBracketsFromAPI(country, year, region),
  });
}
