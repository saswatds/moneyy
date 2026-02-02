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
} from '@/components/ui/dialog';
import { IconArrowLeft, IconPlus, IconRefresh, IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { apiClient } from '@/lib/api-client';
import { Currency } from '@/components/ui/currency';
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
  const [selectedPaymentNumber, setSelectedPaymentNumber] = useState<number | null>(null);
  const [recordingBulk, setRecordingBulk] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const paymentsPerPage = 10;

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

  const calculatePaymentDetails = (date: string) => {
    if (!details || schedule.length === 0) return;

    // Find the next payment after the last recorded payment (or first payment if none recorded)
    const lastRecordedPayment = payments.length > 0 ? payments[0] : null;
    const lastPaymentNumber = lastRecordedPayment
      ? schedule.findIndex(s => new Date(s.payment_date).toISOString().split('T')[0] === lastRecordedPayment.payment_date)
      : -1;

    // Find the payment in the schedule that matches or is closest to the selected date
    const selectedDate = new Date(date);
    const matchingPayment = schedule.find((entry, index) => {
      const entryDate = new Date(entry.payment_date);
      return index > lastPaymentNumber && entryDate >= selectedDate;
    });

    if (matchingPayment) {
      setSelectedPaymentNumber(matchingPayment.payment_number);
      setPaymentFormData(prev => ({
        ...prev,
        payment_date: date,
        payment_amount: matchingPayment.payment_amount,
        principal_amount: matchingPayment.principal_amount,
        interest_amount: matchingPayment.interest_amount,
        extra_payment: 0,
      }));
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
      setSelectedPaymentNumber(null);
      fetchMortgageData();
    } catch (error) {
      console.error('Failed to record payment:', error);
    }
  };

  const openPaymentDialog = () => {
    const today = new Date().toISOString().split('T')[0];
    setPaymentFormData({
      payment_date: today,
      extra_payment: 0,
    });
    calculatePaymentDetails(today);
    setPaymentDialogOpen(true);
  };

  const recordAllPaymentsToDate = async () => {
    if (!accountId || !details || !window.confirm('Record all scheduled payments up to today? This will create multiple payment entries.')) {
      return;
    }

    setRecordingBulk(true);
    try {
      // Find the last recorded payment
      const lastRecordedPayment = payments.length > 0 ? payments[0] : null;
      const lastPaymentNumber = lastRecordedPayment
        ? schedule.findIndex(s => new Date(s.payment_date).toISOString().split('T')[0] === lastRecordedPayment.payment_date)
        : -1;

      // Get all payments from the schedule that should have been made by now
      const today = new Date();
      const missedPayments = schedule.filter((entry, index) => {
        const entryDate = new Date(entry.payment_date);
        return index > lastPaymentNumber && entryDate <= today;
      });

      // Record each payment
      for (const payment of missedPayments) {
        await apiClient.recordMortgagePayment(accountId, {
          account_id: accountId,
          payment_date: new Date(payment.payment_date).toISOString().split('T')[0],
          payment_amount: payment.payment_amount,
          principal_amount: payment.principal_amount,
          interest_amount: payment.interest_amount,
          extra_payment: 0,
          notes: 'Auto-recorded',
        });
      }

      await fetchMortgageData();
    } catch (error) {
      console.error('Failed to record bulk payments:', error);
    } finally {
      setRecordingBulk(false);
    }
  };

  const getMissedPaymentsCount = () => {
    if (!details || schedule.length === 0) return 0;

    const lastRecordedPayment = payments.length > 0 ? payments[0] : null;
    const lastPaymentNumber = lastRecordedPayment
      ? schedule.findIndex(s => new Date(s.payment_date).toISOString().split('T')[0] === lastRecordedPayment.payment_date)
      : -1;

    const today = new Date();
    return schedule.filter((entry, index) => {
      const entryDate = new Date(entry.payment_date);
      return index > lastPaymentNumber && entryDate <= today;
    }).length;
  };

  // Keep formatCurrencyString for chart tooltips which need string returns
  const formatCurrencyString = (amount: number) => {
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

  // Find the payment number for today's date
  const today = new Date();
  const todayPayment = schedule.find(entry => {
    const entryDate = new Date(entry.payment_date);
    return entryDate >= today;
  })?.payment_number || null;

  // Prepare chart data - sample every Nth payment for readability
  // but ensure today's payment is always included
  const sampleRate = Math.ceil(schedule.length / 100);
  const sampledIndices = new Set(
    schedule
      .map((_, index) => index)
      .filter((index) => index % sampleRate === 0)
  );

  // Add today's payment index to ensure it's included
  if (todayPayment) {
    const todayIndex = schedule.findIndex(e => e.payment_number === todayPayment);
    if (todayIndex !== -1) {
      sampledIndices.add(todayIndex);
    }
  }

  const chartData = schedule
    .filter((_, index) => sampledIndices.has(index))
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

  // Find the index of today's payment in chart data
  const todayChartIndex = todayPayment !== null ? chartData.findIndex(d => d.payment >= todayPayment) : -1;

  const currentBalance = payments.length > 0
    ? payments[0].balance_after
    : -details.original_amount;

  const totalPaid = payments.reduce((sum, p) => sum + p.payment_amount, 0);
  const totalPrincipal = payments.reduce((sum, p) => sum + p.principal_amount, 0);
  const totalInterest = payments.reduce((sum, p) => sum + p.interest_amount, 0);

  // Calculate totals over the term (not full amortization) from schedule
  // Find payments within the term period (term starts from start_date)
  const termEndDate = new Date(details.start_date);
  termEndDate.setMonth(termEndDate.getMonth() + details.term_months);

  const termSchedule = schedule.filter(entry => {
    const entryDate = new Date(entry.payment_date);
    return entryDate < termEndDate;
  });

  const totalPrincipalOverTerm = termSchedule.reduce((sum, entry) => sum + entry.principal_amount, 0);
  const totalInterestOverTerm = termSchedule.reduce((sum, entry) => sum + entry.interest_amount, 0);
  const totalCostOfBorrowing = totalInterestOverTerm;
  const totalPaidOverTerm = totalPrincipalOverTerm + totalInterestOverTerm;

  return (
    <div className="space-y-3">
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
        <div className="flex gap-2">
          {getMissedPaymentsCount() > 0 && (
            <Button
              variant="outline"
              onClick={recordAllPaymentsToDate}
              disabled={recordingBulk}
            >
              <IconRefresh className="h-4 w-4 mr-2" />
              {recordingBulk
                ? 'Recording...'
                : `Record All Payments to Date (${getMissedPaymentsCount()})`}
            </Button>
          )}
          <Button onClick={openPaymentDialog}>
            <IconPlus className="h-4 w-4 mr-2" />
            Record Payment
          </Button>
        </div>

        <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Mortgage Payment</DialogTitle>
              <DialogDescription>
                {selectedPaymentNumber
                  ? `Recording payment #${selectedPaymentNumber} of ${schedule.length}`
                  : 'Enter the details of your mortgage payment'}
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
                  onChange={(e) => {
                    calculatePaymentDetails(e.target.value);
                  }}
                />
              </div>

              {selectedPaymentNumber && (
                <div className="p-3 bg-muted rounded-md text-sm">
                  <p className="font-medium">Auto-calculated from amortization schedule:</p>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div>
                      <span className="text-muted-foreground">Payment:</span>{' '}
                      <span className="font-medium"><Currency amount={paymentFormData.payment_amount || 0} /></span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Principal:</span>{' '}
                      <span className="font-medium text-green-600 dark:text-green-400"><Currency amount={paymentFormData.principal_amount || 0} /></span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Interest:</span>{' '}
                      <span className="font-medium text-red-600 dark:text-red-400"><Currency amount={paymentFormData.interest_amount || 0} /></span>
                    </div>
                  </div>
                </div>
              )}

              {!selectedPaymentNumber && (
                <>
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
                </>
              )}

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
              <Currency amount={Math.abs(currentBalance)} />
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Original Amount</CardDescription>
            <CardTitle className="text-2xl">
              <Currency amount={details.original_amount} />
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
              <Currency amount={details.payment_amount} />
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
              <span className="font-medium"><Currency amount={totalPaid} /></span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Principal</span>
              <span className="font-medium text-green-600 dark:text-green-400">
                <Currency amount={totalPrincipal} />
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Interest</span>
              <span className="font-medium text-red-600 dark:text-red-400">
                <Currency amount={totalInterest} />
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Remaining Balance</span>
              <span className="font-medium"><Currency amount={Math.abs(currentBalance)} /></span>
            </div>
            <div className="pt-3 border-t border-border">
              <div className="flex justify-between mb-2">
                <span className="text-muted-foreground font-semibold">Over Term ({(details.term_months / 12).toFixed(0)} years):</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Paid</span>
                <span className="font-medium">
                  <Currency amount={totalPaidOverTerm} />
                </span>
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-muted-foreground">Total Principal</span>
                <span className="font-medium text-green-600 dark:text-green-400">
                  <Currency amount={totalPrincipalOverTerm} />
                </span>
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-muted-foreground">Cost of Borrowing</span>
                <span className="font-medium text-red-600 dark:text-red-400">
                  <Currency amount={totalCostOfBorrowing} />
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts - Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                    formatter={(value: number) => formatCurrencyString(value)}
                    labelStyle={{ color: '#000' }}
                  />
                  <Legend />
                  {todayPayment !== null && todayChartIndex >= 0 && (
                    <ReferenceLine
                      x={todayChartIndex}
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      label={{ value: 'Today', position: 'top', fill: '#8b5cf6' }}
                      isFront={true}
                    />
                  )}
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
                    formatter={(value: number) => formatCurrencyString(value)}
                    labelStyle={{ color: '#000' }}
                  />
                  <Legend />
                  {todayPayment !== null && todayChartIndex >= 0 && (
                    <ReferenceLine
                      x={todayChartIndex}
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      label={{ value: 'Today', position: 'top', fill: '#8b5cf6' }}
                      isFront={true}
                    />
                  )}
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
      </div>

      {/* Recent Payments */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Payments</CardTitle>
              <CardDescription>History of recorded mortgage payments</CardDescription>
            </div>
            {payments.length > 0 && (
              <div className="text-sm text-muted-foreground">
                {payments.length} total payment{payments.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>
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
                  (() => {
                    const startIndex = (currentPage - 1) * paymentsPerPage;
                    const endIndex = startIndex + paymentsPerPage;
                    const currentPayments = payments.slice(startIndex, endIndex);

                    return currentPayments.map((payment) => (
                      <tr key={payment.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-3 text-sm">
                          {formatDate(payment.payment_date)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          <Currency amount={payment.payment_amount} />
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-green-600 dark:text-green-400">
                          <Currency amount={payment.principal_amount} />
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-red-600 dark:text-red-400">
                          <Currency amount={payment.interest_amount} />
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          {payment.extra_payment > 0 ? <Currency amount={payment.extra_payment} /> : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium">
                          <Currency amount={Math.abs(payment.balance_after)} />
                        </td>
                      </tr>
                    ));
                  })()
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

          {/* Pagination Controls */}
          {payments.length > paymentsPerPage && (() => {
            const totalPages = Math.ceil(payments.length / paymentsPerPage);
            const startIndex = (currentPage - 1) * paymentsPerPage + 1;
            const endIndex = Math.min(currentPage * paymentsPerPage, payments.length);

            return (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                <div className="text-sm text-muted-foreground">
                  Showing {startIndex} to {endIndex} of {payments.length}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    <IconChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="text-sm">
                    Page {currentPage} of {totalPages}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <IconChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}
