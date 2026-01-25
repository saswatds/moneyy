import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { IconArrowLeft, IconPlus } from '@tabler/icons-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { apiClient } from '@/lib/api-client';
import type {
  MortgageDetails,
  MortgagePayment,
  AmortizationEntry,
  CreateMortgagePaymentRequest,
} from '@/lib/api-client';

export function MortgageDashboard() {
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState<MortgageDetails | null>(null);
  const [schedule, setSchedule] = useState<AmortizationEntry[]>([]);
  const [payments, setPayments] = useState<MortgagePayment[]>([]);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentFormData, setPaymentFormData] = useState<Partial<CreateMortgagePaymentRequest>>({
    payment_date: new Date().toISOString().split('T')[0],
    extra_payment: 0,
  });

  useEffect(() => {
    if (accountId) {
      fetchMortgageData();
    }
  }, [accountId]);

  const fetchMortgageData = async () => {
    if (!accountId) return;

    try {
      setLoading(true);
      const [detailsData, scheduleData, paymentsData] = await Promise.all([
        apiClient.getMortgageDetails(accountId),
        apiClient.getAmortizationSchedule(accountId),
        apiClient.getMortgagePayments(accountId),
      ]);

      setDetails(detailsData);
      setSchedule(scheduleData.schedule);
      setPayments(paymentsData.payments);
    } catch (error) {
      console.error('Failed to fetch mortgage data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId) return;

    try {
      await apiClient.recordMortgagePayment(accountId, paymentFormData as CreateMortgagePaymentRequest);
      setPaymentDialogOpen(false);
      setPaymentFormData({
        payment_date: new Date().toISOString().split('T')[0],
        extra_payment: 0,
      });
      fetchMortgageData();
    } catch (error) {
      console.error('Failed to record payment:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'CAD',
    }).format(Math.abs(amount));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Loading mortgage details...</div>
      </div>
    );
  }

  if (!details) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Mortgage details not found</div>
      </div>
    );
  }

  // Prepare chart data - sample every Nth payment for readability
  const chartData = schedule
    .filter((_, index) => index % Math.ceil(schedule.length / 100) === 0)
    .map((entry) => ({
      payment: entry.payment_number,
      balance: entry.balance_after,
      principal: entry.principal_amount,
      interest: entry.interest_amount,
      date: new Date(entry.payment_date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
      }),
    }));

  const currentBalance = payments.length > 0
    ? payments[0].balance_after
    : -details.original_amount;

  const totalPaid = payments.reduce((sum, p) => sum + p.payment_amount, 0);
  const totalPrincipal = payments.reduce((sum, p) => sum + p.principal_amount, 0);
  const totalInterest = payments.reduce((sum, p) => sum + p.interest_amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/accounts')}
          >
            <IconArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Mortgage Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              {details.property_address || 'Property Mortgage'}
            </p>
          </div>
        </div>
        <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <IconPlus className="h-4 w-4 mr-2" />
              Record Payment
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Mortgage Payment</DialogTitle>
              <DialogDescription>
                Enter the details of your mortgage payment
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="payment_date">Payment Date</Label>
                <Input
                  id="payment_date"
                  type="date"
                  required
                  value={paymentFormData.payment_date || ''}
                  onChange={(e) =>
                    setPaymentFormData((prev) => ({ ...prev, payment_date: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment_amount">Payment Amount</Label>
                <Input
                  id="payment_amount"
                  type="number"
                  step="0.01"
                  required
                  value={paymentFormData.payment_amount || ''}
                  onChange={(e) =>
                    setPaymentFormData((prev) => ({
                      ...prev,
                      payment_amount: parseFloat(e.target.value),
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="principal_amount">Principal Amount</Label>
                <Input
                  id="principal_amount"
                  type="number"
                  step="0.01"
                  required
                  value={paymentFormData.principal_amount || ''}
                  onChange={(e) =>
                    setPaymentFormData((prev) => ({
                      ...prev,
                      principal_amount: parseFloat(e.target.value),
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="interest_amount">Interest Amount</Label>
                <Input
                  id="interest_amount"
                  type="number"
                  step="0.01"
                  required
                  value={paymentFormData.interest_amount || ''}
                  onChange={(e) =>
                    setPaymentFormData((prev) => ({
                      ...prev,
                      interest_amount: parseFloat(e.target.value),
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="extra_payment">Extra Payment (Prepayment)</Label>
                <Input
                  id="extra_payment"
                  type="number"
                  step="0.01"
                  value={paymentFormData.extra_payment || 0}
                  onChange={(e) =>
                    setPaymentFormData((prev) => ({
                      ...prev,
                      extra_payment: parseFloat(e.target.value) || 0,
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  rows={2}
                  value={paymentFormData.notes || ''}
                  onChange={(e) =>
                    setPaymentFormData((prev) => ({ ...prev, notes: e.target.value }))
                  }
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setPaymentDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Record Payment</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Current Balance</CardDescription>
            <CardTitle className="text-2xl text-red-600 dark:text-red-400">
              {formatCurrency(currentBalance)}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Original Amount</CardDescription>
            <CardTitle className="text-2xl">
              {formatCurrency(details.original_amount)}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Interest Rate</CardDescription>
            <CardTitle className="text-2xl">
              {(details.interest_rate * 100).toFixed(2)}%
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Monthly Payment</CardDescription>
            <CardTitle className="text-2xl">
              {formatCurrency(details.payment_amount)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Mortgage Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Loan Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Lender</span>
              <span className="font-medium">{details.lender || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Rate Type</span>
              <span className="font-medium capitalize">{details.rate_type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Start Date</span>
              <span className="font-medium">{formatDate(details.start_date)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Maturity Date</span>
              <span className="font-medium">{formatDate(details.maturity_date)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Term</span>
              <span className="font-medium">
                {(details.term_months / 12).toFixed(0)} years
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amortization</span>
              <span className="font-medium">
                {(details.amortization_months / 12).toFixed(0)} years
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Payment Frequency</span>
              <span className="font-medium capitalize">{details.payment_frequency}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Payments Made</span>
              <span className="font-medium">{payments.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Paid</span>
              <span className="font-medium">{formatCurrency(totalPaid)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Principal</span>
              <span className="font-medium text-green-600 dark:text-green-400">
                {formatCurrency(totalPrincipal)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Interest</span>
              <span className="font-medium text-red-600 dark:text-red-400">
                {formatCurrency(totalInterest)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Remaining Balance</span>
              <span className="font-medium">{formatCurrency(Math.abs(currentBalance))}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Drawdown Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Mortgage Balance Over Time</CardTitle>
          <CardDescription>
            Projected amortization schedule showing principal balance drawdown
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  labelStyle={{ color: '#000' }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="balance"
                  stroke="#ef4444"
                  name="Balance"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Principal vs Interest Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Principal vs Interest Breakdown</CardTitle>
          <CardDescription>
            See how your payment is split between principal and interest over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  labelStyle={{ color: '#000' }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="principal"
                  stroke="#10b981"
                  name="Principal"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="interest"
                  stroke="#f59e0b"
                  name="Interest"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Recent Payments */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Payments</CardTitle>
          <CardDescription>History of recorded mortgage payments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Date
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                    Payment
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                    Principal
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                    Interest
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                    Extra
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                    Balance After
                  </th>
                </tr>
              </thead>
              <tbody>
                {payments.length > 0 ? (
                  payments.slice(0, 10).map((payment) => (
                    <tr key={payment.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 text-sm">
                        {formatDate(payment.payment_date)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        {formatCurrency(payment.payment_amount)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-green-600 dark:text-green-400">
                        {formatCurrency(payment.principal_amount)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-red-600 dark:text-red-400">
                        {formatCurrency(payment.interest_amount)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        {payment.extra_payment > 0 ? formatCurrency(payment.extra_payment) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium">
                        {formatCurrency(Math.abs(payment.balance_after))}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      No payments recorded yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
