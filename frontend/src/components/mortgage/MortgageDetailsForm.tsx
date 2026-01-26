import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import type { CreateMortgageDetailsRequest } from '@/lib/api-client';

interface MortgageDetailsFormProps {
  accountId: string;
  onSuccess?: () => void;
}

export function MortgageDetailsForm({ accountId, onSuccess }: MortgageDetailsFormProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<CreateMortgageDetailsRequest>>({
    account_id: accountId,
    rate_type: 'fixed',
    payment_frequency: 'monthly',
    term_months: 300, // 25 years default
    amortization_months: 300,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await apiClient.createMortgageDetails(accountId, formData as CreateMortgageDetailsRequest);
      if (onSuccess) {
        onSuccess();
      } else {
        navigate(`/accounts/${accountId}/mortgage`);
      }
    } catch (error) {
      console.error('Failed to create mortgage details:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateField = <K extends keyof typeof formData>(field: K, value: typeof formData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Loan Details</CardTitle>
          <CardDescription>
            Enter the core details about your mortgage loan
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="original_amount">Original Loan Amount</Label>
              <Input
                id="original_amount"
                type="number"
                step="0.01"
                required
                value={formData.original_amount || ''}
                onChange={(e) => updateField('original_amount', parseFloat(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="interest_rate">Interest Rate (%)</Label>
              <Input
                id="interest_rate"
                type="number"
                step="0.01"
                required
                placeholder="e.g., 5.25"
                value={formData.interest_rate ? formData.interest_rate * 100 : ''}
                onChange={(e) => updateField('interest_rate', parseFloat(e.target.value) / 100)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rate_type">Rate Type</Label>
              <Select
                value={formData.rate_type}
                onValueChange={(value) => updateField('rate_type', value)}
              >
                <SelectTrigger id="rate_type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed</SelectItem>
                  <SelectItem value="variable">Variable</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lender">Lender</Label>
              <Input
                id="lender"
                value={formData.lender || ''}
                onChange={(e) => updateField('lender', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Term & Schedule</CardTitle>
          <CardDescription>
            Configure the mortgage term and payment schedule
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">Start Date</Label>
              <Input
                id="start_date"
                type="date"
                required
                value={formData.start_date || ''}
                onChange={(e) => updateField('start_date', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="renewal_date">Renewal Date (Optional)</Label>
              <Input
                id="renewal_date"
                type="date"
                value={formData.renewal_date || ''}
                onChange={(e) => updateField('renewal_date', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="term_months">Term Length (months)</Label>
              <Input
                id="term_months"
                type="number"
                required
                value={formData.term_months || ''}
                onChange={(e) => updateField('term_months', parseInt(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                {formData.term_months ? `${(formData.term_months / 12).toFixed(1)} years` : ''}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amortization_months">Amortization Period (months)</Label>
              <Input
                id="amortization_months"
                type="number"
                required
                value={formData.amortization_months || ''}
                onChange={(e) => updateField('amortization_months', parseInt(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                {formData.amortization_months ? `${(formData.amortization_months / 12).toFixed(1)} years` : ''}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment_amount">Payment Amount</Label>
              <Input
                id="payment_amount"
                type="number"
                step="0.01"
                required
                value={formData.payment_amount || ''}
                onChange={(e) => updateField('payment_amount', parseFloat(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment_frequency">Payment Frequency</Label>
              <Select
                value={formData.payment_frequency}
                onValueChange={(value) => updateField('payment_frequency', value)}
              >
                <SelectTrigger id="payment_frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="semi-monthly">Semi-Monthly</SelectItem>
                  <SelectItem value="bi-weekly">Bi-Weekly</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Property Details</CardTitle>
          <CardDescription>
            Optional information about the property
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="property_address">Property Address</Label>
            <Input
              id="property_address"
              value={formData.property_address || ''}
              onChange={(e) => updateField('property_address', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="property_city">City</Label>
              <Input
                id="property_city"
                value={formData.property_city || ''}
                onChange={(e) => updateField('property_city', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="property_province">Province</Label>
              <Input
                id="property_province"
                value={formData.property_province || ''}
                onChange={(e) => updateField('property_province', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="property_postal_code">Postal Code</Label>
              <Input
                id="property_postal_code"
                value={formData.property_postal_code || ''}
                onChange={(e) => updateField('property_postal_code', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="property_value">Property Value</Label>
            <Input
              id="property_value"
              type="number"
              step="0.01"
              value={formData.property_value || ''}
              onChange={(e) => updateField('property_value', parseFloat(e.target.value))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Additional Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mortgage_number">Mortgage Number</Label>
            <Input
              id="mortgage_number"
              value={formData.mortgage_number || ''}
              onChange={(e) => updateField('mortgage_number', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              rows={3}
              value={formData.notes || ''}
              onChange={(e) => updateField('notes', e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate('/accounts')}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Creating...' : 'Create Mortgage Details'}
        </Button>
      </div>
    </form>
  );
}
