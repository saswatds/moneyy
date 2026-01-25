import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useCreateAccount } from '@/hooks/use-accounts';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { IconArrowLeft } from '@tabler/icons-react';

const accountTypes = [
  { value: 'checking', label: 'Checking Account', isAsset: true },
  { value: 'savings', label: 'Savings Account', isAsset: true },
  { value: 'cash', label: 'Cash', isAsset: true },
  { value: 'brokerage', label: 'Brokerage Account', isAsset: true },
  { value: 'tfsa', label: 'TFSA', isAsset: true },
  { value: 'rrsp', label: 'RRSP', isAsset: true },
  { value: 'crypto', label: 'Cryptocurrency', isAsset: true },
  { value: 'real_estate', label: 'Real Estate', isAsset: true },
  { value: 'vehicle', label: 'Vehicle', isAsset: true },
  { value: 'collectible', label: 'Collectible', isAsset: true },
  { value: 'credit_card', label: 'Credit Card', isAsset: false },
  { value: 'loan', label: 'Loan', isAsset: false },
  { value: 'mortgage', label: 'Mortgage', isAsset: false },
  { value: 'line_of_credit', label: 'Line of Credit', isAsset: false },
  { value: 'other', label: 'Other', isAsset: true },
];

const currencies = [
  { value: 'CAD', label: 'CAD - Canadian Dollar' },
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'INR', label: 'INR - Indian Rupee' },
];

const formSchema = z.object({
  name: z.string().min(1, 'Account name is required').max(100),
  type: z.string().min(1, 'Account type is required'),
  currency: z.enum(['CAD', 'USD', 'INR']),
  institution: z.string().max(100).optional(),
  is_asset: z.boolean().default(true),
});

type FormValues = z.infer<typeof formSchema>;

export function AccountNew() {
  const navigate = useNavigate();
  const createAccount = useCreateAccount();

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      type: '',
      currency: 'CAD' as const,
      institution: '',
      is_asset: true,
    },
  });

  const selectedType = form.watch('type');

  // Auto-update is_asset based on account type selection
  React.useEffect(() => {
    if (selectedType) {
      const accountType = accountTypes.find((t) => t.value === selectedType);
      if (accountType) {
        form.setValue('is_asset', accountType.isAsset);
      }
    }
  }, [selectedType, form]);

  const onSubmit = async (data: FormValues) => {
    try {
      await createAccount.mutateAsync(data);
      navigate('/accounts');
    } catch (error) {
      console.error('Failed to create account:', error);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/accounts')}
        >
          <IconArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create Account</h1>
          <p className="text-muted-foreground mt-2">
            Add a new financial account to track
          </p>
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Account Details</CardTitle>
          <CardDescription>
            Enter the information for your new account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., TD Checking Account" {...field} />
                    </FormControl>
                    <FormDescription>
                      A descriptive name for this account
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account Type</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select account type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <div className="py-1 px-2 text-xs font-semibold text-muted-foreground">
                          Assets
                        </div>
                        {accountTypes
                          .filter((t) => t.isAsset)
                          .map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        <div className="py-1 px-2 text-xs font-semibold text-muted-foreground border-t mt-1">
                          Liabilities
                        </div>
                        {accountTypes
                          .filter((t) => !t.isAsset)
                          .map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      The category of this financial account
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {currencies.map((currency) => (
                          <SelectItem key={currency.value} value={currency.value}>
                            {currency.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      The currency this account is denominated in
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="institution"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Institution (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., TD Bank, RBC, Wealthsimple"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      The financial institution holding this account
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="is_asset"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Asset Account</FormLabel>
                      <FormDescription>
                        Is this an asset (money you own) or a liability (money
                        you owe)?
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="flex gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/accounts')}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createAccount.isPending}
                  className="flex-1"
                >
                  {createAccount.isPending ? 'Creating...' : 'Create Account'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

// Fix React import
import * as React from 'react';
