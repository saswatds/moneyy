import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  apiClient,
  type CreateAssetDetailsRequest,
  type UpdateAssetDetailsRequest,
  type CreateDepreciationEntryRequest
} from '@/lib/api-client';

export function useAssetDetails(accountId: string, enabled = true) {
  return useQuery({
    queryKey: ['assets', 'details', accountId],
    queryFn: () => apiClient.getAssetDetails(accountId),
    enabled: !!accountId && enabled,
    retry: false, // Don't retry on 404 errors
  });
}

export function useAssetValuation(accountId: string) {
  return useQuery({
    queryKey: ['assets', 'valuation', accountId],
    queryFn: () => apiClient.getAssetValuation(accountId),
    enabled: !!accountId,
    retry: false, // Don't retry on 404 errors
  });
}

export function useAssetsSummary() {
  return useQuery({
    queryKey: ['assets', 'summary'],
    queryFn: () => apiClient.getAssetsSummary(),
  });
}

export function useDepreciationHistory(accountId: string, enabled = true) {
  return useQuery({
    queryKey: ['assets', 'depreciation', accountId],
    queryFn: () => apiClient.getDepreciationHistory(accountId),
    enabled: !!accountId && enabled,
    retry: false, // Don't retry on errors
  });
}

export function useDepreciationSchedule(accountId: string, enabled = true) {
  return useQuery({
    queryKey: ['assets', 'depreciation-schedule', accountId],
    queryFn: () => apiClient.getDepreciationSchedule(accountId),
    enabled: !!accountId && enabled,
    retry: false, // Don't retry on errors
  });
}

export function useCreateAssetDetails() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ accountId, data }: { accountId: string; data: CreateAssetDetailsRequest }) =>
      apiClient.createAssetDetails(accountId, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['assets', 'details', data.account_id] });
      queryClient.invalidateQueries({ queryKey: ['assets', 'valuation', data.account_id] });
      queryClient.invalidateQueries({ queryKey: ['assets', 'summary'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

export function useUpdateAssetDetails(accountId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateAssetDetailsRequest) =>
      apiClient.updateAssetDetails(accountId, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['assets', 'details', data.account_id] });
      queryClient.invalidateQueries({ queryKey: ['assets', 'valuation', data.account_id] });
      queryClient.invalidateQueries({ queryKey: ['assets', 'summary'] });
    },
  });
}

export function useRecordDepreciation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ accountId, data }: { accountId: string; data: CreateDepreciationEntryRequest }) =>
      apiClient.recordDepreciation(accountId, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['assets', 'depreciation', data.account_id] });
      queryClient.invalidateQueries({ queryKey: ['assets', 'valuation', data.account_id] });
      queryClient.invalidateQueries({ queryKey: ['assets', 'summary'] });
    },
  });
}

export function useSyncAssetBalance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (accountId: string) => apiClient.syncAssetBalance(accountId),
    onSuccess: (_, accountId) => {
      queryClient.invalidateQueries({ queryKey: ['balances', accountId] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}
