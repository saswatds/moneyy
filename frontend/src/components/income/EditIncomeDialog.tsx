import { useState, useEffect } from 'react';
import { useUpdateIncomeRecord } from '@/hooks/use-income';
import type { IncomeRecord, IncomeCategory, IncomeFrequency } from '@/lib/api-client';
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
import { Switch } from '@/components/ui/switch';

interface EditIncomeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  income: IncomeRecord | null;
}

const INCOME_CATEGORIES: { value: IncomeCategory; label: string }[] = [
  { value: 'employment', label: 'Employment' },
  { value: 'investment', label: 'Investment' },
  { value: 'rental', label: 'Rental' },
  { value: 'business', label: 'Business' },
  { value: 'other', label: 'Other' },
];

const INCOME_FREQUENCIES: { value: IncomeFrequency; label: string }[] = [
  { value: 'one_time', label: 'One-Time' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'bi-weekly', label: 'Bi-Weekly' },
  { value: 'annually', label: 'Annually' },
];

const CURRENCIES = [
  { value: 'CAD', label: 'CAD' },
  { value: 'USD', label: 'USD' },
  { value: 'INR', label: 'INR' },
];

export function EditIncomeDialog({
  open,
  onOpenChange,
  income,
}: EditIncomeDialogProps) {
  const [formData, setFormData] = useState({
    source: '',
    category: '' as IncomeCategory,
    amount: '',
    currency: 'CAD' as 'CAD' | 'USD' | 'INR',
    frequency: 'monthly' as IncomeFrequency,
    tax_year: new Date().getFullYear(),
    date_received: '',
    description: '',
    is_taxable: true,
  });

  useEffect(() => {
    if (income) {
      setFormData({
        source: income.source,
        category: income.category,
        amount: income.amount.toString(),
        currency: income.currency,
        frequency: income.frequency,
        tax_year: income.tax_year,
        date_received: income.date_received || '',
        description: income.description || '',
        is_taxable: income.is_taxable,
      });
    }
  }, [income]);

  const updateMutation = useUpdateIncomeRecord();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!income) return;

    updateMutation.mutate(
      {
        id: income.id,
        data: {
          source: formData.source,
          category: formData.category,
          amount: parseFloat(formData.amount),
          currency: formData.currency,
          frequency: formData.frequency,
          tax_year: formData.tax_year,
          date_received: formData.date_received || undefined,
          description: formData.description || undefined,
          is_taxable: formData.is_taxable,
        },
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Income</DialogTitle>
          <DialogDescription>
            Update the details of this income source.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="source">Source</Label>
              <Input
                id="source"
                placeholder="e.g., ABC Corporation, Rental Property"
                value={formData.source}
                onChange={(e) =>
                  setFormData({ ...formData, source: e.target.value })
                }
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) =>
                    setFormData({ ...formData, category: value as IncomeCategory })
                  }
                >
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INCOME_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tax_year">Tax Year</Label>
                <Input
                  id="tax_year"
                  type="number"
                  min="2000"
                  max="2100"
                  value={formData.tax_year}
                  onChange={(e) =>
                    setFormData({ ...formData, tax_year: parseInt(e.target.value) })
                  }
                  required
                />
              </div>
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
                    setFormData({ ...formData, currency: value as 'CAD' | 'USD' | 'INR' })
                  }
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="frequency">Frequency</Label>
                <Select
                  value={formData.frequency}
                  onValueChange={(value) =>
                    setFormData({ ...formData, frequency: value as IncomeFrequency })
                  }
                >
                  <SelectTrigger id="frequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INCOME_FREQUENCIES.map((freq) => (
                      <SelectItem key={freq.value} value={freq.value}>
                        {freq.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="date_received">Date Received (Optional)</Label>
                <Input
                  id="date_received"
                  type="date"
                  value={formData.date_received}
                  onChange={(e) =>
                    setFormData({ ...formData, date_received: e.target.value })
                  }
                />
              </div>
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

            <div className="flex items-center space-x-2">
              <Switch
                id="is_taxable"
                checked={formData.is_taxable}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_taxable: checked })
                }
              />
              <Label htmlFor="is_taxable">Taxable Income</Label>
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
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
