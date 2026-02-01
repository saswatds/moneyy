import { useState } from 'react';
import { useIncomeTaxConfig, useSaveIncomeTaxConfig } from '@/hooks/use-income';
import { useAPIKeyStatus } from '@/hooks/use-api-keys';
import type { IncomeTaxBracket } from '@/lib/api-client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { IconEdit, IconLoader2, IconDownload, IconPlus, IconTrash } from '@tabler/icons-react';
import { FetchTaxBracketsDialog } from './FetchTaxBracketsDialog';

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

const formatPercent = (rate: number) => {
  return (rate * 100).toFixed(2) + '%';
};

const formatCurrency = (amount: number) => {
  if (amount === 0) return 'Unlimited';
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
  }).format(amount);
};

export function TaxConfigurationCard({ selectedYear }: TaxConfigurationCardProps) {
  const { data: taxConfig, isLoading } = useIncomeTaxConfig(selectedYear);
  const { data: apiKeyStatus } = useAPIKeyStatus('moneyy');
  const saveTaxConfig = useSaveIncomeTaxConfig();

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [fetchDialogOpen, setFetchDialogOpen] = useState(false);
  const [editProvince, setEditProvince] = useState('');
  const [editFederalBrackets, setEditFederalBrackets] = useState<IncomeTaxBracket[]>([]);
  const [editProvincialBrackets, setEditProvincialBrackets] = useState<IncomeTaxBracket[]>([]);

  const isMoneyApiConfigured = apiKeyStatus?.is_configured ?? false;

  const handleOpenEdit = () => {
    if (taxConfig) {
      setEditProvince(taxConfig.province);
      setEditFederalBrackets([...taxConfig.federal_brackets]);
      setEditProvincialBrackets([...taxConfig.provincial_brackets]);
    }
    setEditDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      await saveTaxConfig.mutateAsync({
        tax_year: selectedYear,
        province: editProvince,
        federal_brackets: editFederalBrackets,
        provincial_brackets: editProvincialBrackets,
      });
      setEditDialogOpen(false);
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
  };

  const addBracket = (
    brackets: IncomeTaxBracket[],
    setBrackets: (b: IncomeTaxBracket[]) => void
  ) => {
    setBrackets([...brackets, { up_to_income: 0, rate: 0 }]);
  };

  const removeBracket = (
    brackets: IncomeTaxBracket[],
    setBrackets: (b: IncomeTaxBracket[]) => void,
    index: number
  ) => {
    setBrackets(brackets.filter((_, i) => i !== index));
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
    <>
      <div className="space-y-6">
        {/* Actions */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium">Tax Configuration for {selectedYear}</h3>
            <p className="text-sm text-muted-foreground">
              Province: {PROVINCES.find(p => p.value === taxConfig?.province)?.label || taxConfig?.province || 'Not set'}
            </p>
          </div>
          <div className="flex gap-2">
            {isMoneyApiConfigured && (
              <Button variant="outline" onClick={() => setFetchDialogOpen(true)}>
                <IconDownload className="h-4 w-4 mr-2" />
                Fetch from API
              </Button>
            )}
            <Button variant="outline" onClick={handleOpenEdit}>
              <IconEdit className="h-4 w-4 mr-2" />
              Edit Brackets
            </Button>
          </div>
        </div>

        {/* Federal and Provincial Brackets - Side by Side */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Federal Brackets */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Federal Tax Brackets</CardTitle>
              <CardDescription>Canadian federal income tax rates</CardDescription>
            </CardHeader>
            <CardContent>
              <BracketsTable brackets={taxConfig?.federal_brackets || []} />
            </CardContent>
          </Card>

          {/* Provincial Brackets */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Provincial Tax Brackets ({taxConfig?.province || 'ON'})
              </CardTitle>
              <CardDescription>Provincial/territorial income tax rates</CardDescription>
            </CardHeader>
            <CardContent>
              <BracketsTable brackets={taxConfig?.provincial_brackets || []} />
            </CardContent>
          </Card>
        </div>

        {/* Other Tax Parameters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Other Tax Parameters</CardTitle>
            <CardDescription>CPP, EI, and other deduction rates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">CPP Rate</p>
                <p className="font-medium">{formatPercent(taxConfig?.cpp_rate || 0)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">CPP Max Pensionable</p>
                <p className="font-medium">{formatCurrency(taxConfig?.cpp_max_pensionable_earnings || 0)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">CPP Basic Exemption</p>
                <p className="font-medium">{formatCurrency(taxConfig?.cpp_basic_exemption || 0)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">EI Rate</p>
                <p className="font-medium">{formatPercent(taxConfig?.ei_rate || 0)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">EI Max Insurable</p>
                <p className="font-medium">{formatCurrency(taxConfig?.ei_max_insurable_earnings || 0)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Basic Personal Amount</p>
                <p className="font-medium">{formatCurrency(taxConfig?.basic_personal_amount || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Tax Configuration</DialogTitle>
            <DialogDescription>
              Modify tax brackets for {selectedYear}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Province Selection */}
            <div className="space-y-2">
              <Label>Province/Territory</Label>
              <Select value={editProvince} onValueChange={setEditProvince}>
                <SelectTrigger>
                  <SelectValue placeholder="Select province" />
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

            {/* Federal Brackets Editor */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Federal Tax Brackets</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addBracket(editFederalBrackets, setEditFederalBrackets)}
                >
                  <IconPlus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
              <BracketsEditor
                brackets={editFederalBrackets}
                setBrackets={setEditFederalBrackets}
                onUpdate={updateBracket}
                onRemove={removeBracket}
              />
            </div>

            {/* Provincial Brackets Editor */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Provincial Tax Brackets</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addBracket(editProvincialBrackets, setEditProvincialBrackets)}
                >
                  <IconPlus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
              <BracketsEditor
                brackets={editProvincialBrackets}
                setBrackets={setEditProvincialBrackets}
                onUpdate={updateBracket}
                onRemove={removeBracket}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saveTaxConfig.isPending}>
              {saveTaxConfig.isPending ? (
                <>
                  <IconLoader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fetch Dialog */}
      <FetchTaxBracketsDialog
        open={fetchDialogOpen}
        onOpenChange={setFetchDialogOpen}
        selectedYear={selectedYear}
      />
    </>
  );
}

function BracketsTable({ brackets }: { brackets: IncomeTaxBracket[] }) {
  if (brackets.length === 0) {
    return <p className="text-sm text-muted-foreground">No brackets configured</p>;
  }

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

function BracketsEditor({
  brackets,
  setBrackets,
  onUpdate,
  onRemove,
}: {
  brackets: IncomeTaxBracket[];
  setBrackets: (b: IncomeTaxBracket[]) => void;
  onUpdate: (
    brackets: IncomeTaxBracket[],
    setBrackets: (b: IncomeTaxBracket[]) => void,
    index: number,
    field: 'up_to_income' | 'rate',
    value: string
  ) => void;
  onRemove: (
    brackets: IncomeTaxBracket[],
    setBrackets: (b: IncomeTaxBracket[]) => void,
    index: number
  ) => void;
}) {
  return (
    <div className="space-y-2">
      {brackets.map((bracket, index) => (
        <div key={index} className="flex items-center gap-2">
          <div className="flex-1">
            <Input
              type="number"
              placeholder="Income up to (0 = unlimited)"
              value={bracket.up_to_income || ''}
              onChange={(e) => onUpdate(brackets, setBrackets, index, 'up_to_income', e.target.value)}
            />
          </div>
          <div className="w-24">
            <Input
              type="number"
              step="0.01"
              placeholder="Rate %"
              value={(bracket.rate * 100).toFixed(2)}
              onChange={(e) => onUpdate(brackets, setBrackets, index, 'rate', e.target.value)}
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onRemove(brackets, setBrackets, index)}
            className="text-destructive hover:text-destructive"
          >
            <IconTrash className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}
