import { IconInfoCircle, IconX } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { useDemoMode } from '@/lib/demo-context';

export function DemoModeBanner() {
  const { isDemoMode, exitDemoMode } = useDemoMode();

  if (!isDemoMode) {
    return null;
  }

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <IconInfoCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
            Demo Mode - You're exploring sample data
          </p>
        </div>
        <Button
          onClick={exitDemoMode}
          variant="outline"
          size="sm"
          className="flex-shrink-0 bg-background hover:bg-background/80"
        >
          <IconX className="h-4 w-4 mr-2" />
          Exit Demo
        </Button>
      </div>
    </div>
  );
}
