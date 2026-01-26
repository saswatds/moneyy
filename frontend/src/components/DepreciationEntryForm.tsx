import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRecordDepreciation } from '@/hooks/use-assets';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { IconCalendar } from '@tabler/icons-react';
import { format } from 'date-fns';
import { Textarea } from '@/components/ui/textarea';

const formSchema = z.object({
  entry_date: z.date({ message: 'Entry date is required' }),
  current_value: z.coerce.number().min(0, 'Current value must be positive'),
  notes: z.string().max(500).optional(),
});

type FormValues = {
  entry_date: Date;
  current_value: number;
  notes?: string;
};

interface DepreciationEntryFormProps {
  accountId: string;
  purchasePrice?: number;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function DepreciationEntryForm({
  accountId,
  purchasePrice,
  onSuccess,
  onCancel
}: DepreciationEntryFormProps) {
  const recordDepreciation = useRecordDepreciation();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      entry_date: new Date(),
      current_value: purchasePrice || 0,
      notes: '',
    },
  });

  const onSubmit = async (data: FormValues) => {
    try {
      await recordDepreciation.mutateAsync({
        accountId,
        data: {
          account_id: accountId,
          entry_date: format(data.entry_date, 'yyyy-MM-dd'),
          current_value: data.current_value,
          notes: data.notes || '',
        },
      });
      form.reset();
      onSuccess?.();
    } catch (error) {
      console.error('Failed to record depreciation:', error);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="entry_date"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Entry Date</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      className="w-full pl-3 text-left font-normal"
                    >
                      {field.value ? (
                        format(field.value, 'PPP')
                      ) : (
                        <span>Pick a date</span>
                      )}
                      <IconCalendar className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) =>
                      date > new Date() || date < new Date('1900-01-01')
                    }
                    captionLayout="dropdown"
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="current_value"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Current Value</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Enter the current assessed value of the asset
              </FormDescription>
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
                <Textarea
                  placeholder="Add any notes about this depreciation entry"
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
            disabled={recordDepreciation.isPending}
            className="w-full"
          >
            {recordDepreciation.isPending ? 'Recording...' : 'Record Depreciation'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
