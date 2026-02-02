import { useNavigate } from 'react-router-dom';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { useDemoMode } from '@/lib/demo-context';
import { IconLogout, IconInfoCircle, IconX } from '@tabler/icons-react';

export function Header() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { isDemoMode, exitDemoMode } = useDemoMode();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className={isDemoMode ? "border-b border-amber-500/20 bg-amber-500/10 glass" : "border-b border-border bg-card/80 glass"}>
      <div className="flex h-12 items-center gap-3 px-4">
        <SidebarTrigger className="-ml-1" />
        <div className="flex flex-1 items-center justify-between">
          {isDemoMode ? (
            <div className="flex items-center gap-3">
              <IconInfoCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <span className="text-sm font-medium text-amber-900 dark:text-amber-100">
                Demo Mode - You're exploring sample data
              </span>
              <Button
                onClick={exitDemoMode}
                variant="outline"
                size="sm"
                className="ml-2 h-7 bg-background hover:bg-background/80"
              >
                <IconX className="h-3 w-3 mr-1" />
                Exit Demo
              </Button>
            </div>
          ) : (
            <div className="text-sm font-medium text-muted-foreground">
              Let's keep track of your finances!
            </div>
          )}
          <div className="flex items-center gap-4">
            {user && (
              <div className="text-sm text-muted-foreground">
                {user.email}
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="gap-2"
            >
              <IconLogout className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
