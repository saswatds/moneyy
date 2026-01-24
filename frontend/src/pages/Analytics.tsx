import { Card, CardContent } from '@/components/ui/card';
import { IconChartLine } from '@tabler/icons-react';

export function Analytics() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground mt-2">
          Insights and performance analysis of your financial accounts
        </p>
      </div>

      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <IconChartLine className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">Analytics Coming Soon</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Advanced analytics and insights will be available here
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
