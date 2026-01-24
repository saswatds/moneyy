import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useState } from 'react';
import { useCreateBalance } from '@/hooks/use-balances';
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
  amount: z.coerce.number().min(0.01, 'Amount must be greater than 0'),
  date: z.string().min(1, 'Date is required'),
  notes: z.string().max(500).optional(),
});

type FormValues = z.infer<typeof formSchema>;

const currencies = [
  { value: 'CAD', label: 'CAD' },
  { value: 'USD', label: 'USD' },
  { value: 'INR', label: 'INR' },
];

interface BalanceEntryFormProps {
  accountId: string;
  currency: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function BalanceEntryForm({ accountId, currency, onSuccess, onCancel }: BalanceEntryFormProps) {
  const createBalance = useCreateBalance();
  const [selectedCurrency, setSelectedCurrency] = useState(currency);

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: 0,
      date: new Date().toISOString().split('T')[0],
      notes: '',
    },
  });

  const onSubmit = async (data: FormValues) => {
    try {
      await createBalance.mutateAsync({
        account_id: accountId,
        amount: data.amount,
        date: new Date(data.date).toISOString(),
        notes: data.notes || '',
      });
      form.reset();
      onSuccess?.();
    } catch (error) {
      console.error('Failed to create balance:', error);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 gap-4">
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

          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (Optional)</FormLabel>
              <FormControl>
                <Input
                  placeholder="Add any notes about this balance entry"
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
            disabled={createBalance.isPending}
            className="w-full"
          >
            {createBalance.isPending ? 'Adding...' : 'Add Balance'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
