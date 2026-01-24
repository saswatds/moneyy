import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, type CreateHoldingRequest, type UpdateHoldingRequest } from '@/lib/api-client';

export function useAccountHoldings(accountId: string) {
  return useQuery({
    queryKey: ['holdings', 'account', accountId],
    queryFn: () => apiClient.getAccountHoldings(accountId),
    enabled: !!accountId,
  });
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
