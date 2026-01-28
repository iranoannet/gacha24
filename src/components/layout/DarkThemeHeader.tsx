import { Bell, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface DarkThemeHeaderProps {
  showSidebarTrigger?: boolean;
}

const DarkThemeHeader = ({ showSidebarTrigger = false }: DarkThemeHeaderProps) => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { tenant, tenantSlug } = useTenant();

  const basePath = tenantSlug ? `/${tenantSlug}` : "";

  // Get user's tenant-specific profile (points balance)
  const { data: profile } = useQuery({
    queryKey: ["user-profile-header", user?.id, tenant?.id],
    queryFn: async () => {
      if (!user) return null;
      
      let query = supabase
        .from("profiles")
        .select("points_balance")
        .eq("user_id", user.id);
      
      if (tenant?.id) {
        query = query.eq("tenant_id", tenant.id);
      } else {
        query = query.is("tenant_id", null);
      }
      
      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
    refetchInterval: 5000,
  });

  const pointsBalance = profile?.points_balance ?? 0;

  return (
    <header className="sticky top-0 z-40 bg-[hsl(var(--dark-surface))] border-b border-[hsl(var(--dark-border))]">
      <div className="flex items-center justify-between h-14 px-4">
        {/* Left: Logo/Brand on mobile, Search on desktop */}
        <div className="flex items-center gap-4">
          {/* Mobile: Show tenant name/logo */}
          <button
            onClick={() => navigate(basePath || "/")}
            className="md:hidden flex items-center gap-2"
          >
            {tenant?.logo_url ? (
              <img 
                src={tenant.logo_url} 
                alt={tenant.name} 
                className="h-7 w-7 rounded object-contain"
              />
            ) : (
              <span className="text-lg font-bold text-[hsl(var(--dark-neon-primary))]">
                {tenant?.name || "Gacha"}
              </span>
            )}
          </button>

          {/* Search Bar - desktop only */}
          <div className="hidden md:flex items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--dark-muted))]" />
              <Input
                type="search"
                placeholder="Search gacha..."
                className="w-64 pl-10 bg-[hsl(var(--dark-input))] border-[hsl(var(--dark-border))] text-[hsl(var(--dark-foreground))] placeholder:text-[hsl(var(--dark-muted))] focus:border-[hsl(var(--dark-neon-primary))] focus:ring-[hsl(var(--dark-neon-primary)/0.3)]"
              />
            </div>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {user ? (
            <>
              {/* Points Display */}
              <button
                onClick={() => navigate(`${basePath}/points`)}
                className={cn(
                  "flex items-center gap-1 px-3 py-1.5 rounded-full font-bold text-xs sm:text-sm",
                  "bg-gradient-to-r from-[hsl(var(--dark-neon-primary))] to-[hsl(var(--dark-neon-secondary))]",
                  "text-[hsl(var(--dark-background))] shadow-[0_0_15px_hsl(var(--dark-neon-primary)/0.4)]",
                  "hover:shadow-[0_0_25px_hsl(var(--dark-neon-primary)/0.6)] transition-shadow"
                )}
              >
                <span className="text-[10px] opacity-80">JP¥</span>
                <span>{pointsBalance.toLocaleString()}</span>
              </button>

              {/* Notifications */}
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 sm:h-9 sm:w-9 p-0 rounded-full relative text-[hsl(var(--dark-foreground))] hover:bg-[hsl(var(--dark-hover))] hover:text-[hsl(var(--dark-neon-primary))]"
                onClick={() => navigate(`${basePath}/notifications`)}
              >
                <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 sm:h-4 sm:w-4 rounded-full bg-[hsl(var(--dark-neon-accent))] text-[9px] sm:text-[10px] font-bold text-white flex items-center justify-center shadow-[0_0_8px_hsl(var(--dark-neon-accent)/0.6)]">
                  3
                </span>
              </Button>
            </>
          ) : !loading ? (
            <>
              {/* Sign Up Button */}
              <Button
                size="sm"
                className={cn(
                  "h-8 px-3 text-xs sm:h-9 sm:px-4 sm:text-sm font-bold rounded-lg",
                  "bg-gradient-to-r from-[hsl(var(--dark-neon-primary))] to-[hsl(var(--dark-neon-secondary))]",
                  "text-[hsl(var(--dark-background))] shadow-[0_0_15px_hsl(var(--dark-neon-primary)/0.4)]",
                  "hover:shadow-[0_0_25px_hsl(var(--dark-neon-primary)/0.6)] transition-shadow"
                )}
                onClick={() => navigate(`${basePath}/auth?mode=signup`)}
              >
                Sign Up
              </Button>

              {/* Login Button */}
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-3 text-xs sm:h-9 sm:px-4 sm:text-sm font-medium rounded-lg border-[hsl(var(--dark-neon-primary))] text-[hsl(var(--dark-neon-primary))] bg-transparent hover:bg-[hsl(var(--dark-neon-primary)/0.1)]"
                onClick={() => navigate(`${basePath}/auth?mode=login`)}
              >
                Login
              </Button>
            </>
          ) : (
            <span className="text-xs text-[hsl(var(--dark-muted))]">Loading...</span>
          )}
        </div>
      </div>
    </header>
  );
};

export default DarkThemeHeader;
