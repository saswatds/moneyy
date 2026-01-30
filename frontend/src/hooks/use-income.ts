import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  apiClient,
  type CreateIncomeRecordRequest,
  type UpdateIncomeRecordRequest,
  type SaveTaxConfigRequest,
  type IncomeCategory,
} from '@/lib/api-client';

// Income Records

export function useIncomeRecords(year?: number, category?: IncomeCategory, enabled = true) {
  return useQuery({
    queryKey: ['income', 'records', year, category],
    queryFn: () => apiClient.getIncomeRecords(year, category),
    enabled,
  });
}

export function useIncomeRecord(id: string, enabled = true) {
  return useQuery({
    queryKey: ['income', 'records', id],
    queryFn: () => apiClient.getIncomeRecord(id),
    enabled: !!id && enabled,
  });
}

export function useCreateIncomeRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateIncomeRecordRequest) => apiClient.createIncomeRecord(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['income', 'records'] });
      queryClient.invalidateQueries({ queryKey: ['income', 'summary', data.tax_year] });
      queryClient.invalidateQueries({ queryKey: ['income', 'comparison'] });
    },
  });
}

export function useUpdateIncomeRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateIncomeRecordRequest }) =>
      apiClient.updateIncomeRecord(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['income', 'records'] });
      queryClient.invalidateQueries({ queryKey: ['income', 'records', data.id] });
      queryClient.invalidateQueries({ queryKey: ['income', 'summary', data.tax_year] });
      queryClient.invalidateQueries({ queryKey: ['income', 'comparison'] });
    },
  });
}

export function useDeleteIncomeRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.deleteIncomeRecord(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['income', 'records'] });
      queryClient.invalidateQueries({ queryKey: ['income', 'summary'] });
      queryClient.invalidateQueries({ queryKey: ['income', 'comparison'] });
    },
  });
}

// Annual Summary

export function useAnnualIncomeSummary(year: number, enabled = true) {
  return useQuery({
    queryKey: ['income', 'summary', year],
    queryFn: () => apiClient.getAnnualIncomeSummary(year),
    enabled: !!year && enabled,
  });
}

// Multi-Year Comparison

export function useIncomeComparison(startYear: number, endYear: number, enabled = true) {
  return useQuery({
    queryKey: ['income', 'comparison', startYear, endYear],
    queryFn: () => apiClient.getIncomeComparison(startYear, endYear),
    enabled: !!startYear && !!endYear && enabled,
  });
}

// Tax Configuration

export function useIncomeTaxConfig(year: number, enabled = true) {
  return useQuery({
    queryKey: ['income', 'tax-config', year],
    queryFn: () => apiClient.getIncomeTaxConfig(year),
    enabled: !!year && enabled,
  });
}

export function useSaveIncomeTaxConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SaveTaxConfigRequest) => apiClient.saveIncomeTaxConfig(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['income', 'tax-config', data.tax_year] });
      queryClient.invalidateQueries({ queryKey: ['income', 'summary', data.tax_year] });
      queryClient.invalidateQueries({ queryKey: ['income', 'comparison'] });
    },
  });
}
