import { useState, useEffect } from 'react';
import type { Event, EventType, EventParameters } from '@/lib/api-client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAccounts } from '@/hooks/use-accounts';

interface AddEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (event: Event) => void;
  editingEvent: Event | null;
}

export function AddEventDialog({ open, onOpenChange, onSave, editingEvent }: AddEventDialogProps) {
  const { data: accountsData } = useAccounts();
  const [eventType, setEventType] = useState<EventType>('one_time_expense');
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [parameters, setParameters] = useState<EventParameters>({});
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<'monthly' | 'quarterly' | 'annually'>('monthly');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');

  // Initialize form when editing
  useEffect(() => {
    if (editingEvent) {
      setEventType(editingEvent.type);
      setDate(editingEvent.date.split('T')[0]);
      setDescription(editingEvent.description);
      setParameters(editingEvent.parameters);
      setIsRecurring(editingEvent.is_recurring || false);
      setRecurrenceFrequency(editingEvent.recurrence_frequency || 'monthly');
      setRecurrenceEndDate(editingEvent.recurrence_end_date ? editingEvent.recurrence_end_date.split('T')[0] : '');
    } else {
      // Reset for new event
      setEventType('one_time_expense');
      setDate(new Date().toISOString().split('T')[0]);
      setDescription('');
      setParameters({});
      setIsRecurring(false);
      setRecurrenceFrequency('monthly');
      setRecurrenceEndDate('');
    }
  }, [editingEvent, open]);

  const handleSave = () => {
    const event: Event = {
      id: editingEvent?.id || crypto.randomUUID(),
      type: eventType,
      date: date + 'T00:00:00Z',
      description,
      parameters,
      is_recurring: isRecurring,
      ...(isRecurring && {
        recurrence_frequency: recurrenceFrequency,
        recurrence_end_date: recurrenceEndDate ? recurrenceEndDate + 'T00:00:00Z' : undefined,
      }),
    };

    onSave(event);
    onOpenChange(false);
  };

  const renderEventForm = () => {
    switch (eventType) {
      case 'one_time_income':
      case 'one_time_expense':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount ($)</Label>
              <Input
                id="amount"
                type="number"
                min={0}
                step={0.01}
                value={parameters.amount || ''}
                onChange={(e) => setParameters({ ...parameters, amount: parseFloat(e.target.value) })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category (Optional)</Label>
              <Input
                id="category"
                value={parameters.category || ''}
                onChange={(e) => setParameters({ ...parameters, category: e.target.value })}
                placeholder="e.g., bonus, vacation, car purchase"
              />
            </div>
          </>
        );

      case 'extra_debt_payment':
        const debtAccounts = accountsData?.accounts.filter(acc => !acc.is_asset) || [];
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="account_id">Debt Account</Label>
              <Select
                value={parameters.account_id || ''}
                onValueChange={(value) => setParameters({ ...parameters, account_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select debt account" />
                </SelectTrigger>
                <SelectContent>
                  {debtAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name} ({account.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Payment Amount ($)</Label>
              <Input
                id="amount"
                type="number"
                min={0}
                step={0.01}
                value={parameters.amount || ''}
                onChange={(e) => setParameters({ ...parameters, amount: parseFloat(e.target.value) })}
                required
              />
            </div>
          </>
        );

      case 'salary_change':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="new_salary">New Annual Salary ($)</Label>
              <Input
                id="new_salary"
                type="number"
                min={0}
                step={1000}
                value={parameters.new_salary || ''}
                onChange={(e) => setParameters({ ...parameters, new_salary: parseFloat(e.target.value) })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new_salary_growth">New Salary Growth Rate (%) (Optional)</Label>
              <Input
                id="new_salary_growth"
                type="number"
                min={0}
                max={20}
                step={0.1}
                value={parameters.new_salary_growth ? parameters.new_salary_growth * 100 : ''}
                onChange={(e) => setParameters({ ...parameters, new_salary_growth: parseFloat(e.target.value) / 100 })}
                placeholder="Leave empty to keep current rate"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Reason</Label>
              <Select
                value={parameters.reason || ''}
                onValueChange={(value) => setParameters({ ...parameters, reason: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="promotion">Promotion</SelectItem>
                  <SelectItem value="job_change">Job Change</SelectItem>
                  <SelectItem value="retirement">Retirement</SelectItem>
                  <SelectItem value="reduction">Reduction</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        );

      case 'expense_level_change':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="expense_change_type">Change Type</Label>
              <Select
                value={parameters.expense_change_type || 'absolute'}
                onValueChange={(value: 'absolute' | 'relative_amount' | 'relative_percent') =>
                  setParameters({ ...parameters, expense_change_type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="absolute">Set to New Amount</SelectItem>
                  <SelectItem value="relative_amount">Increase/Decrease by Dollar Amount</SelectItem>
                  <SelectItem value="relative_percent">Increase/Decrease by Percentage</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {parameters.expense_change_type === 'absolute' ? (
              <div className="space-y-2">
                <Label htmlFor="new_expenses">New Monthly Expenses ($)</Label>
                <Input
                  id="new_expenses"
                  type="number"
                  min={0}
                  step={100}
                  value={parameters.new_expenses || ''}
                  onChange={(e) => setParameters({ ...parameters, new_expenses: parseFloat(e.target.value) })}
                  required
                />
              </div>
            ) : parameters.expense_change_type === 'relative_percent' ? (
              <div className="space-y-2">
                <Label htmlFor="expense_change">Percentage Change (%)</Label>
                <Input
                  id="expense_change"
                  type="number"
                  step={1}
                  value={parameters.expense_change ? parameters.expense_change * 100 : ''}
                  onChange={(e) => setParameters({ ...parameters, expense_change: parseFloat(e.target.value) / 100 })}
                  placeholder="e.g., 10 for +10%, -20 for -20%"
                  required
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="expense_change">Change Amount ($)</Label>
                <Input
                  id="expense_change"
                  type="number"
                  step={100}
                  value={parameters.expense_change || ''}
                  onChange={(e) => setParameters({ ...parameters, expense_change: parseFloat(e.target.value) })}
                  placeholder="Positive to increase, negative to decrease"
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="reason">Reason</Label>
              <Select
                value={parameters.reason || ''}
                onValueChange={(value) => setParameters({ ...parameters, reason: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="children">Children</SelectItem>
                  <SelectItem value="relocation">Relocation</SelectItem>
                  <SelectItem value="lifestyle_change">Lifestyle Change</SelectItem>
                  <SelectItem value="retirement">Retirement</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        );

      case 'savings_rate_change':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="new_savings_rate">New Savings Rate (%)</Label>
              <Input
                id="new_savings_rate"
                type="number"
                min={0}
                max={100}
                step={1}
                value={parameters.new_savings_rate ? parameters.new_savings_rate * 100 : ''}
                onChange={(e) => setParameters({ ...parameters, new_savings_rate: parseFloat(e.target.value) / 100 })}
                required
              />
              <p className="text-xs text-muted-foreground">
                Percentage of net income to save/invest
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Reason</Label>
              <Select
                value={parameters.reason || ''}
                onValueChange={(value) => setParameters({ ...parameters, reason: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="debt_payoff">Debt Paid Off</SelectItem>
                  <SelectItem value="lifestyle_change">Lifestyle Change</SelectItem>
                  <SelectItem value="retirement_prep">Retirement Preparation</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingEvent ? 'Edit Event' : 'Add Event'}</DialogTitle>
          <DialogDescription>
            {editingEvent ? 'Update the event details below' : 'Add a life event to your projection'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="eventType">Event Type</Label>
            <Select value={eventType} onValueChange={(value: EventType) => setEventType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="one_time_income">One-Time Income</SelectItem>
                <SelectItem value="one_time_expense">One-Time Expense</SelectItem>
                <SelectItem value="extra_debt_payment">Extra Debt Payment</SelectItem>
                <SelectItem value="salary_change">Salary Change</SelectItem>
                <SelectItem value="expense_level_change">Expense Level Change</SelectItem>
                <SelectItem value="savings_rate_change">Savings Rate Change</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this event"
              rows={2}
              required
            />
          </div>

          {/* Recurrence Options */}
          {(eventType === 'one_time_income' || eventType === 'one_time_expense' || eventType === 'extra_debt_payment') && (
            <div className="space-y-4 p-3 border rounded-lg bg-muted/30">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isRecurring"
                  checked={isRecurring}
                  onCheckedChange={(checked) => setIsRecurring(checked === true)}
                />
                <Label htmlFor="isRecurring" className="font-medium cursor-pointer">
                  Recurring Event
                </Label>
              </div>

              {isRecurring && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="recurrenceFrequency">Frequency</Label>
                    <Select
                      value={recurrenceFrequency}
                      onValueChange={(value: 'monthly' | 'quarterly' | 'annually') => setRecurrenceFrequency(value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly (Every 3 months)</SelectItem>
                        <SelectItem value="annually">Annually (Once per year)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="recurrenceEndDate">End Date (Optional)</Label>
                    <Input
                      id="recurrenceEndDate"
                      type="date"
                      value={recurrenceEndDate}
                      onChange={(e) => setRecurrenceEndDate(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Leave empty to recur until end of projection period
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          {renderEventForm()}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!date || !description}>
            {editingEvent ? 'Update Event' : 'Add Event'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
