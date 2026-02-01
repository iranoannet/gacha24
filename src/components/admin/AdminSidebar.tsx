import { NavLink, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  Package, 
  Layers, 
  Truck, 
  Users, 
  BarChart3,
  LogOut,
  Settings,
  Database,
  CreditCard,
  Image,
  Shield,
  Upload
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
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";

const menuItems = [
  { title: "ダッシュボード", url: "/admin", icon: LayoutDashboard },
  { title: "商品マスタ", url: "/admin/cards", icon: Database },
  { title: "ガチャ管理", url: "/admin/gachas", icon: Package },
  { title: "スロット編集", url: "/admin/slots", icon: Layers },
  { title: "バナー管理", url: "/admin/banners", icon: Image },
  { title: "配送管理", url: "/admin/shipping", icon: Truck },
  { title: "決済管理", url: "/admin/payments", icon: CreditCard },
  { title: "ユーザー管理", url: "/admin/users", icon: Users },
  { title: "売上分析", url: "/admin/analytics", icon: BarChart3 },
  { title: "ユーザー移行", url: "/admin/migration", icon: Upload },
];

export function AdminSidebar() {
  const location = useLocation();
  const { isSuperAdmin } = useAuth();
  const { tenantSlug } = useTenant();

  // Generate tenant-aware URLs
  const getAdminUrl = (path: string) => {
    if (tenantSlug) {
      return `/${tenantSlug}${path}`;
    }
    return path;
  };

  return (
    <Sidebar className="border-r border-border">
      <SidebarHeader className="border-b border-border p-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Package className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="font-bold text-sm">管理画面</h2>
            <p className="text-xs text-muted-foreground">Admin Dashboard</p>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>メニュー</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const url = getAdminUrl(item.url);
                const isActive = location.pathname === url || 
                  (tenantSlug && location.pathname === `/${tenantSlug}${item.url}`);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <NavLink to={url} className="flex items-center gap-2">
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
          {isSuperAdmin && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <NavLink to="/super-admin" className="flex items-center gap-2 text-purple-400 hover:text-purple-300">
                  <Shield className="w-4 h-4" />
                  <span>スーパー管理</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink to={getAdminUrl("/admin/settings")} className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                <span>設定</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink to={tenantSlug ? `/${tenantSlug}` : "/"} className="flex items-center gap-2 text-muted-foreground">
                <LogOut className="w-4 h-4" />
                <span>サイトに戻る</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
