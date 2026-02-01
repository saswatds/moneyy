import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { IconLoader2, IconAlertCircle, IconCheck } from '@tabler/icons-react';
import { useFetchTaxBrackets, useFetchTaxParams } from '@/hooks/use-api-keys';
import { useSaveIncomeTaxConfig } from '@/hooks/use-income';
import type { TransformedTaxBrackets, TransformedTaxParams, IncomeTaxBracket, FieldSources } from '@/lib/api-client';

interface FetchTaxBracketsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedYear: number;
}

// Supported countries and their regions
const COUNTRIES = [
  { value: 'CA', label: 'Canada' },
];

const REGIONS: Record<string, { value: string; label: string }[]> = {
  CA: [
    { value: 'ON', label: 'Ontario' },
    { value: 'BC', label: 'British Columbia' },
    { value: 'AB', label: 'Alberta' },
    { value: 'QC', label: 'Quebec' },
    { value: 'MB', label: 'Manitoba' },
    { value: 'SK', label: 'Saskatchewan' },
    { value: 'NS', label: 'Nova Scotia' },
    { value: 'NB', label: 'New Brunswick' },
    { value: 'NL', label: 'Newfoundland and Labrador' },
    { value: 'PE', label: 'Prince Edward Island' },
    { value: 'NT', label: 'Northwest Territories' },
    { value: 'YT', label: 'Yukon' },
    { value: 'NU', label: 'Nunavut' },
  ],
};

const formatPercent = (rate: number) => {
  return (rate * 100).toFixed(2) + '%';
};

const formatCurrency = (amount: number) => {
  if (amount === 0) return 'Unlimited';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
  }).format(amount);
};

export function FetchTaxBracketsDialog({
  open,
  onOpenChange,
  selectedYear,
}: FetchTaxBracketsDialogProps) {
  const [step, setStep] = useState<'select' | 'preview'>('select');
  const [country, setCountry] = useState('CA');
  const [region, setRegion] = useState('ON');
  const [year, setYear] = useState(selectedYear.toString());
  const [fetchedBrackets, setFetchedBrackets] = useState<TransformedTaxBrackets | null>(null);
  const [fetchedParams, setFetchedParams] = useState<TransformedTaxParams | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  const fetchTaxBrackets = useFetchTaxBrackets();
  const fetchTaxParams = useFetchTaxParams();
  const saveTaxConfig = useSaveIncomeTaxConfig();

  const handleFetch = async () => {
    setError(null);
    try {
      // Fetch both brackets and params in parallel
      const [brackets, params] = await Promise.all([
        fetchTaxBrackets.mutateAsync({
          country,
          year: parseInt(year),
          region,
        }),
        fetchTaxParams.mutateAsync({
          country,
          year: parseInt(year),
          region,
        }),
      ]);
      setFetchedBrackets(brackets);
      setFetchedParams(params);
      setStep('preview');
    } catch (err: any) {
      setError(err.message || 'Failed to fetch tax data');
    }
  };

  const handleApply = async () => {
    if (!fetchedBrackets) return;

    setError(null);
    try {
      // Build field sources to track which fields came from the API
      const fieldSources: FieldSources = {
        federal_brackets: 'api',
        provincial_brackets: 'api',
      };

      // Add param field sources if params were fetched
      if (fetchedParams) {
        fieldSources.cpp_rate = 'api';
        fieldSources.cpp_max_pensionable_earnings = 'api';
        fieldSources.cpp_basic_exemption = 'api';
        fieldSources.ei_rate = 'api';
        fieldSources.ei_max_insurable_earnings = 'api';
        fieldSources.basic_personal_amount = 'api';
      }

      await saveTaxConfig.mutateAsync({
        tax_year: fetchedBrackets.year,
        province: fetchedBrackets.region,
        federal_brackets: fetchedBrackets.federal_brackets,
        provincial_brackets: fetchedBrackets.provincial_brackets,
        field_sources: fieldSources,
        // Include tax params if fetched
        ...(fetchedParams && {
          cpp_rate: fetchedParams.cpp_rate,
          cpp_max_pensionable_earnings: fetchedParams.cpp_max_pensionable_earnings,
          cpp_basic_exemption: fetchedParams.cpp_basic_exemption,
          ei_rate: fetchedParams.ei_rate,
          ei_max_insurable_earnings: fetchedParams.ei_max_insurable_earnings,
          basic_personal_amount: fetchedParams.basic_personal_amount,
        }),
      });
      setApplied(true);
    } catch (err: any) {
      setError(err.message || 'Failed to apply tax configuration');
    }
  };

  const handleClose = () => {
    // Reset state when closing
    setStep('select');
    setFetchedBrackets(null);
    setFetchedParams(null);
    setError(null);
    setApplied(false);
    onOpenChange(false);
  };

  const handleBack = () => {
    setStep('select');
    setFetchedBrackets(null);
    setFetchedParams(null);
    setError(null);
    setApplied(false);
  };

  // Generate year options (current year and next 2 years, plus previous 2 years)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  const availableRegions = REGIONS[country] || [];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 'select' ? 'Fetch Tax Configuration' : 'Preview Tax Configuration'}
          </DialogTitle>
          <DialogDescription>
            {step === 'select'
              ? 'Select your country, province/region, and year to fetch the latest tax brackets and parameters from the Moneyy API.'
              : `Review the tax configuration for ${fetchedBrackets?.region}, ${fetchedBrackets?.country} (${fetchedBrackets?.year}) before applying.`}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <IconAlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {applied && (
          <Alert>
            <IconCheck className="h-4 w-4" />
            <AlertDescription>
              Tax configuration has been applied successfully. The tax calculations will be updated.
            </AlertDescription>
          </Alert>
        )}

        {step === 'select' && (
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Select value={country} onValueChange={setCountry}>
                  <SelectTrigger id="country">
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="region">Province/Region</Label>
                <Select value={region} onValueChange={setRegion}>
                  <SelectTrigger id="region">
                    <SelectValue placeholder="Select region" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRegions.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="year">Tax Year</Label>
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger id="year">
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((y) => (
                      <SelectItem key={y} value={y.toString()}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {step === 'preview' && fetchedBrackets && (
          <div className="space-y-6 py-4">
            {fetchedBrackets.federal_brackets.length === 0 && fetchedBrackets.provincial_brackets.length === 0 ? (
              <Alert>
                <IconAlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No tax bracket data available for {fetchedBrackets.region}, {fetchedBrackets.country} ({fetchedBrackets.year}).
                  The data may not be available yet for this year. Try selecting a different year.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                {/* Federal Brackets */}
                <div className="space-y-2">
                  <h4 className="font-medium">Federal Tax Brackets</h4>
                  {fetchedBrackets.federal_brackets.length > 0 ? (
                    <BracketsTable brackets={fetchedBrackets.federal_brackets} />
                  ) : (
                    <p className="text-sm text-muted-foreground">No federal brackets available</p>
                  )}
                </div>

                {/* Provincial Brackets */}
                <div className="space-y-2">
                  <h4 className="font-medium">Provincial Tax Brackets ({fetchedBrackets.region})</h4>
                  {fetchedBrackets.provincial_brackets.length > 0 ? (
                    <BracketsTable brackets={fetchedBrackets.provincial_brackets} />
                  ) : (
                    <p className="text-sm text-muted-foreground">No provincial brackets available</p>
                  )}
                </div>

                {/* Tax Parameters */}
                {fetchedParams && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Tax Parameters</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">CPP Rate:</span>
                          <span className="font-medium">{(fetchedParams.cpp_rate * 100).toFixed(2)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">CPP Max Earnings:</span>
                          <span className="font-medium">{formatCurrency(fetchedParams.cpp_max_pensionable_earnings)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">CPP Exemption:</span>
                          <span className="font-medium">{formatCurrency(fetchedParams.cpp_basic_exemption)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Basic Personal Amount:</span>
                          <span className="font-medium">{formatCurrency(fetchedParams.basic_personal_amount)}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">EI Rate:</span>
                          <span className="font-medium">{(fetchedParams.ei_rate * 100).toFixed(3)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">EI Max Earnings:</span>
                          <span className="font-medium">{formatCurrency(fetchedParams.ei_max_insurable_earnings)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">RRSP Limit:</span>
                          <span className="font-medium">{formatCurrency(fetchedParams.rrsp_limit)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">TFSA Limit:</span>
                          <span className="font-medium">{formatCurrency(fetchedParams.tfsa_limit)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <DialogFooter>
          {step === 'select' ? (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleFetch} disabled={fetchTaxBrackets.isPending || fetchTaxParams.isPending}>
                {(fetchTaxBrackets.isPending || fetchTaxParams.isPending) ? (
                  <>
                    <IconLoader2 className="h-4 w-4 mr-2 animate-spin" />
                    Fetching...
                  </>
                ) : (
                  'Fetch Tax Data'
                )}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleBack} disabled={applied}>
                Back
              </Button>
              {applied ? (
                <Button onClick={handleClose}>
                  Done
                </Button>
              ) : (
                <Button onClick={handleApply} disabled={saveTaxConfig.isPending}>
                  {saveTaxConfig.isPending ? (
                    <>
                      <IconLoader2 className="h-4 w-4 mr-2 animate-spin" />
                      Applying...
                    </>
                  ) : (
                    'Apply Configuration'
                  )}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BracketsTable({ brackets }: { brackets: IncomeTaxBracket[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Income Up To</TableHead>
          <TableHead className="text-right">Tax Rate</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {brackets.map((bracket, index) => (
          <TableRow key={index}>
            <TableCell>{formatCurrency(bracket.up_to_income)}</TableCell>
            <TableCell className="text-right font-medium">
              {formatPercent(bracket.rate)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
