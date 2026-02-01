import { useState, useMemo, useEffect } from 'react';
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
import type { GrantForSimulation, SimulatedSale, SimulatedExercise } from './types';
import { DEFAULT_MARGINAL_RATE } from '@/lib/tax-calculations';
import { formatCurrency } from '@/lib/currency';
import { apiClient, type SaleTaxResult } from '@/lib/api-client';

interface SaleSimulatorProps {
  grants: GrantForSimulation[]; // Reserved for future use with actual exercised shares
  simulatedExercises: SimulatedExercise[];
  simulatedSales: SimulatedSale[];
  onAddSale: (sale: Omit<SimulatedSale, 'id'>) => void;
  marginalRate?: number;
}

interface ShareLot {
  id: string;
  exerciseId: string; // ID of the simulated exercise this lot came from
  grantId: string;
  grantLabel: string;
  acquisitionDate: string;
  totalQuantity: number; // Total shares from this exercise
  availableQuantity: number; // After subtracting simulated sales
  costBasis: number; // per share
  currency: string;
  source: 'exercise' | 'simulated_exercise';
}

export function SaleSimulator({
  grants: _grants, // Reserved for future use with actual exercised shares
  simulatedExercises,
  simulatedSales,
  onAddSale,
  marginalRate = DEFAULT_MARGINAL_RATE,
}: SaleSimulatorProps) {
  const [selectedLotId, setSelectedLotId] = useState<string>('');
  const [saleDate, setSaleDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [quantity, setQuantity] = useState<string>('');
  const [salePrice, setSalePrice] = useState<string>('');

  // Calculate how many shares have been sold from each exercise
  const soldByExercise = useMemo(() => {
    const sold: Record<string, number> = {};
    for (const sale of simulatedSales) {
      // Match sales to exercises by grantId and acquisitionDate
      // Find the exercise this sale came from
      const matchingExercise = simulatedExercises.find(
        ex => ex.grantId === sale.grantId && ex.exerciseDate === sale.acquisitionDate
      );
      if (matchingExercise) {
        sold[matchingExercise.id] = (sold[matchingExercise.id] || 0) + sale.quantity;
      }
    }
    return sold;
  }, [simulatedExercises, simulatedSales]);

  // Build available lots from simulated exercises, minus what's been sold
  const availableLots = useMemo<ShareLot[]>(() => {
    const lots: ShareLot[] = [];

    // Add lots from simulated exercises
    simulatedExercises.forEach(ex => {
      const soldQuantity = soldByExercise[ex.id] || 0;
      const availableQuantity = ex.quantity - soldQuantity;

      // Only include if there are shares available to sell
      if (availableQuantity > 0) {
        lots.push({
          id: `sim-${ex.id}`,
          exerciseId: ex.id,
          grantId: ex.grantId,
          grantLabel: ex.grantLabel,
          acquisitionDate: ex.exerciseDate,
          totalQuantity: ex.quantity,
          availableQuantity,
          costBasis: ex.fmvAtExercise, // Cost basis = FMV at exercise
          currency: ex.currency,
          source: 'simulated_exercise',
        });
      }
    });

    // TODO: Add actual exercised shares from API if needed

    return lots;
  }, [simulatedExercises, soldByExercise]);

  const [preview, setPreview] = useState<SaleTaxResult | null>(null);

  // Filter lots to only show those acquired before the sale date
  const lotsAvailableByDate = useMemo(() => {
    if (!saleDate) return availableLots;
    const saleDateObj = new Date(saleDate);
    return availableLots.filter(lot => {
      const acquisitionDateObj = new Date(lot.acquisitionDate);
      return acquisitionDateObj <= saleDateObj;
    });
  }, [availableLots, saleDate]);

  const selectedLot = lotsAvailableByDate.find(l => l.id === selectedLotId);

  // Calculate preview using API
  useEffect(() => {
    const calculatePreview = async () => {
      if (!selectedLot || !quantity || !salePrice || !saleDate) {
        setPreview(null);
        return;
      }

      const qty = parseInt(quantity, 10);
      const price = parseFloat(salePrice);

      if (isNaN(qty) || isNaN(price) || qty <= 0) {
        setPreview(null);
        return;
      }

      try {
        const result = await apiClient.calculateSaleTax({
          quantity: qty,
          sale_price: price,
          cost_basis: selectedLot.costBasis,
          acquisition_date: selectedLot.acquisitionDate,
          sale_date: saleDate,
          marginal_rate: marginalRate,
        });
        setPreview(result);
      } catch (error) {
        console.error('Failed to calculate sale tax:', error);
        setPreview(null);
      }
    };

    // Debounce the API call
    const timeoutId = setTimeout(calculatePreview, 300);
    return () => clearTimeout(timeoutId);
  }, [selectedLot, quantity, salePrice, saleDate, marginalRate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedLot || !preview) return;

    const qty = parseInt(quantity, 10);
    const price = parseFloat(salePrice);

    const sale: Omit<SimulatedSale, 'id'> = {
      grantId: selectedLot.grantId,
      grantLabel: selectedLot.grantLabel,
      saleDate,
      quantity: qty,
      salePrice: price,
      costBasis: selectedLot.costBasis,
      currency: selectedLot.currency,
      acquisitionDate: selectedLot.acquisitionDate,
      totalProceeds: preview.total_proceeds,
      capitalGain: preview.capital_gain,
      holdingPeriodDays: preview.holding_period_days,
      taxableGain: preview.taxable_gain,
      estimatedTax: preview.estimated_tax,
    };

    onAddSale(sale);

    // Reset form
    setSelectedLotId('');
    setQuantity('');
    setSalePrice('');
  };

  // Format date for display
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Simulate Sale</CardTitle>
        <CardDescription>
          Model selling shares to see capital gains tax
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="saleDate">Sale Date</Label>
            <Input
              id="saleDate"
              type="date"
              value={saleDate}
              onChange={e => setSaleDate(e.target.value)}
              className="w-[180px]"
              required
            />
            <p className="text-xs text-muted-foreground">
              Select a date to see share lots available for sale
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="lot">Share Lot</Label>
            <Select value={selectedLotId} onValueChange={setSelectedLotId}>
              <SelectTrigger id="lot">
                <SelectValue placeholder="Select shares to sell" />
              </SelectTrigger>
              <SelectContent>
                {lotsAvailableByDate.length === 0 ? (
                  <SelectItem value="none" disabled>
                    No shares available for this date
                  </SelectItem>
                ) : (
                  lotsAvailableByDate.map(lot => (
                    <SelectItem key={lot.id} value={lot.id}>
                      {lot.grantLabel} - {lot.availableQuantity.toLocaleString()} shares @{' '}
                      {formatCurrency(lot.costBasis, lot.currency)} ({formatDate(lot.acquisitionDate)})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {selectedLot && (
              <div className="text-xs text-muted-foreground space-y-0.5">
                <p>
                  Available: {selectedLot.availableQuantity.toLocaleString()} of {selectedLot.totalQuantity.toLocaleString()} shares
                </p>
                <p>
                  Acquired: {formatDate(selectedLot.acquisitionDate)} | Cost basis:{' '}
                  {formatCurrency(selectedLot.costBasis, selectedLot.currency)}/share
                </p>
                <p>
                  Holding period:{' '}
                  {Math.floor(
                    (new Date(saleDate).getTime() -
                      new Date(selectedLot.acquisitionDate).getTime()) /
                      (1000 * 60 * 60 * 24)
                  )}{' '}
                  days
                </p>
                {selectedLot.totalQuantity - selectedLot.availableQuantity > 0 && (
                  <p className="text-orange-600 dark:text-orange-400">
                    ({(selectedLot.totalQuantity - selectedLot.availableQuantity).toLocaleString()} already sold in this scenario)
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="saleQuantity">Quantity</Label>
              <Input
                id="saleQuantity"
                type="number"
                min="1"
                max={selectedLot?.availableQuantity || undefined}
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                placeholder="# of shares"
                required
              />
              {selectedLot && (
                <p className="text-xs text-muted-foreground">
                  Max: {selectedLot.availableQuantity.toLocaleString()}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="salePrice">Sale Price</Label>
              <Input
                id="salePrice"
                type="number"
                min="0"
                step="0.01"
                value={salePrice}
                onChange={e => setSalePrice(e.target.value)}
                placeholder="Price/share"
                required
              />
              {selectedLot && (
                <p className="text-xs text-muted-foreground">
                  Cost: {formatCurrency(selectedLot.costBasis, selectedLot.currency)}
                </p>
              )}
            </div>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={!selectedLot || !preview}
          >
            <IconPlus className="h-4 w-4 mr-2" />
            Add Sale
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
