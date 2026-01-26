import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Textarea } from '@/components/ui/textarea';

interface AddRecurringExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EXPENSE_CATEGORIES = [
  'housing',
  'utilities',
  'transportation',
  'food',
  'healthcare',
  'insurance',
  'entertainment',
  'subscriptions',
  'debt',
  'savings',
  'other',
];

const FREQUENCIES = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'bi-weekly', label: 'Bi-Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annually', label: 'Annually' },
];

const CURRENCIES = [
  { value: 'CAD', label: 'CAD' },
  { value: 'USD', label: 'USD' },
  { value: 'INR', label: 'INR' },
];

export function AddRecurringExpenseDialog({
  open,
  onOpenChange,
}: AddRecurringExpenseDialogProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    amount: '',
    currency: 'CAD',
    category: '',
    frequency: '',
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      apiClient.createRecurringExpense({
        name: data.name,
        description: data.description || undefined,
        amount: parseFloat(data.amount),
        currency: data.currency as 'CAD' | 'USD' | 'INR',
        category: data.category,
        frequency: data.frequency as 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly' | 'annually',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-expenses'] });
      onOpenChange(false);
      setFormData({
        name: '',
        description: '',
        amount: '',
        currency: 'CAD',
        category: '',
        frequency: '',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Recurring Expense</DialogTitle>
          <DialogDescription>
            Add a new recurring expense to track your monthly spending.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="e.g., Netflix Subscription"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Add any additional details..."
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={2}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2 col-span-2">
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) =>
                    setFormData({ ...formData, amount: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Select
                  value={formData.currency}
                  onValueChange={(value) =>
                    setFormData({ ...formData, currency: value })
                  }
                  required
                >
                  <SelectTrigger id="currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((curr) => (
                      <SelectItem key={curr.value} value={curr.value}>
                        {curr.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="frequency">Frequency</Label>
              <Select
                value={formData.frequency}
                onValueChange={(value) =>
                  setFormData({ ...formData, frequency: value })
                }
                required
              >
                <SelectTrigger id="frequency">
                  <SelectValue placeholder="Select frequency" />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map((freq) => (
                    <SelectItem key={freq.value} value={freq.value}>
                      {freq.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) =>
                  setFormData({ ...formData, category: value })
                }
                required
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Adding...' : 'Add Expense'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
