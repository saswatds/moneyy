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
import type { CreateLoanDetailsRequest } from '@/lib/api-client';

interface LoanDetailsFormProps {
  accountId: string;
  onSuccess?: () => void;
}

export function LoanDetailsForm({ accountId, onSuccess }: LoanDetailsFormProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<CreateLoanDetailsRequest>>({
    account_id: accountId,
    rate_type: 'fixed',
    payment_frequency: 'monthly',
    term_months: 60, // 5 years default
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await apiClient.createLoanDetails(accountId, formData as CreateLoanDetailsRequest);
      if (onSuccess) {
        onSuccess();
      } else {
        navigate(`/accounts/${accountId}/loan`);
      }
    } catch (error) {
      console.error('Failed to create loan details:', error);
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
            Enter the core details about your loan
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
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed</SelectItem>
                  <SelectItem value="variable">Variable</SelectItem>
                </SelectContent>
              </Select>
            </div>

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
              <Label htmlFor="term_months">Term (Months)</Label>
              <Input
                id="term_months"
                type="number"
                required
                placeholder="e.g., 60 for 5 years"
                value={formData.term_months || ''}
                onChange={(e) => updateField('term_months', parseInt(e.target.value))}
              />
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
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="bi-weekly">Bi-weekly</SelectItem>
                  <SelectItem value="semi-monthly">Semi-monthly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="loan_type">Loan Type (Optional)</Label>
              <Input
                id="loan_type"
                placeholder="e.g., Personal, Auto, Student"
                value={formData.loan_type || ''}
                onChange={(e) => updateField('loan_type', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lender">Lender (Optional)</Label>
              <Input
                id="lender"
                placeholder="e.g., Bank Name"
                value={formData.lender || ''}
                onChange={(e) => updateField('lender', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="loan_number">Loan Number (Optional)</Label>
              <Input
                id="loan_number"
                value={formData.loan_number || ''}
                onChange={(e) => updateField('loan_number', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="purpose">Purpose (Optional)</Label>
              <Input
                id="purpose"
                placeholder="e.g., Car purchase, Debt consolidation"
                value={formData.purpose || ''}
                onChange={(e) => updateField('purpose', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              rows={3}
              value={formData.notes || ''}
              onChange={(e) => updateField('notes', e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate('/accounts')}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={loading} className="flex-1">
          {loading ? 'Creating...' : 'Create Loan Details'}
        </Button>
      </div>
    </form>
  );
}
