import { Card, CardContent } from '@/components/ui/card';
import { IconTrendingUp } from '@tabler/icons-react';

export function Projections() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Projections</h1>
        <p className="text-muted-foreground mt-2">
          Future balance projections and financial goals
        </p>
      </div>

      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <IconTrendingUp className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">Projections Coming Soon</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Future value projections and goal tracking will be available here
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
