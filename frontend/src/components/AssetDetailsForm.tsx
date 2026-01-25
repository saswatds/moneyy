import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useCreateAssetDetails } from '@/hooks/use-assets';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  asset_type: z.enum(['real_estate', 'vehicle', 'collectible', 'equipment']),
  purchase_price: z.coerce.number().positive('Purchase price must be positive'),
  purchase_date: z.date(),
  depreciation_method: z.enum(['straight_line', 'declining_balance', 'manual']),
  useful_life_years: z.coerce.number().positive().optional(),
  salvage_value: z.coerce.number().min(0).optional(),
  depreciation_rate: z.coerce.number().min(0).max(1).optional(),
  notes: z.string().max(1000).optional(),
  // Real Estate fields
  address: z.string().optional(),
  city: z.string().optional(),
  property_type: z.string().optional(),
  square_footage: z.coerce.number().positive().optional(),
  year_built: z.coerce.number().positive().optional(),
  // Vehicle fields
  make: z.string().optional(),
  model: z.string().optional(),
  year: z.coerce.number().positive().optional(),
  vin: z.string().optional(),
  mileage: z.coerce.number().min(0).optional(),
  license_plate: z.string().optional(),
  // Collectible fields
  category: z.string().optional(),
  description: z.string().optional(),
  condition: z.string().optional(),
  certification: z.string().optional(),
  // Equipment fields
  equipment_category: z.string().optional(),
  equipment_description: z.string().optional(),
  serial_number: z.string().optional(),
  equipment_condition: z.string().optional(),
}).refine(
  (data) => {
    if (data.depreciation_method === 'straight_line') {
      return data.useful_life_years !== undefined && data.useful_life_years > 0;
    }
    return true;
  },
  {
    message: 'Useful life years is required for straight-line depreciation',
    path: ['useful_life_years'],
  }
).refine(
  (data) => {
    if (data.depreciation_method === 'declining_balance') {
      return data.depreciation_rate !== undefined && data.depreciation_rate > 0 && data.depreciation_rate < 1;
    }
    return true;
  },
  {
    message: 'Depreciation rate is required for declining balance method (between 0 and 1)',
    path: ['depreciation_rate'],
  }
);

type FormValues = z.infer<typeof formSchema>;

const assetTypes = [
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'collectible', label: 'Collectible' },
  { value: 'equipment', label: 'Equipment' },
];

const depreciationMethods = [
  { value: 'straight_line', label: 'Straight-Line', description: 'Equal depreciation each year' },
  { value: 'declining_balance', label: 'Declining Balance', description: 'Percentage-based depreciation' },
  { value: 'manual', label: 'Manual', description: 'Record depreciation manually' },
];

const propertyTypes = [
  'Single Family Home',
  'Condo/Apartment',
  'Townhouse',
  'Multi-Family',
  'Commercial',
  'Land',
  'Other',
];

const conditions = ['Mint', 'Excellent', 'Good', 'Fair', 'Poor'];

interface AssetDetailsFormProps {
  accountId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function AssetDetailsForm({ accountId, onSuccess, onCancel }: AssetDetailsFormProps) {
  const createAsset = useCreateAssetDetails();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      asset_type: 'real_estate',
      purchase_price: 0,
      purchase_date: new Date(),
      depreciation_method: 'straight_line',
      salvage_value: 0,
      notes: '',
    },
  });

  const selectedAssetType = form.watch('asset_type');
  const selectedDepreciationMethod = form.watch('depreciation_method');

  const onSubmit = async (data: FormValues) => {
    try {
      // Build type_specific_data based on asset type
      const typeSpecificData: Record<string, any> = {};

      if (data.asset_type === 'real_estate') {
        if (data.address) typeSpecificData.address = data.address;
        if (data.city) typeSpecificData.city = data.city;
        if (data.property_type) typeSpecificData.property_type = data.property_type;
        if (data.square_footage) typeSpecificData.square_footage = data.square_footage;
        if (data.year_built) typeSpecificData.year_built = data.year_built;
      } else if (data.asset_type === 'vehicle') {
        if (data.make) typeSpecificData.make = data.make;
        if (data.model) typeSpecificData.model = data.model;
        if (data.year) typeSpecificData.year = data.year;
        if (data.vin) typeSpecificData.vin = data.vin;
        if (data.mileage !== undefined) typeSpecificData.mileage = data.mileage;
        if (data.license_plate) typeSpecificData.license_plate = data.license_plate;
      } else if (data.asset_type === 'collectible') {
        if (data.category) typeSpecificData.category = data.category;
        if (data.description) typeSpecificData.description = data.description;
        if (data.condition) typeSpecificData.condition = data.condition;
        if (data.certification) typeSpecificData.certification = data.certification;
      } else if (data.asset_type === 'equipment') {
        if (data.equipment_category) typeSpecificData.category = data.equipment_category;
        if (data.equipment_description) typeSpecificData.description = data.equipment_description;
        if (data.serial_number) typeSpecificData.serial_number = data.serial_number;
        if (data.equipment_condition) typeSpecificData.condition = data.equipment_condition;
      }

      const payload = {
        account_id: accountId,
        asset_type: data.asset_type,
        purchase_price: data.purchase_price,
        purchase_date: format(data.purchase_date, 'yyyy-MM-dd'),
        depreciation_method: data.depreciation_method,
        useful_life_years: data.useful_life_years,
        salvage_value: data.salvage_value || 0,
        depreciation_rate: data.depreciation_rate,
        type_specific_data: Object.keys(typeSpecificData).length > 0 ? typeSpecificData : undefined,
        notes: data.notes || '',
      };

      await createAsset.mutateAsync({ accountId, data: payload });
      form.reset();
      onSuccess?.();
    } catch (error) {
      console.error('Failed to create asset:', error);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Core Asset Fields */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Asset Information</h3>

          <FormField
            control={form.control}
            name="asset_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Asset Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select asset type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {assetTypes.map((type) => (
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

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="purchase_price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Purchase Price</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="purchase_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Purchase Date</FormLabel>
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
          </div>
        </div>

        {/* Depreciation Configuration */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Depreciation Settings</h3>

          <FormField
            control={form.control}
            name="depreciation_method"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Depreciation Method</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select depreciation method" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {depreciationMethods.map((method) => (
                      <SelectItem key={method.value} value={method.value}>
                        <div className="flex flex-col">
                          <span>{method.label}</span>
                          <span className="text-xs text-muted-foreground">{method.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {selectedDepreciationMethod === 'straight_line' && (
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="useful_life_years"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Useful Life (Years)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="e.g., 25"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Expected lifespan of the asset
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="salvage_value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Salvage Value</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Expected value at end of life
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}

          {selectedDepreciationMethod === 'declining_balance' && (
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="depreciation_rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Depreciation Rate</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="e.g., 0.20 for 20%"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Annual depreciation rate (0-1)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="salvage_value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Salvage Value (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Minimum value threshold
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}
        </div>

        {/* Type-Specific Fields */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">
            {selectedAssetType === 'real_estate' && 'Property Details'}
            {selectedAssetType === 'vehicle' && 'Vehicle Details'}
            {selectedAssetType === 'collectible' && 'Collectible Details'}
            {selectedAssetType === 'equipment' && 'Equipment Details'}
          </h3>

          {selectedAssetType === 'real_estate' && (
            <>
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input placeholder="123 Main St" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input placeholder="City" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="property_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Property Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {propertyTypes.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="square_footage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Square Footage</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g., 2000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="year_built"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Year Built</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g., 2010" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </>
          )}

          {selectedAssetType === 'vehicle' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="make"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Make</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Toyota" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="model"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Model</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Camry" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="year"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Year</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g., 2020" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="mileage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mileage</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g., 50000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="vin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>VIN</FormLabel>
                      <FormControl>
                        <Input placeholder="Vehicle identification number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="license_plate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>License Plate</FormLabel>
                      <FormControl>
                        <Input placeholder="License plate number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </>
          )}

          {selectedAssetType === 'collectible' && (
            <>
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Art, Coins, Stamps" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Detailed description" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="condition"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Condition</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select condition" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {conditions.map((cond) => (
                            <SelectItem key={cond} value={cond}>
                              {cond}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="certification"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Certification</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., PSA 10, CGC 9.8" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </>
          )}

          {selectedAssetType === 'equipment' && (
            <>
              <FormField
                control={form.control}
                name="equipment_category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Computer, Machinery, Tools" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="equipment_description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Detailed description" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="serial_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Serial Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Serial number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="equipment_condition"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Condition</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select condition" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {conditions.map((cond) => (
                            <SelectItem key={cond} value={cond}>
                              {cond}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </>
          )}
        </div>

        {/* Notes */}
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (Optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Add any additional notes about this asset"
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
            disabled={createAsset.isPending}
            className="w-full"
          >
            {createAsset.isPending ? 'Creating...' : 'Create Asset'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
