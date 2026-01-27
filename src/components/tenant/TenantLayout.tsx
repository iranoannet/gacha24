import { ReactNode } from "react";
import { useTenant } from "@/hooks/useTenant";
import { Loader2 } from "lucide-react";
import { useLocation } from "react-router-dom";

interface TenantLayoutProps {
  children: ReactNode;
}

/**
 * Wrapper component that applies tenant-specific branding
 */
export function TenantLayout({ children }: TenantLayoutProps) {
  const { tenant, loading, error, tenantSlug } = useTenant();
  const location = useLocation();

  // Check if we're on an admin route - admin routes should work without a tenant
  const isAdminRoute = location.pathname.includes("/admin");

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Only show error for non-admin routes when tenant is expected but not found
  // Admin routes should work even without a tenant context
  if (error && tenantSlug && !isAdminRoute) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-destructive">エラー</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  // Apply tenant-specific CSS variables if tenant exists
  const tenantStyles = tenant?.primary_color
    ? {
        "--tenant-primary": tenant.primary_color,
      } as React.CSSProperties
    : {};

  return (
    <div style={tenantStyles}>
      {children}
    </div>
  );
}
