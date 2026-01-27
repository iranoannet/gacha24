import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "./useTenant";

/**
 * Hook to fetch gachas filtered by current tenant
 */
export function useTenantGachas(status?: "active" | "draft" | "sold_out" | "archived") {
  const { tenant, loading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: ["tenant-gachas", tenant?.id, status],
    queryFn: async () => {
      let query = supabase
        .from("gacha_masters")
        .select("*")
        .order("created_at", { ascending: false });

      // Filter by status if provided
      if (status) {
        query = query.eq("status", status);
      }

      // Filter by tenant_id
      if (tenant?.id) {
        query = query.eq("tenant_id", tenant.id);
      } else {
        // If no tenant context, show only null tenant_id (default/shared)
        query = query.is("tenant_id", null);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !tenantLoading,
  });
}

/**
 * Hook to fetch hero banners filtered by current tenant
 */
export function useTenantBanners() {
  const { tenant, loading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: ["tenant-banners", tenant?.id],
    queryFn: async () => {
      let query = supabase
        .from("hero_banners")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      // Filter by tenant_id
      if (tenant?.id) {
        query = query.eq("tenant_id", tenant.id);
      } else {
        query = query.is("tenant_id", null);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !tenantLoading,
  });
}

/**
 * Hook to fetch a single gacha by ID, respecting tenant context
 */
export function useTenantGacha(gachaId: string | undefined) {
  const { tenant, loading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: ["tenant-gacha", gachaId, tenant?.id],
    queryFn: async () => {
      if (!gachaId) return null;

      let query = supabase
        .from("gacha_masters")
        .select("*")
        .eq("id", gachaId);

      // Optionally validate tenant ownership
      // For now, we allow viewing any gacha but could restrict here

      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !tenantLoading && !!gachaId,
  });
}

/**
 * Hook to get tenant-aware query filters
 */
export function useTenantFilter() {
  const { tenant } = useTenant();

  const getTenantFilter = () => {
    if (tenant?.id) {
      return { column: "tenant_id", value: tenant.id };
    }
    return { column: "tenant_id", value: null, isNull: true };
  };

  const applyTenantFilter = (query: any) => {
    if (tenant?.id) {
      return query.eq("tenant_id", tenant.id);
    }
    return query.is("tenant_id", null);
  };

  return { tenant, getTenantFilter, applyTenantFilter };
}
