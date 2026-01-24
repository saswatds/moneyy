import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, type CreateBalanceRequest } from '@/lib/api-client';

export function useAccountBalances(accountId: string) {
  return useQuery({
    queryKey: ['balances', 'account', accountId],
    queryFn: () => apiClient.getAccountBalances(accountId),
    enabled: !!accountId,
  });
}

export function useCreateBalance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateBalanceRequest) => apiClient.createBalance(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['balances', 'account', variables.account_id] });
    },
  });
}

export function useUpdateBalance(id: string, accountId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<CreateBalanceRequest>) => apiClient.updateBalance(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['balances', 'account', accountId] });
    },
  });
}

export function useDeleteBalance(accountId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.deleteBalance(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['balances', 'account', accountId] });
    },
  });
}
