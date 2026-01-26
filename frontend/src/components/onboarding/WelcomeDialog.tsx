import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { IconChartBar, IconPlus } from '@tabler/icons-react';
import { useDemoMode } from '@/lib/demo-context';

interface WelcomeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WelcomeDialog({ open, onOpenChange }: WelcomeDialogProps) {
  const { enterDemoMode, isLoading } = useDemoMode();
  const [isEnteringDemo, setIsEnteringDemo] = useState(false);

  const handleTryDemo = async () => {
    try {
      setIsEnteringDemo(true);
      await enterDemoMode();
      // Mark as seen and close dialog
      localStorage.setItem('has_seen_welcome', 'true');
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to enter demo mode:', error);
      setIsEnteringDemo(false);
    }
  };

  const handleStartFresh = () => {
    // Mark as seen and close dialog
    localStorage.setItem('has_seen_welcome', 'true');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">Welcome to Money!</DialogTitle>
          <DialogDescription>
            Choose how you'd like to get started with tracking your finances
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4 md:grid-cols-2">
          {/* Try Demo Data Option */}
          <Card className="cursor-pointer hover:border-primary transition-colors">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="flex items-center gap-2">
                    <IconChartBar className="h-5 w-5 text-primary" />
                    Try Demo Data
                  </CardTitle>
                  <CardDescription className="mt-2">
                    Explore with a sample portfolio
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground space-y-2">
                <p>Perfect if you want to:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>See how the app works</li>
                  <li>Explore features with real-looking data</li>
                  <li>Test projections and visualizations</li>
                </ul>
                <p className="pt-2 font-medium">
                  Includes sample accounts, investments, mortgage, and more
                </p>
              </div>
              <Button
                className="w-full"
                onClick={handleTryDemo}
                disabled={isLoading || isEnteringDemo}
              >
                {isEnteringDemo ? 'Loading demo data...' : 'Try Demo Data'}
              </Button>
            </CardContent>
          </Card>

          {/* Start Fresh Option */}
          <Card className="cursor-pointer hover:border-primary transition-colors">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="flex items-center gap-2">
                    <IconPlus className="h-5 w-5 text-primary" />
                    Start Fresh
                  </CardTitle>
                  <CardDescription className="mt-2">
                    Begin with your own accounts
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground space-y-2">
                <p>Perfect if you want to:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Add your own accounts right away</li>
                  <li>Start tracking from scratch</li>
                  <li>Build your portfolio step-by-step</li>
                </ul>
                <p className="pt-2 font-medium">
                  You can always try demo data later from Settings
                </p>
              </div>
              <Button
                className="w-full"
                variant="outline"
                onClick={handleStartFresh}
                disabled={isLoading}
              >
                Start Fresh
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="text-xs text-muted-foreground text-center pt-2">
          You can switch between demo and real data anytime from Settings
        </div>
      </DialogContent>
    </Dialog>
  );
}
