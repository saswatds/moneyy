import { Link, useLocation } from 'react-router-dom';
import {
  IconLayoutDashboard,
  IconWallet,
  IconChartLine,
  IconTrendingUp,
  IconSettings,
  IconPlugConnected,
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
    title: 'Dashboard',
    url: '/',
    icon: IconLayoutDashboard,
  },
  {
    title: 'Accounts',
    url: '/accounts',
    icon: IconWallet,
  },
  {
    title: 'Connections',
    url: '/connections',
    icon: IconPlugConnected,
  },
  {
    title: 'Analytics',
    url: '/analytics',
    icon: IconChartLine,
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
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <Link to="/" className="text-lg font-bold text-sidebar-foreground">
          Finance Dashboard
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
      <SidebarFooter className="border-t border-sidebar-border px-4 py-4">
        <div className="text-xs text-sidebar-foreground/60">
          v1.0.0
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
