import { useState } from 'react';
import type { Event, EventType, ProjectionConfig } from '@/lib/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { IconPlus, IconEdit, IconTrash, IconCalendar, IconCash, IconCreditCard, IconTrendingUp, IconHome, IconChartBar } from '@tabler/icons-react';
import { AddEventDialog } from './AddEventDialog';
import { SensitivityAnalysisDialog } from './SensitivityAnalysisDialog';

interface EventsListProps {
  events: Event[];
  onEventsChange: (events: Event[]) => void;
  baseConfig: ProjectionConfig;
}

const getEventIcon = (type: EventType) => {
  switch (type) {
    case 'one_time_income':
      return <IconCash className="h-4 w-4 text-green-600" />;
    case 'one_time_expense':
      return <IconCreditCard className="h-4 w-4 text-red-600" />;
    case 'extra_debt_payment':
      return <IconCreditCard className="h-4 w-4 text-orange-600" />;
    case 'salary_change':
      return <IconTrendingUp className="h-4 w-4 text-blue-600" />;
    case 'expense_level_change':
      return <IconHome className="h-4 w-4 text-purple-600" />;
    case 'savings_rate_change':
      return <IconCash className="h-4 w-4 text-indigo-600" />;
    default:
      return <IconCalendar className="h-4 w-4" />;
  }
};

const getEventTypeName = (type: EventType) => {
  switch (type) {
    case 'one_time_income':
      return 'One-Time Income';
    case 'one_time_expense':
      return 'One-Time Expense';
    case 'extra_debt_payment':
      return 'Extra Debt Payment';
    case 'salary_change':
      return 'Salary Change';
    case 'expense_level_change':
      return 'Expense Change';
    case 'savings_rate_change':
      return 'Savings Rate Change';
    default:
      return type;
  }
};

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const getEventSummary = (event: Event) => {
  const params = event.parameters;
  let summary = '';

  switch (event.type) {
    case 'one_time_income':
    case 'one_time_expense':
      summary = formatCurrency(params.amount || 0);
      break;

    case 'extra_debt_payment':
      summary = `${formatCurrency(params.amount || 0)} towards debt`;
      break;

    case 'salary_change':
      summary = `New salary: ${formatCurrency(params.new_salary || 0)}`;
      break;

    case 'expense_level_change':
      if (params.expense_change_type === 'absolute') {
        summary = `New expenses: ${formatCurrency(params.new_expenses || 0)}/mo`;
      } else if (params.expense_change_type === 'relative_percent') {
        const change = (params.expense_change || 0) * 100;
        summary = `${change > 0 ? '+' : ''}${change.toFixed(1)}% change`;
      } else {
        summary = `${formatCurrency(params.expense_change || 0)} change`;
      }
      break;

    case 'savings_rate_change':
      summary = `New rate: ${((params.new_savings_rate || 0) * 100).toFixed(0)}%`;
      break;

    default:
      summary = '';
  }

  // Add recurring indicator
  if (event.is_recurring) {
    const freq = event.recurrence_frequency === 'monthly' ? 'Monthly' :
                 event.recurrence_frequency === 'quarterly' ? 'Quarterly' :
                 event.recurrence_frequency === 'annually' ? 'Annually' : '';
    const endInfo = event.recurrence_end_date
      ? ` until ${formatDate(event.recurrence_end_date)}`
      : '';
    summary += ` • ${freq}${endInfo}`;
  }

  return summary;
};

export function EventsList({ events, onEventsChange, baseConfig }: EventsListProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [sensitivityDialogOpen, setSensitivityDialogOpen] = useState(false);
  const [sensitivityParameter, setSensitivityParameter] = useState<{
    name: string;
    label: string;
    value: number;
    updateFn: (path: string, value: number) => ProjectionConfig;
  } | null>(null);

  const sortedEvents = [...events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const handleAddEvent = (event: Event) => {
    onEventsChange([...events, event]);
    setDialogOpen(false);
  };

  const handleEditEvent = (event: Event) => {
    onEventsChange(events.map(e => e.id === event.id ? event : e));
    setEditingEvent(null);
  };

  const handleDeleteEvent = (eventId: string) => {
    if (confirm('Are you sure you want to delete this event?')) {
      onEventsChange(events.filter(e => e.id !== eventId));
    }
  };

  const openAddDialog = () => {
    setEditingEvent(null);
    setDialogOpen(true);
  };

  const openEditDialog = (event: Event) => {
    setEditingEvent(event);
    setDialogOpen(true);
  };

  const openSensitivityAnalysis = (event: Event) => {
    // Determine which parameter to analyze based on event type
    let paramName = '';
    let paramLabel = '';
    let paramValue = 0;

    switch (event.type) {
      case 'one_time_income':
        paramName = 'amount';
        paramLabel = 'Income Amount';
        paramValue = event.parameters.amount || 0;
        break;
      case 'one_time_expense':
        paramName = 'amount';
        paramLabel = 'Expense Amount';
        paramValue = event.parameters.amount || 0;
        break;
      case 'extra_debt_payment':
        paramName = 'amount';
        paramLabel = 'Debt Payment Amount';
        paramValue = event.parameters.amount || 0;
        break;
      case 'salary_change':
        paramName = 'new_salary';
        paramLabel = 'New Salary';
        paramValue = event.parameters.new_salary || 0;
        break;
      case 'expense_level_change':
        if (event.parameters.expense_change_type === 'absolute') {
          paramName = 'new_expenses';
          paramLabel = 'New Monthly Expenses';
          paramValue = event.parameters.new_expenses || 0;
        } else {
          paramName = 'expense_change';
          paramLabel = 'Expense Change';
          paramValue = event.parameters.expense_change || 0;
        }
        break;
      case 'savings_rate_change':
        paramName = 'new_savings_rate';
        paramLabel = 'New Savings Rate';
        paramValue = event.parameters.new_savings_rate || 0;
        break;
      default:
        return; // No parameter to analyze
    }

    if (paramValue === 0) {
      return; // No value to analyze
    }

    // Create update function that modifies this event parameter in the config
    const updateFn = (_path: string, value: number): ProjectionConfig => {
      const modifiedEvent: Event = {
        ...event,
        parameters: {
          ...event.parameters,
          [paramName]: value,
        },
      };

      // Replace the event in the config
      const newEvents = events.map(e => e.id === event.id ? modifiedEvent : e);

      return {
        ...baseConfig,
        events: newEvents,
      };
    };

    setSensitivityParameter({
      name: paramName,
      label: paramLabel,
      value: paramValue,
      updateFn,
    });
    setSensitivityDialogOpen(true);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Events & Milestones</CardTitle>
              <CardDescription>
                Add life events that affect your financial projections
              </CardDescription>
            </div>
            <Button onClick={openAddDialog} size="sm">
              <IconPlus className="h-4 w-4 mr-2" />
              Add Event
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {sortedEvents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No events added yet. Events help model real-life scenarios like salary changes, major expenses, or debt payments.</p>
              <Button onClick={openAddDialog} variant="outline" className="mt-4">
                <IconPlus className="h-4 w-4 mr-2" />
                Add Your First Event
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-shrink-0">
                    {getEventIcon(event.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {formatDate(event.date)}
                      </span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-muted font-medium">
                        {getEventTypeName(event.type)}
                      </span>
                      {event.is_recurring && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">
                          Recurring
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium mt-1">{event.description}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {getEventSummary(event)}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openSensitivityAnalysis(event)}
                      className="h-8 w-8 p-0"
                      title="Analyze sensitivity"
                    >
                      <IconChartBar className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(event)}
                      className="h-8 w-8 p-0"
                    >
                      <IconEdit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteEvent(event.id)}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    >
                      <IconTrash className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AddEventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={editingEvent ? handleEditEvent : handleAddEvent}
        editingEvent={editingEvent}
      />

      {/* Sensitivity Analysis Dialog */}
      {sensitivityParameter && (
        <SensitivityAnalysisDialog
          open={sensitivityDialogOpen}
          onOpenChange={setSensitivityDialogOpen}
          parameterName={sensitivityParameter.name}
          parameterLabel={sensitivityParameter.label}
          currentValue={sensitivityParameter.value}
          baseConfig={baseConfig}
          onUpdateValue={sensitivityParameter.updateFn}
        />
      )}
    </>
  );
}
