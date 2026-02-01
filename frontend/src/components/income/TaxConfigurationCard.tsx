import { useState, useEffect } from 'react';
import { useIncomeTaxConfig, useSaveIncomeTaxConfig } from '@/hooks/use-income';
import { useAPIKeyStatus, useFetchTaxBrackets } from '@/hooks/use-api-keys';
import type { IncomeTaxBracket } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { IconLoader2, IconDownload, IconPlus, IconTrash } from '@tabler/icons-react';

interface TaxConfigurationCardProps {
  selectedYear: number;
}

const PROVINCES = [
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
];

export function TaxConfigurationCard({ selectedYear }: TaxConfigurationCardProps) {
  const { data: taxConfig, isLoading } = useIncomeTaxConfig(selectedYear);
  const { data: apiKeyStatus } = useAPIKeyStatus('moneyy');
  const saveTaxConfig = useSaveIncomeTaxConfig();
  const fetchTaxBrackets = useFetchTaxBrackets();

  const [province, setProvince] = useState(taxConfig?.province || 'ON');
  const [federalBrackets, setFederalBrackets] = useState<IncomeTaxBracket[]>(taxConfig?.federal_brackets || []);
  const [provincialBrackets, setProvincialBrackets] = useState<IncomeTaxBracket[]>(taxConfig?.provincial_brackets || []);
  const [cppRate, setCppRate] = useState(taxConfig?.cpp_rate || 0);
  const [cppMaxPensionable, setCppMaxPensionable] = useState(taxConfig?.cpp_max_pensionable_earnings || 0);
  const [cppBasicExemption, setCppBasicExemption] = useState(taxConfig?.cpp_basic_exemption || 0);
  const [eiRate, setEiRate] = useState(taxConfig?.ei_rate || 0);
  const [eiMaxInsurable, setEiMaxInsurable] = useState(taxConfig?.ei_max_insurable_earnings || 0);
  const [basicPersonalAmount, setBasicPersonalAmount] = useState(taxConfig?.basic_personal_amount || 0);
  const [hasChanges, setHasChanges] = useState(false);

  const isMoneyApiConfigured = apiKeyStatus?.is_configured ?? false;

  // Sync state when taxConfig loads
  useEffect(() => {
    if (taxConfig) {
      setProvince(taxConfig.province);
      setFederalBrackets(taxConfig.federal_brackets);
      setProvincialBrackets(taxConfig.provincial_brackets);
      setCppRate(taxConfig.cpp_rate);
      setCppMaxPensionable(taxConfig.cpp_max_pensionable_earnings);
      setCppBasicExemption(taxConfig.cpp_basic_exemption);
      setEiRate(taxConfig.ei_rate);
      setEiMaxInsurable(taxConfig.ei_max_insurable_earnings);
      setBasicPersonalAmount(taxConfig.basic_personal_amount);
      setHasChanges(false);
    }
  }, [taxConfig]);

  const handleSave = async () => {
    try {
      await saveTaxConfig.mutateAsync({
        tax_year: selectedYear,
        province,
        federal_brackets: federalBrackets,
        provincial_brackets: provincialBrackets,
        cpp_rate: cppRate,
        cpp_max_pensionable_earnings: cppMaxPensionable,
        cpp_basic_exemption: cppBasicExemption,
        ei_rate: eiRate,
        ei_max_insurable_earnings: eiMaxInsurable,
        basic_personal_amount: basicPersonalAmount,
      });
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save tax config:', error);
    }
  };

  const updateBracket = (
    brackets: IncomeTaxBracket[],
    setBrackets: (b: IncomeTaxBracket[]) => void,
    index: number,
    field: 'up_to_income' | 'rate',
    value: string
  ) => {
    const newBrackets = [...brackets];
    if (field === 'up_to_income') {
      newBrackets[index] = { ...newBrackets[index], up_to_income: parseFloat(value) || 0 };
    } else {
      newBrackets[index] = { ...newBrackets[index], rate: parseFloat(value) / 100 || 0 };
    }
    setBrackets(newBrackets);
    setHasChanges(true);
  };

  const addBracket = (
    brackets: IncomeTaxBracket[],
    setBrackets: (b: IncomeTaxBracket[]) => void
  ) => {
    const lastBracket = brackets[brackets.length - 1];
    if (lastBracket?.up_to_income === 0) {
      // Insert before the unlimited bracket
      setBrackets([...brackets.slice(0, -1), { up_to_income: 50000, rate: 0.15 }, lastBracket]);
    } else {
      setBrackets([...brackets, { up_to_income: 0, rate: 0.15 }]);
    }
    setHasChanges(true);
  };

  const removeBracket = (
    brackets: IncomeTaxBracket[],
    setBrackets: (b: IncomeTaxBracket[]) => void,
    index: number
  ) => {
    setBrackets(brackets.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <IconLoader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Province</Label>
          <Select
            value={province}
            onValueChange={(v) => {
              setProvince(v);
              setHasChanges(true);
            }}
          >
            <SelectTrigger className="w-[180px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROVINCES.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          {isMoneyApiConfigured && (
            <Button
              variant="outline"
              size="sm"
              disabled={fetchTaxBrackets.isPending}
              onClick={() => {
                fetchTaxBrackets.mutate(
                  { country: 'CA', year: selectedYear, region: province },
                  {
                    onSuccess: (data) => {
                      if (data.federal_brackets?.length) {
                        setFederalBrackets(data.federal_brackets);
                      }
                      if (data.provincial_brackets?.length) {
                        setProvincialBrackets(data.provincial_brackets);
                      }
                      setHasChanges(true);
                    },
                  }
                );
              }}
            >
              {fetchTaxBrackets.isPending ? (
                <IconLoader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <IconDownload className="h-4 w-4 mr-1" />
              )}
              Fetch
            </Button>
          )}
          {hasChanges && (
            <Button size="sm" onClick={handleSave} disabled={saveTaxConfig.isPending}>
              {saveTaxConfig.isPending ? (
                <IconLoader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Save'
              )}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Tax Brackets Card */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Tax Brackets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
            {/* Federal */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Federal</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => addBracket(federalBrackets, setFederalBrackets)}
                >
                  <IconPlus className="h-3 w-3" />
                </Button>
              </div>
              <div className="space-y-1">
                {federalBrackets.map((bracket, idx) => (
                  <div key={idx} className="flex items-center gap-1">
                    <Input
                      type="number"
                      min={0}
                      step={1000}
                      value={bracket.up_to_income === 0 ? '' : bracket.up_to_income}
                      onChange={(e) => updateBracket(federalBrackets, setFederalBrackets, idx, 'up_to_income', e.target.value)}
                      placeholder={bracket.up_to_income === 0 ? '∞' : 'Up to $'}
                      disabled={bracket.up_to_income === 0}
                      className="h-7 text-xs flex-1"
                    />
                    <div className="relative w-16">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        value={Math.round(bracket.rate * 10000) / 100}
                        onChange={(e) => updateBracket(federalBrackets, setFederalBrackets, idx, 'rate', e.target.value)}
                        className="h-7 text-xs pr-4"
                      />
                      <span className="absolute right-1 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                    </div>
                    {federalBrackets.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => removeBracket(federalBrackets, setFederalBrackets, idx)}
                      >
                        <IconTrash className="h-3 w-3 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Provincial */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Provincial ({province})</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => addBracket(provincialBrackets, setProvincialBrackets)}
                >
                  <IconPlus className="h-3 w-3" />
                </Button>
              </div>
              <div className="space-y-1">
                {provincialBrackets.map((bracket, idx) => (
                  <div key={idx} className="flex items-center gap-1">
                    <Input
                      type="number"
                      min={0}
                      step={1000}
                      value={bracket.up_to_income === 0 ? '' : bracket.up_to_income}
                      onChange={(e) => updateBracket(provincialBrackets, setProvincialBrackets, idx, 'up_to_income', e.target.value)}
                      placeholder={bracket.up_to_income === 0 ? '∞' : 'Up to $'}
                      disabled={bracket.up_to_income === 0}
                      className="h-7 text-xs flex-1"
                    />
                    <div className="relative w-16">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        value={Math.round(bracket.rate * 10000) / 100}
                        onChange={(e) => updateBracket(provincialBrackets, setProvincialBrackets, idx, 'rate', e.target.value)}
                        className="h-7 text-xs pr-4"
                      />
                      <span className="absolute right-1 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                    </div>
                    {provincialBrackets.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => removeBracket(provincialBrackets, setProvincialBrackets, idx)}
                      >
                        <IconTrash className="h-3 w-3 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          </CardContent>
        </Card>

        {/* Other Tax Parameters Card */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Other Parameters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">CPP Rate (%)</Label>
              <div className="relative">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={Math.round(cppRate * 10000) / 100}
                  onChange={(e) => {
                    setCppRate(parseFloat(e.target.value) / 100 || 0);
                    setHasChanges(true);
                  }}
                  className="h-8 text-sm pr-6"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">CPP Max Pensionable</Label>
              <div className="relative">
                <Input
                  type="number"
                  min={0}
                  step={1000}
                  value={cppMaxPensionable || ''}
                  onChange={(e) => {
                    setCppMaxPensionable(parseFloat(e.target.value) || 0);
                    setHasChanges(true);
                  }}
                  className="h-8 text-sm pl-6"
                />
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">CPP Basic Exemption</Label>
              <div className="relative">
                <Input
                  type="number"
                  min={0}
                  step={100}
                  value={cppBasicExemption || ''}
                  onChange={(e) => {
                    setCppBasicExemption(parseFloat(e.target.value) || 0);
                    setHasChanges(true);
                  }}
                  className="h-8 text-sm pl-6"
                />
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">EI Rate (%)</Label>
              <div className="relative">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={Math.round(eiRate * 10000) / 100}
                  onChange={(e) => {
                    setEiRate(parseFloat(e.target.value) / 100 || 0);
                    setHasChanges(true);
                  }}
                  className="h-8 text-sm pr-6"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">EI Max Insurable</Label>
              <div className="relative">
                <Input
                  type="number"
                  min={0}
                  step={1000}
                  value={eiMaxInsurable || ''}
                  onChange={(e) => {
                    setEiMaxInsurable(parseFloat(e.target.value) || 0);
                    setHasChanges(true);
                  }}
                  className="h-8 text-sm pl-6"
                />
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Basic Personal Amount</Label>
              <div className="relative">
                <Input
                  type="number"
                  min={0}
                  step={1000}
                  value={basicPersonalAmount || ''}
                  onChange={(e) => {
                    setBasicPersonalAmount(parseFloat(e.target.value) || 0);
                    setHasChanges(true);
                  }}
                  className="h-8 text-sm pl-6"
                />
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
