import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import type { EquitySale, EquityGrantWithSummary, UpdateSaleRequest } from '@/lib/api-client';
import { useUpdateSale, useDeleteSale } from '@/hooks/use-options';
import { useExchangeRates } from '@/hooks/use-exchange-rates';
import { formatCurrency, convertCurrency } from '@/lib/currency';

interface SalesTableProps {
  sales: EquitySale[];
  grants: EquityGrantWithSummary[];
  accountId: string;
}

export function SalesTable({ sales, grants, accountId }: SalesTableProps) {
  const [editingSale, setEditingSale] = useState<EquitySale | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const { data: exchangeRates } = useExchangeRates();
  const deleteSale = useDeleteSale(accountId);

  const getGrantCurrency = (grantId?: string) => {
    if (!grantId) return 'USD';
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

  const handleEdit = (sale: EquitySale) => {
    setEditingSale(sale);
    setEditDialogOpen(true);
  };

  const handleDelete = async (saleId: string) => {
    if (window.confirm('Are you sure you want to delete this sale? This action cannot be undone.')) {
      await deleteSale.mutateAsync(saleId);
    }
  };

  if (sales.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No sales recorded yet. Record a sale when you sell shares.
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
                Sale Price
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                Proceeds
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                Cost Basis
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                Gain/Loss
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                Status
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {sales.map((sale) => {
              const currency = getGrantCurrency(sale.grant_id);
              return (
              <tr key={sale.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                <td className="px-4 py-4 text-sm">
                  {formatDate(sale.sale_date)}
                  <div className="text-xs text-muted-foreground">{currency}</div>
                </td>
                <td className="px-4 py-4 text-sm text-right">
                  {sale.quantity.toLocaleString()}
                </td>
                <td className="px-4 py-4 text-sm text-right">
                  <div>{formatCurrency(sale.sale_price, currency)}</div>
                  {currency !== 'CAD' && (
                    <div className="text-xs text-muted-foreground/70">{formatCADEquivalent(sale.sale_price, currency)}</div>
                  )}
                </td>
                <td className="px-4 py-4 text-sm text-right font-medium">
                  <div>{formatCurrency(sale.total_proceeds, currency)}</div>
                  {currency !== 'CAD' && (
                    <div className="text-xs text-muted-foreground/70 font-normal">{formatCADEquivalent(sale.total_proceeds, currency)}</div>
                  )}
                </td>
                <td className="px-4 py-4 text-sm text-right">
                  <div>{formatCurrency(sale.cost_basis, currency)}</div>
                  {currency !== 'CAD' && (
                    <div className="text-xs text-muted-foreground/70">{formatCADEquivalent(sale.cost_basis, currency)}</div>
                  )}
                </td>
                <td className={`px-4 py-4 text-sm text-right font-medium ${
                  sale.capital_gain >= 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  <div>{sale.capital_gain >= 0 ? '+' : ''}{formatCurrency(sale.capital_gain, currency)}</div>
                  {currency !== 'CAD' && (
                    <div className="text-xs opacity-70 font-normal">{sale.capital_gain >= 0 ? '+' : ''}{formatCADEquivalent(sale.capital_gain, currency)}</div>
                  )}
                </td>
                <td className="px-4 py-4 text-sm">
                  {sale.is_qualified !== undefined && (
                    <span className={`text-xs ${
                      sale.is_qualified
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-yellow-600 dark:text-yellow-400'
                    }`}>
                      {sale.is_qualified ? 'Qualified' : 'Non-qualified'}
                    </span>
                  )}
                  {sale.holding_period_days !== undefined && (
                    <div className="text-xs text-muted-foreground">
                      Held {sale.holding_period_days} days
                    </div>
                  )}
                </td>
                <td className="px-4 py-4 text-sm text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <IconDotsVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEdit(sale)}>
                        <IconEdit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDelete(sale.id)}
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
            <DialogTitle>Edit Sale</DialogTitle>
            <DialogDescription>
              Update the details of this sale record
            </DialogDescription>
          </DialogHeader>
          {editingSale && (
            <EditSaleForm
              sale={editingSale}
              accountId={accountId}
              currency={getGrantCurrency(editingSale.grant_id)}
              onSuccess={() => {
                setEditDialogOpen(false);
                setEditingSale(null);
              }}
              onCancel={() => {
                setEditDialogOpen(false);
                setEditingSale(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

interface EditSaleFormProps {
  sale: EquitySale;
  accountId: string;
  currency: string;
  onSuccess: () => void;
  onCancel: () => void;
}

function EditSaleForm({ sale, accountId, currency, onSuccess, onCancel }: EditSaleFormProps) {
  const updateSale = useUpdateSale(accountId);

  const [saleDate, setSaleDate] = useState(sale.sale_date.split('T')[0]);
  const [quantity, setQuantity] = useState(sale.quantity.toString());
  const [salePrice, setSalePrice] = useState(sale.sale_price.toString());
  const [costBasis, setCostBasis] = useState((sale.cost_basis / sale.quantity).toString());
  const [error, setError] = useState<string | null>(null);

  // Calculate preview values
  const qty = parseInt(quantity) || 0;
  const price = parseFloat(salePrice) || 0;
  const basis = parseFloat(costBasis) || 0;
  const totalProceeds = qty * price;
  const totalCostBasis = qty * basis;
  const capitalGain = totalProceeds - totalCostBasis;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const handleSubmit = async () => {
    setError(null);

    if (!saleDate || !quantity || !salePrice || !costBasis) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      const data: UpdateSaleRequest = {
        sale_date: saleDate,
        quantity: parseInt(quantity),
        sale_price: parseFloat(salePrice),
        cost_basis: totalCostBasis,
      };

      await updateSale.mutateAsync({ saleId: sale.id, data });
      onSuccess();
    } catch (err) {
      setError('Failed to update sale');
    }
  };

  return (
    <div className="space-y-4">
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
          />
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
          />
        </div>
        <div className="space-y-2">
          <Label>Cost Basis Per Share *</Label>
          <Input
            type="number"
            step="0.01"
            value={costBasis}
            onChange={(e) => setCostBasis(e.target.value)}
          />
        </div>
      </div>

      {/* Preview calculation */}
      {qty > 0 && (
        <div className="p-3 bg-muted rounded-lg space-y-1 text-sm">
          <div className="font-medium">Updated Summary</div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total Proceeds</span>
            <span className="text-green-600">{formatCurrency(totalProceeds)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Cost Basis</span>
            <span>{formatCurrency(totalCostBasis)}</span>
          </div>
          <div className="flex justify-between border-t pt-1 mt-1">
            <span className="text-muted-foreground">Capital Gain</span>
            <span className={capitalGain >= 0 ? 'text-green-600' : 'text-red-600'}>
              {formatCurrency(capitalGain)}
            </span>
          </div>
        </div>
      )}

      {error && (
        <div className="text-sm text-red-500">{error}</div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={updateSale.isPending}>
          {updateSale.isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
