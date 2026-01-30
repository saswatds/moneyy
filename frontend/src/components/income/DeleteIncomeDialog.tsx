import { useDeleteIncomeRecord } from '@/hooks/use-income';
import type { IncomeRecord } from '@/lib/api-client';
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

interface DeleteIncomeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  income: IncomeRecord | null;
}

export function DeleteIncomeDialog({
  open,
  onOpenChange,
  income,
}: DeleteIncomeDialogProps) {
  const deleteMutation = useDeleteIncomeRecord();

  const handleDelete = () => {
    if (!income) return;

    deleteMutation.mutate(income.id, {
      onSuccess: () => {
        onOpenChange(false);
      },
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Income Record</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete the income record from "{income?.source}"?
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
