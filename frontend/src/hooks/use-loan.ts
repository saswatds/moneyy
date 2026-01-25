import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type {
  CreateLoanDetailsRequest,
  CreateLoanPaymentRequest,
} from '@/lib/api-client';

export function useLoanDetails(accountId: string) {
  return useQuery({
    queryKey: ['loan-details', accountId],
    queryFn: () => apiClient.getLoanDetails(accountId),
    retry: false, // Don't retry if loan details don't exist
    enabled: !!accountId,
  });
}

export function useCreateLoanDetails() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      accountId,
      data,
    }: {
      accountId: string;
      data: CreateLoanDetailsRequest;
    }) => apiClient.createLoanDetails(accountId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['loan-details', variables.accountId] });
    },
  });
}

export function useLoanAmortizationSchedule(accountId: string) {
  return useQuery({
    queryKey: ['loan-amortization-schedule', accountId],
    queryFn: () => apiClient.getLoanAmortizationSchedule(accountId),
    enabled: !!accountId,
  });
}

export function useLoanPayments(accountId: string) {
  return useQuery({
    queryKey: ['loan-payments', accountId],
    queryFn: () => apiClient.getLoanPayments(accountId),
    enabled: !!accountId,
  });
}

export function useRecordLoanPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      accountId,
      data,
    }: {
      accountId: string;
      data: CreateLoanPaymentRequest;
    }) => apiClient.recordLoanPayment(accountId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['loan-payments', variables.accountId] });
      queryClient.invalidateQueries({ queryKey: ['loan-details', variables.accountId] });
      queryClient.invalidateQueries({ queryKey: ['balances', variables.accountId] });
    },
  });
}
