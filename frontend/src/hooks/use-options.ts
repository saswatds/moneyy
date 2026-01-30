import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  apiClient,
  type CreateEquityGrantRequest,
  type UpdateEquityGrantRequest,
  type SetVestingScheduleRequest,
  type RecordExerciseRequest,
  type UpdateExerciseRequest,
  type RecordSaleRequest,
  type UpdateSaleRequest,
  type RecordFMVRequest,
  type UpdateVestingEventRequest,
} from '@/lib/api-client';

// Grants

export function useEquityGrants(accountId: string, enabled = true) {
  return useQuery({
    queryKey: ['options', 'grants', accountId],
    queryFn: () => apiClient.getEquityGrants(accountId),
    enabled: !!accountId && enabled,
  });
}

export function useEquityGrant(accountId: string, grantId: string, enabled = true) {
  return useQuery({
    queryKey: ['options', 'grants', accountId, grantId],
    queryFn: () => apiClient.getEquityGrant(accountId, grantId),
    enabled: !!accountId && !!grantId && enabled,
  });
}

export function useCreateEquityGrant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ accountId, data }: { accountId: string; data: CreateEquityGrantRequest }) =>
      apiClient.createEquityGrant(accountId, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['options', 'grants', data.account_id] });
      queryClient.invalidateQueries({ queryKey: ['options', 'summary', data.account_id] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

export function useUpdateEquityGrant(accountId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ grantId, data }: { grantId: string; data: UpdateEquityGrantRequest }) =>
      apiClient.updateEquityGrant(accountId, grantId, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['options', 'grants', data.account_id] });
      queryClient.invalidateQueries({ queryKey: ['options', 'grants', data.account_id, data.id] });
      queryClient.invalidateQueries({ queryKey: ['options', 'summary', data.account_id] });
    },
  });
}

export function useDeleteEquityGrant(accountId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (grantId: string) => apiClient.deleteEquityGrant(accountId, grantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['options', 'grants', accountId] });
      queryClient.invalidateQueries({ queryKey: ['options', 'summary', accountId] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

// Vesting Schedule

export function useVestingSchedule(accountId: string, grantId: string, enabled = true) {
  return useQuery({
    queryKey: ['options', 'vesting-schedule', accountId, grantId],
    queryFn: () => apiClient.getVestingSchedule(accountId, grantId),
    enabled: !!accountId && !!grantId && enabled,
    retry: false,
  });
}

export function useSetVestingSchedule(accountId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ grantId, data }: { grantId: string; data: SetVestingScheduleRequest }) =>
      apiClient.setVestingSchedule(accountId, grantId, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['options', 'vesting-schedule', accountId, data.grant_id] });
      queryClient.invalidateQueries({ queryKey: ['options', 'vesting-events', accountId, data.grant_id] });
      queryClient.invalidateQueries({ queryKey: ['options', 'summary', accountId] });
    },
  });
}

export function useGenerateVestingEvents(accountId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (grantId: string) => apiClient.generateVestingEvents(accountId, grantId),
    onSuccess: (_, grantId) => {
      queryClient.invalidateQueries({ queryKey: ['options', 'vesting-events', accountId, grantId] });
      queryClient.invalidateQueries({ queryKey: ['options', 'summary', accountId] });
      queryClient.invalidateQueries({ queryKey: ['options', 'upcoming-vesting', accountId] });
    },
  });
}

// Vesting Events

export function useVestingEvents(accountId: string, grantId: string, enabled = true) {
  return useQuery({
    queryKey: ['options', 'vesting-events', accountId, grantId],
    queryFn: () => apiClient.getVestingEvents(accountId, grantId),
    enabled: !!accountId && !!grantId && enabled,
  });
}

export function useUpcomingVestingEvents(accountId: string, days = 365, enabled = true) {
  return useQuery({
    queryKey: ['options', 'upcoming-vesting', accountId, days],
    queryFn: () => apiClient.getUpcomingVestingEvents(accountId, days),
    enabled: !!accountId && enabled,
  });
}

export function useUpdateVestingEvent(accountId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, data }: { eventId: string; data: UpdateVestingEventRequest }) =>
      apiClient.updateVestingEvent(accountId, eventId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['options', 'vesting-events', accountId] });
      queryClient.invalidateQueries({ queryKey: ['options', 'summary', accountId] });
      queryClient.invalidateQueries({ queryKey: ['options', 'upcoming-vesting', accountId] });
    },
  });
}

// Exercises

export function useExercises(accountId: string, grantId: string, enabled = true) {
  return useQuery({
    queryKey: ['options', 'exercises', accountId, grantId],
    queryFn: () => apiClient.getExercises(accountId, grantId),
    enabled: !!accountId && !!grantId && enabled,
  });
}

export function useAllExercises(accountId: string, enabled = true) {
  return useQuery({
    queryKey: ['options', 'all-exercises', accountId],
    queryFn: () => apiClient.getAllExercises(accountId),
    enabled: !!accountId && enabled,
  });
}

export function useRecordExercise(accountId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ grantId, data }: { grantId: string; data: RecordExerciseRequest }) =>
      apiClient.recordExercise(accountId, grantId, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['options', 'exercises', accountId, data.grant_id] });
      queryClient.invalidateQueries({ queryKey: ['options', 'all-exercises', accountId] });
      queryClient.invalidateQueries({ queryKey: ['options', 'summary', accountId] });
      queryClient.invalidateQueries({ queryKey: ['options', 'tax-summary', accountId] });
    },
  });
}

export function useUpdateExercise(accountId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ exerciseId, data }: { exerciseId: string; data: UpdateExerciseRequest }) =>
      apiClient.updateExercise(accountId, exerciseId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['options', 'exercises', accountId] });
      queryClient.invalidateQueries({ queryKey: ['options', 'all-exercises', accountId] });
      queryClient.invalidateQueries({ queryKey: ['options', 'summary', accountId] });
      queryClient.invalidateQueries({ queryKey: ['options', 'tax-summary', accountId] });
    },
  });
}

export function useDeleteExercise(accountId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (exerciseId: string) => apiClient.deleteExercise(accountId, exerciseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['options', 'exercises', accountId] });
      queryClient.invalidateQueries({ queryKey: ['options', 'all-exercises', accountId] });
      queryClient.invalidateQueries({ queryKey: ['options', 'summary', accountId] });
      queryClient.invalidateQueries({ queryKey: ['options', 'tax-summary', accountId] });
    },
  });
}

// Sales

export function useSales(accountId: string, enabled = true) {
  return useQuery({
    queryKey: ['options', 'sales', accountId],
    queryFn: () => apiClient.getSales(accountId),
    enabled: !!accountId && enabled,
  });
}

export function useRecordSale(accountId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: RecordSaleRequest) => apiClient.recordSale(accountId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['options', 'sales', accountId] });
      queryClient.invalidateQueries({ queryKey: ['options', 'summary', accountId] });
      queryClient.invalidateQueries({ queryKey: ['options', 'tax-summary', accountId] });
    },
  });
}

export function useUpdateSale(accountId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ saleId, data }: { saleId: string; data: UpdateSaleRequest }) =>
      apiClient.updateSale(accountId, saleId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['options', 'sales', accountId] });
      queryClient.invalidateQueries({ queryKey: ['options', 'summary', accountId] });
      queryClient.invalidateQueries({ queryKey: ['options', 'tax-summary', accountId] });
    },
  });
}

export function useDeleteSale(accountId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (saleId: string) => apiClient.deleteSale(accountId, saleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['options', 'sales', accountId] });
      queryClient.invalidateQueries({ queryKey: ['options', 'summary', accountId] });
      queryClient.invalidateQueries({ queryKey: ['options', 'tax-summary', accountId] });
    },
  });
}

// FMV

export function useFMVHistory(accountId: string, enabled = true) {
  return useQuery({
    queryKey: ['options', 'fmv-history', accountId],
    queryFn: () => apiClient.getFMVHistory(accountId),
    enabled: !!accountId && enabled,
  });
}

export function useCurrentFMV(accountId: string, enabled = true) {
  return useQuery({
    queryKey: ['options', 'fmv-current', accountId],
    queryFn: () => apiClient.getCurrentFMV(accountId),
    enabled: !!accountId && enabled,
    retry: false,
  });
}

export function useRecordFMV(accountId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: RecordFMVRequest) => apiClient.recordFMV(accountId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['options', 'fmv-history', accountId] });
      queryClient.invalidateQueries({ queryKey: ['options', 'fmv-current', accountId] });
      queryClient.invalidateQueries({ queryKey: ['options', 'summary', accountId] });
    },
  });
}

// Summary

export function useOptionsSummary(accountId: string, enabled = true) {
  return useQuery({
    queryKey: ['options', 'summary', accountId],
    queryFn: () => apiClient.getOptionsSummary(accountId),
    enabled: !!accountId && enabled,
    retry: false,
  });
}

export function useTaxSummary(accountId: string, year?: number, enabled = true) {
  return useQuery({
    queryKey: ['options', 'tax-summary', accountId, year],
    queryFn: () => apiClient.getTaxSummary(accountId, year),
    enabled: !!accountId && enabled,
  });
}
