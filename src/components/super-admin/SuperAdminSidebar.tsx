import { NavLink, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  Building2,
  Users,
  BarChart3,
  LogOut,
  Settings,
  Shield,
  MessageSquare
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";

const menuItems = [
  { title: "ダッシュボード", url: "/super-admin", icon: LayoutDashboard },
  { title: "テナント管理", url: "/super-admin/tenants", icon: Building2 },
  { title: "全ユーザー管理", url: "/super-admin/users", icon: Users },
  { title: "サポートチケット", url: "/super-admin/tickets", icon: MessageSquare },
  { title: "全体分析", url: "/super-admin/analytics", icon: BarChart3 },
];

export function SuperAdminSidebar() {
  const location = useLocation();

  return (
    <Sidebar className="border-r border-border">
      <SidebarHeader className="border-b border-border p-4 bg-gradient-to-r from-purple-900/30 to-transparent">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-sm">スーパー管理</h2>
            <p className="text-xs text-muted-foreground">Super Admin</p>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>メニュー</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = location.pathname === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <NavLink to={item.url} className="flex items-center gap-2">
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink to="/super-admin/settings" className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                <span>システム設定</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink to="/admin" className="flex items-center gap-2 text-muted-foreground">
                <LogOut className="w-4 h-4" />
                <span>通常管理画面へ</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
