import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type {
  CreateMortgageDetailsRequest,
  CreateMortgagePaymentRequest,
} from '@/lib/api-client';

export function useMortgageDetails(accountId: string) {
  return useQuery({
    queryKey: ['mortgage-details', accountId],
    queryFn: () => apiClient.getMortgageDetails(accountId),
    retry: false, // Don't retry if mortgage details don't exist
    enabled: !!accountId,
  });
}

export function useCreateMortgageDetails() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      accountId,
      data,
    }: {
      accountId: string;
      data: CreateMortgageDetailsRequest;
    }) => apiClient.createMortgageDetails(accountId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['mortgage-details', variables.accountId] });
    },
  });
}

export function useAmortizationSchedule(accountId: string) {
  return useQuery({
    queryKey: ['amortization-schedule', accountId],
    queryFn: () => apiClient.getAmortizationSchedule(accountId),
    enabled: !!accountId,
  });
}

export function useMortgagePayments(accountId: string) {
  return useQuery({
    queryKey: ['mortgage-payments', accountId],
    queryFn: () => apiClient.getMortgagePayments(accountId),
    enabled: !!accountId,
  });
}

export function useRecordMortgagePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      accountId,
      data,
    }: {
      accountId: string;
      data: CreateMortgagePaymentRequest;
    }) => apiClient.recordMortgagePayment(accountId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['mortgage-payments', variables.accountId] });
      queryClient.invalidateQueries({ queryKey: ['mortgage-details', variables.accountId] });
      queryClient.invalidateQueries({ queryKey: ['balances', variables.accountId] });
    },
  });
}
