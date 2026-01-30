import { useState } from 'react';
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
import { useRecordExercise, useCurrentFMV } from '@/hooks/use-options';
import { useExchangeRates } from '@/hooks/use-exchange-rates';
import { formatCurrency, convertCurrency } from '@/lib/currency';
import type { EquityGrantWithSummary, ExerciseMethod, RecordExerciseRequest } from '@/lib/api-client';

interface ExerciseFormProps {
  accountId: string;
  grantId: string;
  grant?: EquityGrantWithSummary;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ExerciseForm({ accountId, grantId, grant, onSuccess, onCancel }: ExerciseFormProps) {
  const recordExercise = useRecordExercise(accountId);
  const { data: currentFMV } = useCurrentFMV(accountId);
  const { data: exchangeRates } = useExchangeRates();

  const defaultFMV = currentFMV?.fmv_per_share || grant?.current_fmv || grant?.fmv_at_grant || 0;
  const exercisableShares = grant ? grant.vested_quantity - grant.exercised_quantity : 0;

  const [exerciseDate, setExerciseDate] = useState(new Date().toISOString().split('T')[0]);
  const [quantity, setQuantity] = useState(exercisableShares.toString());
  const [fmvAtExercise, setFmvAtExercise] = useState(defaultFMV.toString());
  const [exerciseMethod, setExerciseMethod] = useState<ExerciseMethod | ''>('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);

    if (!exerciseDate || !quantity || !fmvAtExercise) {
      setError('Please fill in all required fields');
      return;
    }

    const qty = parseInt(quantity);
    if (qty > exercisableShares) {
      setError(`You can only exercise up to ${exercisableShares} shares`);
      return;
    }

    try {
      const data: RecordExerciseRequest = {
        grant_id: grantId,
        exercise_date: exerciseDate,
        quantity: qty,
        fmv_at_exercise: parseFloat(fmvAtExercise),
        exercise_method: exerciseMethod || undefined,
        notes: notes || undefined,
      };

      await recordExercise.mutateAsync({ grantId, data });
      onSuccess();
    } catch (err) {
      setError('Failed to record exercise');
    }
  };

  // Calculate preview values
  const qty = parseInt(quantity) || 0;
  const fmv = parseFloat(fmvAtExercise) || 0;
  const strikePrice = grant?.strike_price || 0;
  const exerciseCost = qty * strikePrice;
  const taxableBenefit = Math.max(0, qty * (fmv - strikePrice));
  const totalValue = qty * fmv;
  const grantCurrency = grant?.currency || 'USD';

  const formatCAD = (amount: number) => {
    if (grantCurrency === 'CAD') return null;
    const cadAmount = convertCurrency(amount, grantCurrency, 'CAD', exchangeRates);
    return formatCurrency(cadAmount, 'CAD');
  };

  return (
    <div className="space-y-4">
      {grant && (
        <div className="p-3 bg-muted rounded-lg text-sm">
          <div className="font-medium mb-1">{grant.company_name} - {grant.grant_type.toUpperCase()} ({grantCurrency})</div>
          <div className="text-muted-foreground">
            Strike Price: {formatCurrency(grant.strike_price || 0, grantCurrency)}
            {grantCurrency !== 'CAD' && (
              <span className="text-muted-foreground/70 ml-1">
                ({formatCAD(grant.strike_price || 0)})
              </span>
            )} | Exercisable: {exercisableShares.toLocaleString()} shares
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Exercise Date *</Label>
          <Input
            type="date"
            value={exerciseDate}
            onChange={(e) => setExerciseDate(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            The date you exercise your options.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Number of Shares *</Label>
          <Input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder={exercisableShares.toString()}
            max={exercisableShares}
          />
          <p className="text-xs text-muted-foreground">
            How many vested options to exercise (max {exercisableShares.toLocaleString()}).
          </p>
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
            placeholder="25.00"
          />
          <p className="text-xs text-muted-foreground">
            Current fair market value per share. Used to calculate taxable benefit.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Exercise Method</Label>
          <Select value={exerciseMethod} onValueChange={(v) => setExerciseMethod(v as ExerciseMethod)}>
            <SelectTrigger>
              <SelectValue placeholder="Select method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">Cash Exercise</SelectItem>
              <SelectItem value="cashless">Cashless Exercise</SelectItem>
              <SelectItem value="same_day_sale">Same Day Sale</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Cash: pay upfront. Cashless: use shares to cover cost. Same-day sale: sell immediately.
          </p>
        </div>
      </div>

      {/* Preview calculation */}
      {qty > 0 && (
        <div className="p-3 bg-muted rounded-lg space-y-1 text-sm">
          <div className="font-medium">Exercise Summary</div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Exercise Cost ({qty} x {formatCurrency(strikePrice, grantCurrency)})</span>
            <div className="text-right">
              <div>{formatCurrency(exerciseCost, grantCurrency)}</div>
              {grantCurrency !== 'CAD' && (
                <div className="text-xs text-muted-foreground/70">{formatCAD(exerciseCost)}</div>
              )}
            </div>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total Value ({qty} x {formatCurrency(fmv, grantCurrency)})</span>
            <div className="text-right">
              <div className="text-green-600">{formatCurrency(totalValue, grantCurrency)}</div>
              {grantCurrency !== 'CAD' && (
                <div className="text-xs text-green-600/70">{formatCAD(totalValue)}</div>
              )}
            </div>
          </div>
          <div className="flex justify-between border-t pt-1 mt-1">
            <span className="text-muted-foreground">Taxable Benefit (Canadian)</span>
            <div className="text-right">
              <div className="text-yellow-600">{formatCurrency(taxableBenefit, grantCurrency)}</div>
              {grantCurrency !== 'CAD' && (
                <div className="text-xs text-yellow-600/70">{formatCAD(taxableBenefit)}</div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional notes about this exercise..."
        />
        <p className="text-xs text-muted-foreground">
          Any details about this exercise (e.g., broker confirmation number).
        </p>
      </div>

      {error && (
        <div className="text-sm text-red-500">{error}</div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={recordExercise.isPending}>
          {recordExercise.isPending ? 'Recording...' : 'Record Exercise'}
        </Button>
      </div>
    </div>
  );
}
