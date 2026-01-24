import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useState } from 'react';
import { useCreateHolding } from '@/hooks/use-holdings';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupButton,
} from '@/components/ui/input-group';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { IconChevronDown } from '@tabler/icons-react';

const formSchema = z.object({
  type: z.enum(['cash', 'stock', 'etf', 'mutual_fund', 'bond', 'crypto', 'option', 'other']),
  symbol: z.string().optional(),
  quantity: z.coerce.number().optional(),
  cost_basis: z.coerce.number().optional(),
  currency: z.string().optional(),
  amount: z.coerce.number().optional(),
  purchase_date: z.string().optional(),
  notes: z.string().max(500).optional(),
});

type FormValues = z.infer<typeof formSchema>;

const holdingTypes = [
  { value: 'cash', label: 'Cash', category: 'Cash' },
  { value: 'stock', label: 'Stock', category: 'Securities' },
  { value: 'etf', label: 'ETF', category: 'Securities' },
  { value: 'mutual_fund', label: 'Mutual Fund', category: 'Securities' },
  { value: 'bond', label: 'Bond', category: 'Securities' },
  { value: 'crypto', label: 'Cryptocurrency', category: 'Securities' },
  { value: 'option', label: 'Option', category: 'Securities' },
  { value: 'other', label: 'Other', category: 'Securities' },
];

const currencies = [
  { value: 'CAD', label: 'CAD' },
  { value: 'USD', label: 'USD' },
  { value: 'INR', label: 'INR' },
];

interface HoldingEntryFormProps {
  accountId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function HoldingEntryForm({ accountId, onSuccess, onCancel }: HoldingEntryFormProps) {
  const createHolding = useCreateHolding();
  const [selectedCurrency, setSelectedCurrency] = useState('CAD');

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: 'stock' as const,
      symbol: '',
      quantity: 0,
      cost_basis: 0,
      currency: 'CAD',
      amount: 0,
      purchase_date: new Date().toISOString().split('T')[0],
      notes: '',
    },
  });

  const selectedType = form.watch('type');
  const isCash = selectedType === 'cash';

  const onSubmit = async (data: FormValues) => {
    try {
      const payload: any = {
        account_id: accountId,
        type: data.type,
        notes: data.notes || '',
        purchase_date: data.purchase_date,
      };

      if (isCash) {
        payload.currency = selectedCurrency;
        payload.amount = data.amount;
      } else {
        payload.symbol = data.symbol;
        payload.quantity = data.quantity;
        payload.cost_basis = data.cost_basis;
      }

      await createHolding.mutateAsync(payload);
      form.reset();
      onSuccess?.();
    } catch (error) {
      console.error('Failed to create holding:', error);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Holding Type</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select holding type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                    Cash
                  </div>
                  {holdingTypes
                    .filter((t) => t.category === 'Cash')
                    .map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">
                    Securities
                  </div>
                  {holdingTypes
                    .filter((t) => t.category === 'Securities')
                    .map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {isCash ? (
          // Cash fields
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Amount</FormLabel>
                <FormControl>
                  <InputGroup>
                    <InputGroupAddon>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <InputGroupButton variant="ghost" className="!pr-1.5 text-sm font-medium">
                            {selectedCurrency} <IconChevronDown className="size-3 ml-0.5" />
                          </InputGroupButton>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          {currencies.map((curr) => (
                            <DropdownMenuItem
                              key={curr.value}
                              onClick={() => setSelectedCurrency(curr.value)}
                            >
                              {curr.label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </InputGroupAddon>
                    <InputGroupInput
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      {...field}
                      value={field.value as number}
                      className="!pl-0.5"
                    />
                  </InputGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : (
          // Security fields
          <>
            <FormField
              control={form.control}
              name="symbol"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Symbol</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., AAPL, VGRO, BTC"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.00000001"
                        placeholder="0"
                        {...field}
                        value={field.value as number}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cost_basis"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cost Basis</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                        value={field.value as number}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </>
        )}

        <FormField
          control={form.control}
          name="purchase_date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Purchase Date (Optional)</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (Optional)</FormLabel>
              <FormControl>
                <Input
                  placeholder="Add any notes about this holding"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-3 pt-2">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
            >
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            disabled={createHolding.isPending}
            className="w-full"
          >
            {createHolding.isPending ? 'Adding...' : 'Add Holding'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
