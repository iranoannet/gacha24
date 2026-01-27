import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
  custom_domain: string | null;
  is_active: boolean;
}

interface TenantContextType {
  tenant: Tenant | null;
  tenantSlug: string | null;
  loading: boolean;
  error: string | null;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

/**
 * Extracts tenant slug from the current URL
 * Supports:
 * 1. Path-based: gacha24.lovable.app/ginga → "ginga"
 * 2. Custom domain: www.ginga-gacha.com → looks up by custom_domain
 * 3. Subdomain: ginga.gacha24.lovable.app → "ginga" (future)
 */
function getTenantIdentifier(): { type: "path" | "domain" | "subdomain"; value: string } | null {
  const hostname = window.location.hostname;
  const pathname = window.location.pathname;

  // Check for path-based routing: /tenantSlug/...
  const pathMatch = pathname.match(/^\/([a-z0-9-]+)(\/|$)/);
  if (pathMatch) {
    const slug = pathMatch[1];
    // Exclude known routes that are not tenant slugs
    const excludedPaths = [
      "admin", "super-admin", "auth", "mypage", "privacy", "legal", 
      "terms", "faq", "notifications", "points", "inventory", "history",
      "reports", "gacha"
    ];
    if (!excludedPaths.includes(slug)) {
      return { type: "path", value: slug };
    }
  }

  // Check for custom domain (not lovable.app or localhost)
  if (!hostname.includes("lovable.app") && !hostname.includes("localhost")) {
    return { type: "domain", value: hostname };
  }

  // Check for subdomain: ginga.gacha24.lovable.app
  const subdomainMatch = hostname.match(/^([a-z0-9-]+)\..*\.lovable\.app$/);
  if (subdomainMatch && subdomainMatch[1] !== "id-preview") {
    return { type: "subdomain", value: subdomainMatch[1] };
  }

  return null;
}

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [tenantSlug, setTenantSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTenant = async () => {
      try {
        const identifier = getTenantIdentifier();
        
        if (!identifier) {
          // No tenant identifier - use default/null tenant
          setTenantSlug(null);
          setTenant(null);
          setLoading(false);
          return;
        }

        setTenantSlug(identifier.value);

        let query = supabase.from("tenants").select("*");

        if (identifier.type === "path" || identifier.type === "subdomain") {
          query = query.eq("slug", identifier.value);
        } else if (identifier.type === "domain") {
          query = query.eq("custom_domain", identifier.value);
        }

        const { data, error: fetchError } = await query.maybeSingle();

        if (fetchError) {
          console.error("[Tenant] Error fetching tenant:", fetchError);
          setError("テナント情報の取得に失敗しました");
        } else if (!data) {
          setError("テナントが見つかりません");
        } else if (!data.is_active) {
          setError("このテナントは現在利用できません");
        } else {
          setTenant(data as Tenant);
        }
      } catch (err) {
        console.error("[Tenant] Unexpected error:", err);
        setError("予期せぬエラーが発生しました");
      } finally {
        setLoading(false);
      }
    };

    fetchTenant();
  }, []);

  return (
    <TenantContext.Provider value={{ tenant, tenantSlug, loading, error }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error("useTenant must be used within a TenantProvider");
  }
  return context;
}

/**
 * Utility to generate tenant-aware URLs
 */
export function useTenantUrl() {
  const { tenant, tenantSlug } = useTenant();

  const getUrl = (path: string) => {
    // If tenant has custom domain, use it
    if (tenant?.custom_domain) {
      return `https://${tenant.custom_domain}${path}`;
    }
    // Otherwise use path-based URL
    if (tenantSlug) {
      return `/${tenantSlug}${path}`;
    }
    return path;
  };

  return { getUrl };
}
