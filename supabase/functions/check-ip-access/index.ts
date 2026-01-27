import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get client IP from various headers (Cloudflare, proxies, direct)
    const clientIP = 
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";

    console.log("[check-ip-access] Client IP:", clientIP);

    const { tenantSlug } = await req.json();

    if (!tenantSlug) {
      return new Response(
        JSON.stringify({ allowed: true, ip: clientIP }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with service role for bypassing RLS
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get tenant's allowed IPs
    const { data: tenant, error } = await supabaseAdmin
      .from("tenants")
      .select("id, name, allowed_ips")
      .eq("slug", tenantSlug)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      console.error("[check-ip-access] Error fetching tenant:", error);
      return new Response(
        JSON.stringify({ allowed: true, ip: clientIP, error: "DB error" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!tenant) {
      console.log("[check-ip-access] Tenant not found:", tenantSlug);
      return new Response(
        JSON.stringify({ allowed: true, ip: clientIP, reason: "tenant_not_found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If allowed_ips is NULL, no restriction
    if (tenant.allowed_ips === null) {
      console.log("[check-ip-access] No IP restriction for tenant:", tenantSlug);
      return new Response(
        JSON.stringify({ allowed: true, ip: clientIP }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If allowed_ips is an empty array, block all access
    if (Array.isArray(tenant.allowed_ips) && tenant.allowed_ips.length === 0) {
      console.log("[check-ip-access] All access blocked for tenant:", tenantSlug);
      return new Response(
        JSON.stringify({ allowed: false, ip: clientIP, reason: "all_blocked" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if client IP is in the allowed list
    const isAllowed = tenant.allowed_ips.includes(clientIP);
    console.log("[check-ip-access] IP check result:", { tenantSlug, clientIP, isAllowed, allowed_ips: tenant.allowed_ips });

    return new Response(
      JSON.stringify({ 
        allowed: isAllowed, 
        ip: clientIP,
        reason: isAllowed ? undefined : "ip_not_allowed"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[check-ip-access] Error:", error);
    return new Response(
      JSON.stringify({ allowed: true, error: "Internal error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
