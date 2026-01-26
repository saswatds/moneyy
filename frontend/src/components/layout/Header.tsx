import { useNavigate } from 'react-router-dom';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { IconLogout } from '@tabler/icons-react';

export function Header() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="border-b border-border bg-card">
      <div className="flex h-16 items-center gap-4 px-4 sm:px-6 lg:px-8">
        <SidebarTrigger className="-ml-1" />
        <div className="flex flex-1 items-center justify-between">
          <div className="text-sm font-medium text-muted-foreground">
            Let's keep track of your finances!
          </div>
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
