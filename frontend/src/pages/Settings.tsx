import { Card, CardContent } from '@/components/ui/card';
import { IconSettings } from '@tabler/icons-react';

export function Settings() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your preferences and application settings
        </p>
      </div>

      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <IconSettings className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">Settings Coming Soon</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              User preferences and settings will be available here
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
