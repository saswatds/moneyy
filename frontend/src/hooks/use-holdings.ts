import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, type CreateHoldingRequest, type UpdateHoldingRequest, type Holding } from '@/lib/api-client';

export function useAccountHoldings(accountId: string) {
  return useQuery({
    queryKey: ['holdings', 'account', accountId],
    queryFn: () => apiClient.getAccountHoldings(accountId),
    enabled: !!accountId,
  });
}

export function useAllHoldings(accountIds: string[]) {
  const queries = useQueries({
    queries: accountIds.map((accountId) => ({
      queryKey: ['holdings', 'account', accountId],
      queryFn: () => apiClient.getAccountHoldings(accountId),
      enabled: !!accountId,
    })),
  });

  // Aggregate all holdings
  const allHoldings: Holding[] = [];
  let isLoading = false;
  let isError = false;

  queries.forEach((query) => {
    if (query.isLoading) isLoading = true;
    if (query.isError) isError = true;
    if (query.data?.holdings) {
      allHoldings.push(...query.data.holdings);
    }
  });

  return {
    holdings: allHoldings,
    isLoading,
    isError,
  };
}

export function useHolding(id: string) {
  return useQuery({
    queryKey: ['holdings', id],
    queryFn: () => apiClient.getHolding(id),
    enabled: !!id,
  });
}

export function useCreateHolding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateHoldingRequest) => apiClient.createHolding(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['holdings', 'account', variables.account_id] });
    },
  });
}

export function useUpdateHolding(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateHoldingRequest) => apiClient.updateHolding(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['holdings', 'account', data.account_id] });
      queryClient.invalidateQueries({ queryKey: ['holdings', id] });
    },
  });
}

export function useDeleteHolding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.deleteHolding(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holdings'] });
    },
  });
}
