import { Link, useLocation } from 'react-router-dom';
import {
  IconWallet,
  IconTrendingUp,
  IconSettings,
  IconHome,
  IconReceipt,
  IconCash,
} from '@tabler/icons-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from '@/components/ui/sidebar';

const items = [
  {
    title: 'Accounts',
    url: '/accounts',
    icon: IconWallet,
  },
  {
    title: 'Assets',
    url: '/assets',
    icon: IconHome,
  },
  {
    title: 'Income & Taxes',
    url: '/income',
    icon: IconCash,
  },
  {
    title: 'Expenses',
    url: '/expenses',
    icon: IconReceipt,
  },
  {
    title: 'Projections',
    url: '/projections',
    icon: IconTrendingUp,
  },
  {
    title: 'Settings',
    url: '/settings',
    icon: IconSettings,
  },
];

export function AppSidebar() {
  const location = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-3 py-3">
        <Link to="/accounts" className="text-base font-bold text-sidebar-foreground">
          Moneyy
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const isActive = location.pathname === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border px-3 py-2">
        <div className="text-xs text-sidebar-foreground/60">
          v1.0.0
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
