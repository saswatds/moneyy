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
import { useRecordSale, useCurrentFMV } from '@/hooks/use-options';
import { useExchangeRates } from '@/hooks/use-exchange-rates';
import { formatCurrency, convertCurrency } from '@/lib/currency';
import type { EquityGrantWithSummary, RecordSaleRequest } from '@/lib/api-client';

interface SaleFormProps {
  accountId: string;
  grants: EquityGrantWithSummary[];
  onSuccess: () => void;
  onCancel: () => void;
}

// Calculate how many shares are available to sell for a grant
function getSellableShares(grant: EquityGrantWithSummary): number {
  const isOption = grant.grant_type === 'iso' || grant.grant_type === 'nso';
  if (isOption) {
    // For options, can only sell exercised shares
    return grant.exercised_quantity;
  } else {
    // For RSU/RSA, can sell vested shares
    return grant.vested_quantity;
  }
}

export function SaleForm({ accountId, grants, onSuccess, onCancel }: SaleFormProps) {
  const recordSale = useRecordSale(accountId);
  const { data: currentFMV } = useCurrentFMV(accountId);
  const { data: exchangeRates } = useExchangeRates();

  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
  const [grantId, setGrantId] = useState<string>('');
  const [quantity, setQuantity] = useState('');
  const [salePrice, setSalePrice] = useState(currentFMV?.fmv_per_share?.toString() || '');
  const [costBasis, setCostBasis] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Filter grants to only show those with sellable shares
  const sellableGrants = grants.filter(g => getSellableShares(g) > 0);

  const selectedGrant = grantId ? grants.find(g => g.id === grantId) : undefined;
  const availableToSell = selectedGrant ? getSellableShares(selectedGrant) : 0;
  const isOption = selectedGrant && (selectedGrant.grant_type === 'iso' || selectedGrant.grant_type === 'nso');

  // Auto-calculate cost basis when grant is selected
  const handleGrantChange = (value: string) => {
    setGrantId(value);
    setQuantity(''); // Reset quantity when grant changes
    const grant = grants.find(g => g.id === value);
    if (grant) {
      // Cost basis depends on grant type
      if (grant.grant_type === 'iso' || grant.grant_type === 'nso') {
        // For options, cost basis is the strike price
        setCostBasis(grant.strike_price?.toString() || '0');
      } else {
        // For RSU/RSA, cost basis is FMV at grant (vest)
        setCostBasis(grant.fmv_at_grant.toString());
      }
    }
  };

  const handleSubmit = async () => {
    setError(null);

    if (!grantId) {
      setError('Please select a grant');
      return;
    }

    if (!saleDate || !quantity || !salePrice || !costBasis) {
      setError('Please fill in all required fields');
      return;
    }

    const qty = parseInt(quantity);
    if (qty > availableToSell) {
      setError(`Cannot sell more than ${availableToSell} shares available`);
      return;
    }

    try {
      const data: RecordSaleRequest = {
        account_id: accountId,
        grant_id: grantId,
        sale_date: saleDate,
        quantity: qty,
        sale_price: parseFloat(salePrice),
        cost_basis: parseFloat(costBasis),
        notes: notes || undefined,
      };

      await recordSale.mutateAsync(data);
      onSuccess();
    } catch (err) {
      setError('Failed to record sale');
    }
  };

  // Calculate preview values
  const qty = parseInt(quantity) || 0;
  const price = parseFloat(salePrice) || 0;
  const basis = parseFloat(costBasis) || 0;
  const totalProceeds = qty * price;
  const totalCostBasis = qty * basis;
  const capitalGain = totalProceeds - totalCostBasis;
  const grantCurrency = selectedGrant?.currency || 'USD';

  const formatCAD = (amount: number) => {
    if (grantCurrency === 'CAD') return null;
    const cadAmount = convertCurrency(amount, grantCurrency, 'CAD', exchangeRates);
    return formatCurrency(cadAmount, 'CAD');
  };

  if (sellableGrants.length === 0) {
    return (
      <div className="space-y-4">
        <div className="text-center py-8 text-muted-foreground">
          <p>No shares available to sell.</p>
          <p className="text-sm mt-2">
            For stock options (ISO/NSO), you must exercise them first before selling.
            For RSUs/RSAs, shares must be vested before selling.
          </p>
        </div>
        <div className="flex justify-end">
          <Button variant="outline" onClick={onCancel}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Select Grant *</Label>
        <Select value={grantId} onValueChange={handleGrantChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select a grant to sell from" />
          </SelectTrigger>
          <SelectContent>
            {sellableGrants.map(grant => {
              const sellable = getSellableShares(grant);
              const grantIsOption = grant.grant_type === 'iso' || grant.grant_type === 'nso';
              return (
                <SelectItem key={grant.id} value={grant.id}>
                  {grant.company_name} - {grant.grant_type.toUpperCase()} ({grant.currency || 'USD'}) - {sellable.toLocaleString()} {grantIsOption ? 'exercised' : 'vested'} shares
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        {selectedGrant && (
          <p className="text-xs text-muted-foreground">
            {isOption
              ? `${availableToSell.toLocaleString()} exercised shares available to sell`
              : `${availableToSell.toLocaleString()} vested shares available to sell`}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Sale Date *</Label>
          <Input
            type="date"
            value={saleDate}
            onChange={(e) => setSaleDate(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Number of Shares *</Label>
          <Input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder={availableToSell > 0 ? `Max: ${availableToSell}` : '0'}
            max={availableToSell}
          />
          {qty > availableToSell && availableToSell > 0 && (
            <p className="text-xs text-red-500">
              Cannot exceed {availableToSell} available shares
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Sale Price Per Share *</Label>
          <Input
            type="number"
            step="0.01"
            value={salePrice}
            onChange={(e) => setSalePrice(e.target.value)}
            placeholder="25.00"
          />
          <p className="text-xs text-muted-foreground">
            Price per share at time of sale
          </p>
        </div>

        <div className="space-y-2">
          <Label>Cost Basis Per Share *</Label>
          <Input
            type="number"
            step="0.01"
            value={costBasis}
            onChange={(e) => setCostBasis(e.target.value)}
            placeholder="10.00"
          />
          <p className="text-xs text-muted-foreground">
            {isOption
              ? 'Strike price paid when exercising'
              : 'FMV at vesting (taxed as income)'}
          </p>
        </div>
      </div>

      {/* Preview calculation */}
      {qty > 0 && qty <= availableToSell && (
        <div className="p-3 bg-muted rounded-lg space-y-1 text-sm">
          <div className="font-medium">Sale Summary ({grantCurrency})</div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total Proceeds ({qty} x {formatCurrency(price, grantCurrency)})</span>
            <div className="text-right">
              <div className="text-green-600">{formatCurrency(totalProceeds, grantCurrency)}</div>
              {grantCurrency !== 'CAD' && (
                <div className="text-xs text-green-600/70">{formatCAD(totalProceeds)}</div>
              )}
            </div>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Cost Basis ({qty} x {formatCurrency(basis, grantCurrency)})</span>
            <div className="text-right">
              <div>{formatCurrency(totalCostBasis, grantCurrency)}</div>
              {grantCurrency !== 'CAD' && (
                <div className="text-xs text-muted-foreground/70">{formatCAD(totalCostBasis)}</div>
              )}
            </div>
          </div>
          <div className="flex justify-between border-t pt-1 mt-1">
            <span className="text-muted-foreground">Capital Gain</span>
            <div className="text-right">
              <div className={capitalGain >= 0 ? 'text-green-600' : 'text-red-600'}>
                {formatCurrency(capitalGain, grantCurrency)}
              </div>
              {grantCurrency !== 'CAD' && (
                <div className={`text-xs ${capitalGain >= 0 ? 'text-green-600/70' : 'text-red-600/70'}`}>
                  {formatCAD(capitalGain)}
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Taxable (50% inclusion)</span>
            <div className="text-right">
              <div>{formatCurrency(capitalGain * 0.5, grantCurrency)}</div>
              {grantCurrency !== 'CAD' && (
                <div className="text-muted-foreground/70">{formatCAD(capitalGain * 0.5)}</div>
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
          placeholder="Optional notes about this sale..."
        />
      </div>

      {error && (
        <div className="text-sm text-red-500">{error}</div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={recordSale.isPending || !grantId || qty === 0 || qty > availableToSell}
        >
          {recordSale.isPending ? 'Recording...' : 'Record Sale'}
        </Button>
      </div>
    </div>
  );
}
