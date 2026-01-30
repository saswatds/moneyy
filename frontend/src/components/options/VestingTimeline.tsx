import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { VestingEvent } from '@/lib/api-client';

interface VestingTimelineProps {
  events: VestingEvent[];
}

export function VestingTimeline({ events }: VestingTimelineProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'vested':
        return <Badge variant="outline" className="text-green-600 border-green-600/30">Vested</Badge>;
      case 'pending':
        return <Badge variant="outline" className="text-yellow-600 border-yellow-600/30">Pending</Badge>;
      case 'forfeited':
        return <Badge variant="outline" className="text-red-600 border-red-600/30">Forfeited</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Sort events by date
  const sortedEvents = [...events].sort((a, b) =>
    new Date(a.vest_date).getTime() - new Date(b.vest_date).getTime()
  );

  // Calculate cumulative vested for each event
  let cumulativeVested = 0;
  const eventsWithCumulative = sortedEvents.map((event, index) => {
    if (event.status === 'vested') {
      cumulativeVested += event.quantity;
    }
    return {
      ...event,
      period: index + 1,
      cumulativeVested: event.status === 'vested' ? cumulativeVested : cumulativeVested,
    };
  });

  const pendingCount = events.filter(e => e.status === 'pending').length;
  const vestedCount = events.filter(e => e.status === 'vested').length;

  if (events.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Vesting Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No vesting events scheduled. Add a vesting schedule to your grants to see the timeline.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vesting Schedule</CardTitle>
        <CardDescription>
          {vestedCount} vested · {pendingCount} pending
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Period</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Vesting Date</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Options Vested</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Cumulative</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {eventsWithCumulative.map((event) => {
                return (
                  <tr key={event.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="px-3 py-2 text-sm">{event.period}</td>
                    <td className="px-3 py-2 text-sm">{formatDate(event.vest_date)}</td>
                    <td className="px-3 py-2 text-sm text-right">{event.quantity.toLocaleString()}</td>
                    <td className="px-3 py-2 text-sm text-right">{event.cumulativeVested.toLocaleString()}</td>
                    <td className="px-3 py-2">{getStatusBadge(event.status)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
