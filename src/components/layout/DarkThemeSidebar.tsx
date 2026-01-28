import { useLocation, useNavigate } from "react-router-dom";
import { Sparkles, Gift, History, MessageSquare, User, Home, CreditCard, HelpCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { useTenant } from "@/hooks/useTenant";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const mainNavItems = [
  { path: "/", icon: Sparkles, label: "オリパガチャ" },
  { path: "/inventory", icon: Gift, label: "獲得商品" },
  { path: "/history", icon: History, label: "当選履歴" },
  { path: "/reports", icon: MessageSquare, label: "当選報告" },
];

const accountNavItems = [
  { path: "/mypage", icon: User, label: "マイページ" },
  { path: "/points", icon: CreditCard, label: "ポイント購入" },
  { path: "/faq", icon: HelpCircle, label: "よくある質問" },
];

const DarkThemeSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { tenant, tenantSlug } = useTenant();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const basePath = tenantSlug ? `/${tenantSlug}` : "";

  const isActive = (path: string) => {
    const fullPath = basePath + path;
    if (path === "/") {
      return location.pathname === basePath || location.pathname === basePath + "/";
    }
    return location.pathname.startsWith(fullPath);
  };

  const handleNavigation = (path: string) => {
    navigate(basePath + path);
  };

  return (
    <Sidebar
      className={cn(
        "border-r border-[hsl(var(--dark-border))] bg-[hsl(var(--dark-surface))]",
        collapsed ? "w-16" : "w-64"
      )}
      collapsible="icon"
    >
      {/* Logo Area */}
      <div className="p-4 border-b border-[hsl(var(--dark-border))]">
        <button
          onClick={() => handleNavigation("/")}
          className="flex items-center gap-3 w-full"
        >
          {tenant?.logo_url ? (
            <img 
              src={tenant.logo_url} 
              alt={tenant.name} 
              className="h-8 w-8 rounded object-contain"
            />
          ) : (
            <div className="h-8 w-8 rounded bg-gradient-to-br from-[hsl(var(--dark-neon-primary))] to-[hsl(var(--dark-neon-secondary))] flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
          )}
          {!collapsed && (
            <span className="text-lg font-bold text-[hsl(var(--dark-foreground))] truncate">
              {tenant?.name || "ガチャ"}
            </span>
          )}
        </button>
      </div>

      <SidebarContent className="bg-[hsl(var(--dark-surface))]">
        {/* Main Navigation */}
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-[hsl(var(--dark-muted))] text-xs uppercase tracking-wider px-3">
              メニュー
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    onClick={() => handleNavigation(item.path)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all",
                      isActive(item.path)
                        ? "bg-[hsl(var(--dark-neon-primary)/0.15)] text-[hsl(var(--dark-neon-primary))] border-l-2 border-[hsl(var(--dark-neon-primary))]"
                        : "text-[hsl(var(--dark-foreground))] hover:bg-[hsl(var(--dark-hover))] hover:text-[hsl(var(--dark-neon-primary))]"
                    )}
                  >
                    <item.icon className={cn(
                      "h-5 w-5 flex-shrink-0",
                      isActive(item.path) && "drop-shadow-[0_0_8px_hsl(var(--dark-neon-primary))]"
                    )} />
                    {!collapsed && <span className="font-medium">{item.label}</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Account Navigation */}
        <SidebarGroup className="mt-4">
          {!collapsed && (
            <SidebarGroupLabel className="text-[hsl(var(--dark-muted))] text-xs uppercase tracking-wider px-3">
              アカウント
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {accountNavItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    onClick={() => handleNavigation(item.path)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all",
                      isActive(item.path)
                        ? "bg-[hsl(var(--dark-neon-primary)/0.15)] text-[hsl(var(--dark-neon-primary))] border-l-2 border-[hsl(var(--dark-neon-primary))]"
                        : "text-[hsl(var(--dark-foreground))] hover:bg-[hsl(var(--dark-hover))] hover:text-[hsl(var(--dark-neon-primary))]"
                    )}
                  >
                    <item.icon className={cn(
                      "h-5 w-5 flex-shrink-0",
                      isActive(item.path) && "drop-shadow-[0_0_8px_hsl(var(--dark-neon-primary))]"
                    )} />
                    {!collapsed && <span className="font-medium">{item.label}</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Collapse Toggle */}
      <div className="mt-auto p-2 border-t border-[hsl(var(--dark-border))]">
        <SidebarTrigger className="w-full flex items-center justify-center p-2 rounded-lg text-[hsl(var(--dark-muted))] hover:bg-[hsl(var(--dark-hover))] hover:text-[hsl(var(--dark-foreground))] transition-colors">
          {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </SidebarTrigger>
      </div>
    </Sidebar>
  );
};

export default DarkThemeSidebar;
