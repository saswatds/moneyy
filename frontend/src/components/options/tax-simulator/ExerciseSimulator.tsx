import { useState, useEffect } from 'react';
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { IconPlus } from '@tabler/icons-react';
import type { GrantForSimulation, SimulatedExercise } from './types';
import { DEFAULT_MARGINAL_RATE } from '@/lib/tax-calculations';
import { formatCurrency } from '@/lib/currency';
import { apiClient, type ExerciseTaxResult } from '@/lib/api-client';

interface ExerciseSimulatorProps {
  grants: GrantForSimulation[];
  simulatedExercisedByGrant: Record<string, number>;
  onAddExercise: (exercise: Omit<SimulatedExercise, 'id'>) => void;
  marginalRate?: number;
}

export function ExerciseSimulator({
  grants,
  simulatedExercisedByGrant,
  onAddExercise,
  marginalRate = DEFAULT_MARGINAL_RATE,
}: ExerciseSimulatorProps) {
  const [selectedGrantId, setSelectedGrantId] = useState<string>('');
  const [exerciseDate, setExerciseDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [quantity, setQuantity] = useState<string>('');
  const [fmvAtExercise, setFmvAtExercise] = useState<string>('');

  const [preview, setPreview] = useState<ExerciseTaxResult | null>(null);

  const selectedGrant = grants.find(g => g.id === selectedGrantId);

  // Helper to calculate available options for a grant (considering simulated exercises)
  const getAvailableOptions = (grant: GrantForSimulation, forDate?: string) => {
    // Base available = vested - exercised (actual)
    let available = grant.vestedQuantity - grant.exercisedQuantity;

    // Subtract simulated exercises in this scenario
    const simulated = simulatedExercisedByGrant[grant.id] || 0;
    available -= simulated;

    // If exercise date is in the future, project additional vesting
    if (forDate && grant.unvestedQuantity > 0) {
      const exerciseDateObj = new Date(forDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (exerciseDateObj > today) {
        // Check vesting events for options that will vest by the exercise date
        if (grant.vestingEvents && grant.vestingEvents.length > 0) {
          for (const event of grant.vestingEvents) {
            const vestDate = new Date(event.vestDate);
            if (event.status === 'pending' && vestDate <= exerciseDateObj) {
              available += event.quantity;
            }
          }
        }
      }
    }

    return Math.max(0, available);
  };

  // Filter to only show grants that have options available to exercise
  const exercisableGrants = grants.filter(
    g =>
      (g.grantType === 'iso' || g.grantType === 'nso') &&
      g.strikePrice !== undefined &&
      getAvailableOptions(g) > 0
  );

  // Calculate preview using API
  useEffect(() => {
    const calculatePreview = async () => {
      if (!selectedGrant || !quantity || !fmvAtExercise) {
        setPreview(null);
        return;
      }
      if (!selectedGrant.strikePrice) {
        setPreview(null);
        return;
      }

      const qty = parseInt(quantity, 10);
      const fmv = parseFloat(fmvAtExercise);

      if (isNaN(qty) || isNaN(fmv) || qty <= 0) {
        setPreview(null);
        return;
      }

      try {
        const result = await apiClient.calculateExerciseTax({
          quantity: qty,
          strike_price: selectedGrant.strikePrice,
          fmv_at_exercise: fmv,
          marginal_rate: marginalRate,
        });
        setPreview(result);
      } catch (error) {
        console.error('Failed to calculate exercise tax:', error);
        setPreview(null);
      }
    };

    // Debounce the API call
    const timeoutId = setTimeout(calculatePreview, 300);
    return () => clearTimeout(timeoutId);
  }, [selectedGrant, quantity, fmvAtExercise, marginalRate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedGrant || !preview || !selectedGrant.strikePrice) return;

    const qty = parseInt(quantity, 10);
    const fmv = parseFloat(fmvAtExercise);

    const exercise: Omit<SimulatedExercise, 'id'> = {
      grantId: selectedGrant.id,
      grantLabel: `${selectedGrant.grantNumber || 'Grant'} - ${selectedGrant.companyName}`,
      exerciseDate,
      quantity: qty,
      fmvAtExercise: fmv,
      strikePrice: selectedGrant.strikePrice,
      currency: selectedGrant.currency,
      exerciseCost: preview.exercise_cost,
      taxableBenefit: preview.taxable_benefit,
      stockOptionDeduction: preview.stock_option_deduction,
      netTaxable: preview.net_taxable,
      estimatedTax: preview.estimated_tax,
    };

    onAddExercise(exercise);

    // Reset form
    setSelectedGrantId('');
    setQuantity('');
    setFmvAtExercise('');
  };

  // Calculate available shares based on selected grant and exercise date
  const availableShares = selectedGrant
    ? getAvailableOptions(selectedGrant, exerciseDate)
    : 0;

  // Calculate how many are currently vested vs will vest by the exercise date
  const currentlyAvailable = selectedGrant
    ? getAvailableOptions(selectedGrant)
    : 0;
  const projectedFromVesting = availableShares - currentlyAvailable;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Simulate Exercise</CardTitle>
        <CardDescription>
          Model exercising options to see tax impact
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="exerciseDate">Exercise Date</Label>
            <Input
              id="exerciseDate"
              type="date"
              value={exerciseDate}
              onChange={e => setExerciseDate(e.target.value)}
              className="w-[180px]"
              required
            />
            <p className="text-xs text-muted-foreground">
              Select a date to see available options (including projected vesting)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="grant">Grant</Label>
            <Select value={selectedGrantId} onValueChange={setSelectedGrantId}>
              <SelectTrigger id="grant">
                <SelectValue placeholder="Select a grant" />
              </SelectTrigger>
              <SelectContent>
                {exercisableGrants.length === 0 ? (
                  <SelectItem value="none" disabled>
                    No exercisable grants for this date
                  </SelectItem>
                ) : (
                  exercisableGrants.map(grant => {
                    const available = getAvailableOptions(grant, exerciseDate);
                    return (
                      <SelectItem key={grant.id} value={grant.id}>
                        {grant.grantNumber || 'Grant'} - {grant.companyName} ({available.toLocaleString()} available)
                      </SelectItem>
                    );
                  })
                )}
              </SelectContent>
            </Select>
            {selectedGrant && (
              <div className="text-xs text-muted-foreground space-y-0.5">
                <p>
                  Available by {exerciseDate}: {availableShares.toLocaleString()} shares @{' '}
                  {formatCurrency(selectedGrant.strikePrice!, selectedGrant.currency)} strike
                </p>
                {projectedFromVesting > 0 && (
                  <p className="text-green-600 dark:text-green-400">
                    (includes +{projectedFromVesting.toLocaleString()} vesting by this date)
                  </p>
                )}
                {simulatedExercisedByGrant[selectedGrant.id] > 0 && (
                  <p className="text-orange-600 dark:text-orange-400">
                    ({simulatedExercisedByGrant[selectedGrant.id].toLocaleString()} already simulated in this scenario)
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                max={availableShares || undefined}
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                placeholder="# of options"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fmv">FMV at Exercise</Label>
              <Input
                id="fmv"
                type="number"
                min="0"
                step="0.01"
                value={fmvAtExercise}
                onChange={e => setFmvAtExercise(e.target.value)}
                placeholder={
                  selectedGrant?.currentFmv
                    ? `${selectedGrant.currentFmv}`
                    : 'Price/share'
                }
                required
              />
              {selectedGrant?.currentFmv && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs p-0"
                  onClick={() => setFmvAtExercise(selectedGrant.currentFmv!.toString())}
                >
                  Use current FMV ({formatCurrency(selectedGrant.currentFmv, selectedGrant.currency)})
                </Button>
              )}
            </div>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={!selectedGrant || !preview}
          >
            <IconPlus className="h-4 w-4 mr-2" />
            Add Exercise
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
