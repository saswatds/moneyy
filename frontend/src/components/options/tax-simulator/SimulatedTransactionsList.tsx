import { useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  IconTrash,
  IconChevronDown,
  IconChevronUp,
  IconArrowUpRight,
  IconArrowDownRight,
} from '@tabler/icons-react';
import type { SimulatedExercise, SimulatedSale } from './types';
import { formatCurrency } from '@/lib/currency';

interface SimulatedTransactionsListProps {
  exercises: SimulatedExercise[];
  sales: SimulatedSale[];
  onDeleteExercise: (exerciseId: string) => void;
  onDeleteSale: (saleId: string) => void;
}

export function SimulatedTransactionsList({
  exercises,
  sales,
  onDeleteExercise,
  onDeleteSale,
}: SimulatedTransactionsListProps) {
  const [expandedExercises, setExpandedExercises] = useState<Set<string>>(new Set());
  const [expandedSales, setExpandedSales] = useState<Set<string>>(new Set());

  // Sort exercises and sales by date
  const sortedExercises = useMemo(() =>
    [...exercises].sort((a, b) => new Date(a.exerciseDate).getTime() - new Date(b.exerciseDate).getTime()),
    [exercises]
  );

  const sortedSales = useMemo(() =>
    [...sales].sort((a, b) => new Date(a.saleDate).getTime() - new Date(b.saleDate).getTime()),
    [sales]
  );

  const toggleExercise = (id: string) => {
    setExpandedExercises(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSale = (id: string) => {
    setExpandedSales(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const hasTransactions = exercises.length > 0 || sales.length > 0;

  if (!hasTransactions) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Simulated Transactions</CardTitle>
          <CardDescription>
            Your simulated exercises and sales will appear here
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p>No simulated transactions yet.</p>
            <p className="text-sm mt-1">
              Add exercises or sales using the forms above.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Simulated Transactions</CardTitle>
        <CardDescription>
          {exercises.length} exercise{exercises.length !== 1 ? 's' : ''},{' '}
          {sales.length} sale{sales.length !== 1 ? 's' : ''}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Exercises */}
        {sortedExercises.map(exercise => {
          const isExpanded = expandedExercises.has(exercise.id);
          const year = new Date(exercise.exerciseDate).getFullYear();

          return (
            <div
              key={exercise.id}
              className="border rounded-lg overflow-hidden"
            >
              <div
                className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 cursor-pointer"
                onClick={() => toggleExercise(exercise.id)}
              >
                <div className="flex items-center gap-3">
                  <IconArrowUpRight className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <div>
                    <div className="font-medium text-sm">
                      Exercise: {exercise.grantLabel}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {exercise.quantity.toLocaleString()} shares @{' '}
                      {formatCurrency(exercise.fmvAtExercise, exercise.currency)} •{' '}
                      {formatDate(exercise.exerciseDate)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {year}
                  </Badge>
                  <div className="text-right">
                    <div className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                      Tax: {formatCurrency(exercise.estimatedTax, exercise.currency)}
                    </div>
                  </div>
                  {isExpanded ? (
                    <IconChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <IconChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="p-3 space-y-2 text-sm border-t">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-muted-foreground">Strike Price:</span>{' '}
                      {formatCurrency(exercise.strikePrice, exercise.currency)}
                    </div>
                    <div>
                      <span className="text-muted-foreground">FMV at Exercise:</span>{' '}
                      {formatCurrency(exercise.fmvAtExercise, exercise.currency)}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Exercise Cost:</span>{' '}
                      {formatCurrency(exercise.exerciseCost, exercise.currency)}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Taxable Benefit:</span>{' '}
                      {formatCurrency(exercise.taxableBenefit, exercise.currency)}
                    </div>
                    <div className="text-green-600 dark:text-green-400">
                      <span className="text-muted-foreground">Stock Option Deduction:</span>{' '}
                      -{formatCurrency(exercise.stockOptionDeduction, exercise.currency)}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Net Taxable:</span>{' '}
                      {formatCurrency(exercise.netTaxable, exercise.currency)}
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={e => {
                        e.stopPropagation();
                        onDeleteExercise(exercise.id);
                      }}
                    >
                      <IconTrash className="h-3 w-3 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Sales */}
        {sortedSales.map(sale => {
          const isExpanded = expandedSales.has(sale.id);
          const year = new Date(sale.saleDate).getFullYear();

          return (
            <div
              key={sale.id}
              className="border rounded-lg overflow-hidden"
            >
              <div
                className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 cursor-pointer"
                onClick={() => toggleSale(sale.id)}
              >
                <div className="flex items-center gap-3">
                  <IconArrowDownRight className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <div>
                    <div className="font-medium text-sm">
                      Sale: {sale.grantLabel}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {sale.quantity.toLocaleString()} shares @{' '}
                      {formatCurrency(sale.salePrice, sale.currency)} •{' '}
                      {formatDate(sale.saleDate)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {year}
                  </Badge>
                  <div className="text-right">
                    <div className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                      Tax: {formatCurrency(sale.estimatedTax, sale.currency)}
                    </div>
                  </div>
                  {isExpanded ? (
                    <IconChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <IconChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="p-3 space-y-2 text-sm border-t">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-muted-foreground">Sale Price:</span>{' '}
                      {formatCurrency(sale.salePrice, sale.currency)}/share
                    </div>
                    <div>
                      <span className="text-muted-foreground">Cost Basis:</span>{' '}
                      {formatCurrency(sale.costBasis, sale.currency)}/share
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total Proceeds:</span>{' '}
                      {formatCurrency(sale.totalProceeds, sale.currency)}
                    </div>
                    <div
                      className={
                        sale.capitalGain >= 0
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }
                    >
                      <span className="text-muted-foreground">Capital Gain:</span>{' '}
                      {formatCurrency(sale.capitalGain, sale.currency)}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Holding Period:</span>{' '}
                      {sale.holdingPeriodDays} days
                    </div>
                    <div>
                      <span className="text-muted-foreground">Taxable (50%):</span>{' '}
                      {formatCurrency(sale.taxableGain, sale.currency)}
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={e => {
                        e.stopPropagation();
                        onDeleteSale(sale.id);
                      }}
                    >
                      <IconTrash className="h-3 w-3 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
