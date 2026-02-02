import type { IncomeRecord } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { IconEdit, IconTrash } from '@tabler/icons-react';
import { Currency } from '@/components/ui/currency';

interface IncomeTableProps {
  records: IncomeRecord[];
  onEdit: (income: IncomeRecord) => void;
  onDelete: (income: IncomeRecord) => void;
}

const getCategoryBadgeColor = (category: string) => {
  const colors: Record<string, string> = {
    employment: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    investment: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    rental: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    business: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    other: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  };
  return colors[category] || colors.other;
};

const getFrequencyLabel = (frequency: string) => {
  switch (frequency) {
    case 'one_time':
      return 'One-Time';
    case 'monthly':
      return 'Monthly';
    case 'bi-weekly':
      return 'Bi-Weekly';
    case 'annually':
      return 'Annually';
    default:
      return frequency;
  }
};

const calculateAnnualAmount = (amount: number, frequency: string) => {
  switch (frequency) {
    case 'one_time':
      return amount;
    case 'monthly':
      return amount * 12;
    case 'bi-weekly':
      return amount * 26;
    case 'annually':
      return amount;
    default:
      return amount;
  }
};

export function IncomeTable({ records, onEdit, onDelete }: IncomeTableProps) {
  if (records.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          No income records found. Add your first income source to get started.
        </p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Source</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Frequency</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead className="text-right">Annual Total</TableHead>
          <TableHead className="text-center">Taxable</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {records.map((income) => (
          <TableRow key={income.id}>
            <TableCell>
              <div>
                <div className="font-medium">{income.source}</div>
                {income.description && (
                  <div className="text-sm text-muted-foreground mt-0.5">
                    {income.description}
                  </div>
                )}
              </div>
            </TableCell>
            <TableCell>
              <Badge
                variant="secondary"
                className={`capitalize ${getCategoryBadgeColor(income.category)}`}
              >
                {income.category}
              </Badge>
            </TableCell>
            <TableCell>{getFrequencyLabel(income.frequency)}</TableCell>
            <TableCell className="text-right">
              <div><Currency amount={income.amount} /></div>
              <div className="text-xs text-muted-foreground">{income.currency}</div>
            </TableCell>
            <TableCell className="text-right">
              <div><Currency amount={calculateAnnualAmount(income.amount, income.frequency)} /></div>
              <div className="text-xs text-muted-foreground">{income.currency}</div>
            </TableCell>
            <TableCell className="text-center">
              {income.is_taxable ? (
                <Badge variant="default" className="bg-positive">Yes</Badge>
              ) : (
                <Badge variant="secondary">No</Badge>
              )}
            </TableCell>
            <TableCell className="text-right">
              <div className="flex gap-1 justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  title="Edit income"
                  onClick={() => onEdit(income)}
                >
                  <IconEdit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                  title="Delete income"
                  onClick={() => onDelete(income)}
                >
                  <IconTrash className="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
