import { SidebarTrigger } from '@/components/ui/sidebar';

export function Header() {
  return (
    <header className="border-b border-border bg-card">
      <div className="flex h-16 items-center gap-4 px-4 sm:px-6 lg:px-8">
        <SidebarTrigger className="-ml-1" />
        <div className="flex flex-1 items-center justify-between">
          <div className="text-sm font-medium text-muted-foreground">
            Let's keep track of your finances!
          </div>
        </div>
      </div>
    </header>
  );
}
