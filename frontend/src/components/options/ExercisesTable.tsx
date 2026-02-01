import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { IconDotsVertical, IconEdit, IconTrash } from '@tabler/icons-react';
import type { EquityExercise, EquityGrantWithSummary, ExerciseMethod, UpdateExerciseRequest } from '@/lib/api-client';
import { useUpdateExercise, useDeleteExercise } from '@/hooks/use-options';
import { useExchangeRates } from '@/hooks/use-exchange-rates';
import { formatCurrency, convertCurrency } from '@/lib/currency';

interface ExercisesTableProps {
  exercises: EquityExercise[];
  grants: EquityGrantWithSummary[];
  accountId: string;
}

export function ExercisesTable({ exercises, grants, accountId }: ExercisesTableProps) {
  const [editingExercise, setEditingExercise] = useState<EquityExercise | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const { data: exchangeRates } = useExchangeRates();
  const deleteExercise = useDeleteExercise(accountId);

  const getGrantCurrency = (grantId: string) => {
    const grant = grants.find(g => g.id === grantId);
    return grant?.currency || 'USD';
  };

  const formatCADEquivalent = (amount: number, currency: string) => {
    if (currency === 'CAD') return null;
    const cadAmount = convertCurrency(amount, currency, 'CAD', exchangeRates);
    return formatCurrency(cadAmount, 'CAD');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatExerciseMethod = (method?: string) => {
    switch (method) {
      case 'cash':
        return 'Cash';
      case 'cashless':
        return 'Cashless';
      case 'same_day_sale':
        return 'Same-Day Sale';
      default:
        return '-';
    }
  };

  const handleEdit = (exercise: EquityExercise) => {
    setEditingExercise(exercise);
    setEditDialogOpen(true);
  };

  const handleDelete = async (exerciseId: string) => {
    if (window.confirm('Are you sure you want to delete this exercise? This action cannot be undone.')) {
      await deleteExercise.mutateAsync(exerciseId);
    }
  };

  if (exercises.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No exercises recorded yet. Exercise options when you want to convert them to shares.
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                Date
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                Shares
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                Strike Price
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                FMV at Exercise
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                Exercise Cost
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                Taxable Benefit
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                Method
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {exercises.map((exercise) => {
              const currency = getGrantCurrency(exercise.grant_id);
              return (
              <tr key={exercise.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                <td className="px-4 py-4 text-sm">
                  {formatDate(exercise.exercise_date)}
                  <div className="text-xs text-muted-foreground">{currency}</div>
                </td>
                <td className="px-4 py-4 text-sm text-right">
                  {exercise.quantity.toLocaleString()}
                </td>
                <td className="px-4 py-4 text-sm text-right">
                  <div>{formatCurrency(exercise.strike_price, currency)}</div>
                  {currency !== 'CAD' && (
                    <div className="text-xs text-muted-foreground/70">{formatCADEquivalent(exercise.strike_price, currency)}</div>
                  )}
                </td>
                <td className="px-4 py-4 text-sm text-right">
                  <div>{formatCurrency(exercise.fmv_at_exercise, currency)}</div>
                  {currency !== 'CAD' && (
                    <div className="text-xs text-muted-foreground/70">{formatCADEquivalent(exercise.fmv_at_exercise, currency)}</div>
                  )}
                </td>
                <td className="px-4 py-4 text-sm text-right font-medium">
                  <div>{formatCurrency(exercise.exercise_cost, currency)}</div>
                  {currency !== 'CAD' && (
                    <div className="text-xs text-muted-foreground/70 font-normal">{formatCADEquivalent(exercise.exercise_cost, currency)}</div>
                  )}
                </td>
                <td className="px-4 py-4 text-sm text-right font-medium text-amber-600 dark:text-amber-400">
                  <div>{formatCurrency(exercise.taxable_benefit, currency)}</div>
                  {currency !== 'CAD' && (
                    <div className="text-xs opacity-70 font-normal">{formatCADEquivalent(exercise.taxable_benefit, currency)}</div>
                  )}
                </td>
                <td className="px-4 py-4 text-sm">
                  <span className={`text-xs px-2 py-1 rounded ${
                    exercise.exercise_method === 'cash'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                      : exercise.exercise_method === 'cashless'
                      ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
                      : exercise.exercise_method === 'same_day_sale'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                  }`}>
                    {formatExerciseMethod(exercise.exercise_method)}
                  </span>
                </td>
                <td className="px-4 py-4 text-sm text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <IconDotsVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEdit(exercise)}>
                        <IconEdit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDelete(exercise.id)}
                        className="text-red-600"
                      >
                        <IconTrash className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            );})}
          </tbody>
        </table>
      </div>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Exercise</DialogTitle>
            <DialogDescription>
              Update the details of this exercise record
            </DialogDescription>
          </DialogHeader>
          {editingExercise && (
            <EditExerciseForm
              exercise={editingExercise}
              accountId={accountId}
              currency={getGrantCurrency(editingExercise.grant_id)}
              onSuccess={() => {
                setEditDialogOpen(false);
                setEditingExercise(null);
              }}
              onCancel={() => {
                setEditDialogOpen(false);
                setEditingExercise(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

interface EditExerciseFormProps {
  exercise: EquityExercise;
  accountId: string;
  currency: string;
  onSuccess: () => void;
  onCancel: () => void;
}

function EditExerciseForm({ exercise, accountId, currency: _currency, onSuccess, onCancel }: EditExerciseFormProps) {
  const updateExercise = useUpdateExercise(accountId);

  const [exerciseDate, setExerciseDate] = useState(exercise.exercise_date.split('T')[0]);
  const [quantity, setQuantity] = useState(exercise.quantity.toString());
  const [fmvAtExercise, setFmvAtExercise] = useState(exercise.fmv_at_exercise.toString());
  const [exerciseMethod, setExerciseMethod] = useState<ExerciseMethod | ''>(exercise.exercise_method || '');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);

    if (!exerciseDate || !quantity || !fmvAtExercise) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      const data: UpdateExerciseRequest = {
        exercise_date: exerciseDate,
        quantity: parseInt(quantity),
        fmv_at_exercise: parseFloat(fmvAtExercise),
        exercise_method: exerciseMethod || undefined,
      };

      await updateExercise.mutateAsync({ exerciseId: exercise.id, data });
      onSuccess();
    } catch (err) {
      setError('Failed to update exercise');
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Exercise Date *</Label>
          <Input
            type="date"
            value={exerciseDate}
            onChange={(e) => setExerciseDate(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Quantity *</Label>
          <Input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>FMV at Exercise *</Label>
          <Input
            type="number"
            step="0.01"
            value={fmvAtExercise}
            onChange={(e) => setFmvAtExercise(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Exercise Method</Label>
          <Select value={exerciseMethod} onValueChange={(v) => setExerciseMethod(v as ExerciseMethod)}>
            <SelectTrigger>
              <SelectValue placeholder="Select method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="cashless">Cashless</SelectItem>
              <SelectItem value="same_day_sale">Same-Day Sale</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-500">{error}</div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={updateExercise.isPending}>
          {updateExercise.isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
