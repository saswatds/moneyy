import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { IconPlayerPlay, IconDotsVertical, IconEdit, IconTrash, IconCalendar } from '@tabler/icons-react';
import type { EquityGrantWithSummary } from '@/lib/api-client';
import { useExchangeRates } from '@/hooks/use-exchange-rates';
import { formatCurrency, convertCurrency } from '@/lib/currency';

interface GrantsTableProps {
  grants: EquityGrantWithSummary[];
  onExercise?: (grantId: string) => void;
  onEdit?: (grant: EquityGrantWithSummary) => void;
  onDelete?: (grantId: string) => void;
  onSetVesting?: (grant: EquityGrantWithSummary) => void;
}

export function GrantsTable({ grants, onExercise, onEdit, onDelete, onSetVesting }: GrantsTableProps) {
  const { data: exchangeRates } = useExchangeRates();

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

  const getGrantTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      iso: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      nso: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
      rsu: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      rsa: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    };
    return <Badge className={colors[type] || 'bg-gray-100'}>{type.toUpperCase()}</Badge>;
  };

  if (grants.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No grants found. Add your first equity grant to get started.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
              Grant
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
              Type
            </th>
            <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
              Shares
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
              Vesting Progress
            </th>
            <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
              Value
            </th>
            <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {grants.map((grant) => {
            const isOption = grant.grant_type === 'iso' || grant.grant_type === 'nso';
            const vestingPercent = grant.quantity > 0
              ? (grant.vested_quantity / grant.quantity) * 100
              : 0;
            const exercisableShares = grant.vested_quantity - grant.exercised_quantity;
            const grantCurrency = grant.currency || 'USD';

            return (
              <tr key={grant.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                <td className="px-4 py-4">
                  <div className="font-medium">{grant.company_name}</div>
                  <div className="text-sm text-muted-foreground">
                    {formatDate(grant.grant_date)}
                    {grant.grant_number && ` - #${grant.grant_number}`}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    {getGrantTypeBadge(grant.grant_type)}
                    <span className="text-xs text-muted-foreground">{grantCurrency}</span>
                  </div>
                  {isOption && grant.strike_price && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Strike: {formatCurrency(grant.strike_price, grantCurrency)}
                      {grantCurrency !== 'CAD' && (
                        <span className="ml-1 text-muted-foreground/70">
                          ({formatCADEquivalent(grant.strike_price, grantCurrency)})
                        </span>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-4 py-4 text-right">
                  <div className="font-medium">{grant.quantity.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">
                    {grant.vested_quantity.toLocaleString()} vested
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="w-32">
                    <Progress value={vestingPercent} className="h-2" />
                    <div className="text-xs text-muted-foreground mt-1">
                      {vestingPercent.toFixed(0)}% vested
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 text-right">
                  <div className="font-medium text-green-600 dark:text-green-400">
                    {formatCurrency(grant.vested_value, grantCurrency)}
                  </div>
                  {grantCurrency !== 'CAD' && grant.vested_value > 0 && (
                    <div className="text-xs text-muted-foreground/70">
                      {formatCADEquivalent(grant.vested_value, grantCurrency)}
                    </div>
                  )}
                  {grant.unvested_value > 0 && (
                    <div className="text-xs text-muted-foreground mt-1">
                      +{formatCurrency(grant.unvested_value, grantCurrency)} unvested
                      {grantCurrency !== 'CAD' && (
                        <span className="ml-1 text-muted-foreground/70">
                          ({formatCADEquivalent(grant.unvested_value, grantCurrency)})
                        </span>
                      )}
                    </div>
                  )}
                  {grant.intrinsic_value > 0 && isOption && (
                    <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                      {formatCurrency(grant.intrinsic_value, grantCurrency)} gain
                      {grantCurrency !== 'CAD' && (
                        <span className="ml-1 opacity-70">
                          ({formatCADEquivalent(grant.intrinsic_value, grantCurrency)})
                        </span>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-4 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {isOption && exercisableShares > 0 && onExercise && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onExercise(grant.id)}
                      >
                        <IconPlayerPlay className="h-4 w-4 mr-1" />
                        Exercise
                      </Button>
                    )}
                    {isOption && exercisableShares === 0 && grant.vested_quantity > 0 && (
                      <span className="text-xs text-muted-foreground">Fully exercised</span>
                    )}
                    {!isOption && (
                      <span className="text-xs text-muted-foreground">RSU/RSA</span>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <IconDotsVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {onEdit && (
                          <DropdownMenuItem onClick={() => onEdit(grant)}>
                            <IconEdit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                        )}
                        {onSetVesting && (
                          <DropdownMenuItem onClick={() => onSetVesting(grant)}>
                            <IconCalendar className="h-4 w-4 mr-2" />
                            Set Vesting
                          </DropdownMenuItem>
                        )}
                        {onDelete && (
                          <DropdownMenuItem
                            className="text-red-600 dark:text-red-400"
                            onClick={() => onDelete(grant.id)}
                          >
                            <IconTrash className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
