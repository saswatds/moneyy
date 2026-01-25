import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, type RecurringExpense } from '@/lib/api-client';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface DeleteRecurringExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense: RecurringExpense | null;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

const getFrequencyLabel = (frequency: string) => {
  switch (frequency) {
    case 'weekly':
      return 'Weekly';
    case 'bi-weekly':
      return 'Bi-Weekly';
    case 'monthly':
      return 'Monthly';
    case 'quarterly':
      return 'Quarterly';
    case 'annually':
      return 'Annually';
    default:
      return frequency;
  }
};

export function DeleteRecurringExpenseDialog({
  open,
  onOpenChange,
  expense,
}: DeleteRecurringExpenseDialogProps) {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteRecurringExpense(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-expenses'] });
      onOpenChange(false);
    },
  });

  const handleDelete = () => {
    if (expense) {
      deleteMutation.mutate(expense.id);
    }
  };

  if (!expense) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Recurring Expense?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete <strong>{expense.name}</strong>?
            <br />
            <br />
            <span className="text-sm">
              Amount: {formatCurrency(expense.amount)} ({getFrequencyLabel(expense.frequency)})
              <br />
              Category: {expense.category.charAt(0).toUpperCase() + expense.category.slice(1)}
            </span>
            <br />
            <br />
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
