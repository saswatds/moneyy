import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useRecordFMV, useFMVHistory } from '@/hooks/use-options';
import type { RecordFMVRequest } from '@/lib/api-client';

interface FMVFormProps {
  accountId: string;
  onSuccess: () => void;
  onCancel: () => void;
  defaultCurrency?: string;
}

export function FMVForm({ accountId, onSuccess, onCancel, defaultCurrency = 'USD' }: FMVFormProps) {
  const recordFMV = useRecordFMV(accountId);
  const { data: fmvHistory } = useFMVHistory(accountId);

  const [currency, setCurrency] = useState(defaultCurrency);
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [fmvPerShare, setFmvPerShare] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Find current FMV for selected currency
  const currentFMVForCurrency = fmvHistory?.entries?.find(
    entry => entry.currency === currency
  );

  // Update FMV value when currency changes and we have existing data
  useEffect(() => {
    if (currentFMVForCurrency && !fmvPerShare) {
      setFmvPerShare(currentFMVForCurrency.fmv_per_share.toString());
    }
  }, [currency, currentFMVForCurrency]);

  const formatCurrency = (amount: number, curr: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: curr,
    }).format(amount);
  };

  const handleSubmit = async () => {
    setError(null);

    if (!effectiveDate || !fmvPerShare) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      const data: RecordFMVRequest = {
        account_id: accountId,
        currency: currency,
        effective_date: effectiveDate,
        fmv_per_share: parseFloat(fmvPerShare),
        notes: notes || undefined,
      };

      await recordFMV.mutateAsync(data);
      onSuccess();
    } catch (err) {
      setError('Failed to record FMV');
    }
  };

  // Get unique currencies from FMV history
  const existingCurrencies = fmvHistory?.entries
    ? [...new Set(fmvHistory.entries.map(e => e.currency))]
    : [];

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Currency *</Label>
        <Select value={currency} onValueChange={setCurrency}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="USD">USD - US Dollar</SelectItem>
            <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
            <SelectItem value="INR">INR - Indian Rupee</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          FMV is tracked separately for each currency
        </p>
      </div>

      <div className="space-y-2">
        <Label>Effective Date *</Label>
        <Input
          type="date"
          value={effectiveDate}
          onChange={(e) => setEffectiveDate(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>FMV Per Share *</Label>
        <Input
          type="number"
          step="0.01"
          value={fmvPerShare}
          onChange={(e) => setFmvPerShare(e.target.value)}
          placeholder="25.00"
        />
        {currentFMVForCurrency && (
          <p className="text-xs text-muted-foreground">
            Current {currency} FMV: {formatCurrency(currentFMVForCurrency.fmv_per_share, currency)} (as of {new Date(currentFMVForCurrency.effective_date).toLocaleDateString()})
          </p>
        )}
        {!currentFMVForCurrency && existingCurrencies.length > 0 && (
          <p className="text-xs text-muted-foreground">
            No FMV recorded for {currency} yet
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Source of valuation (e.g., 409A valuation, latest funding round)..."
        />
      </div>

      {error && (
        <div className="text-sm text-red-500">{error}</div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={recordFMV.isPending}>
          {recordFMV.isPending ? 'Saving...' : 'Update FMV'}
        </Button>
      </div>
    </div>
  );
}
