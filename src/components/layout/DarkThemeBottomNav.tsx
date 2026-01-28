import { useLocation, useNavigate } from "react-router-dom";
import { Home, Gift, History, User, CreditCard } from "lucide-react";
import { useTenant } from "@/hooks/useTenant";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/", icon: Home, label: "Home" },
  { path: "/inventory", icon: Gift, label: "Inventory" },
  { path: "/points", icon: CreditCard, label: "Points" },
  { path: "/history", icon: History, label: "History" },
  { path: "/mypage", icon: User, label: "My Page" },
];

const DarkThemeBottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { tenantSlug } = useTenant();

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
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[hsl(var(--dark-surface))] border-t border-[hsl(var(--dark-border))] safe-area-bottom">
      <div className="grid grid-cols-5 max-w-lg mx-auto">
        {navItems.map((item) => {
          const active = isActive(item.path);
          const Icon = item.icon;
          
          return (
            <button
              key={item.path}
              onClick={() => handleNavigation(item.path)}
              className={cn(
                "flex flex-col items-center justify-center py-2 px-1 transition-colors",
                active 
                  ? "text-[hsl(var(--dark-neon-primary))]" 
                  : "text-[hsl(var(--dark-muted))] hover:text-[hsl(var(--dark-foreground))]"
              )}
            >
              <div className={cn(
                "p-1.5 rounded-lg mb-0.5 transition-all",
                active && "bg-[hsl(var(--dark-neon-primary)/0.15)]"
              )}>
                <Icon className={cn(
                  "h-5 w-5",
                  active && "drop-shadow-[0_0_6px_hsl(var(--dark-neon-primary))]"
                )} />
              </div>
              <span className={cn(
                "text-[10px] font-medium",
                active && "text-[hsl(var(--dark-neon-primary))]"
              )}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default DarkThemeBottomNav;
