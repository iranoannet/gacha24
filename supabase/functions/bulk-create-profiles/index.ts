import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Build email -> user_id mapping from all auth users
// deno-lint-ignore no-explicit-any
async function buildAuthUserCache(supabaseAdmin: any) {
  const emailToUserId = new Map<string, string>();
  let page = 1;
  
  while (page <= 100) { // Safety limit
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: 1000
    });
    
    if (error) {
      console.error(`Error listing auth users page ${page}:`, error);
      break;
    }
    
    if (!data?.users || data.users.length === 0) break;
    
    for (const u of data.users) {
      if (u.email) {
        emailToUserId.set(u.email.toLowerCase(), u.id);
      }
    }
    
    console.log(`Loaded ${emailToUserId.size} auth users (page ${page})`);
    
    if (data.users.length < 1000) break;
    page++;
  }
  
  return emailToUserId;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Verify admin access
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "認証が必要です" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "認証エラー" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: isAdmin } = await supabaseUser.rpc("is_admin");
    const { data: isSuperAdmin } = await supabaseUser.rpc("is_super_admin");
    
    if (!isAdmin && !isSuperAdmin) {
      return new Response(JSON.stringify({ error: "管理者権限が必要です" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { tenant_id, limit = 100 } = await req.json();

    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Starting bulk profile creation for tenant: ${tenant_id}, limit: ${limit}`);

    // Step 1: Build auth user cache
    console.log("Building auth user cache...");
    const authUserCache = await buildAuthUserCache(supabaseAdmin);
    console.log(`Auth user cache built with ${authUserCache.size} users`);

    // Step 2: Get total count of unapplied migrations
    const { count: totalUnapplied } = await supabaseAdmin
      .from("user_migrations")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenant_id)
      .eq("is_applied", false);

    // Step 3: Get batch of unapplied user_migrations
    const { data: migrations, error: migError } = await supabaseAdmin
      .from("user_migrations")
      .select("*")
      .eq("tenant_id", tenant_id)
      .eq("is_applied", false)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (migError) {
      throw new Error(`Failed to fetch migrations: ${migError.message}`);
    }

    console.log(`Processing ${migrations?.length || 0} migration records (total unapplied: ${totalUnapplied})`);

    if (!migrations || migrations.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: "No unapplied migrations to process",
        total_remaining: 0,
        processed: 0,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 4: Get existing profiles for this tenant
    const { data: existingProfiles } = await supabaseAdmin
      .from("profiles")
      .select("email, user_id")
      .eq("tenant_id", tenant_id);

    const existingProfileEmails = new Set<string>();
    const existingProfileUserIds = new Set<string>();
    existingProfiles?.forEach(p => {
      if (p.email) existingProfileEmails.add(p.email.toLowerCase());
      existingProfileUserIds.add(p.user_id);
    });

    let authUsersCreated = 0;
    let profilesCreated = 0;
    let skippedExisting = 0;
    let errors: string[] = [];
    const processedIds: string[] = [];

    for (const mig of migrations) {
      const emailLower = mig.email.toLowerCase();

      // Skip if profile already exists for this email
      if (existingProfileEmails.has(emailLower)) {
        processedIds.push(mig.id);
        skippedExisting++;
        continue;
      }

      try {
        // Check if auth user exists in cache
        let userId = authUserCache.get(emailLower);

        if (!userId) {
          // Create new auth user
          const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email: mig.email,
            email_confirm: true,
            user_metadata: {
              tenant_id: tenant_id,
              migrated_from_legacy: true,
              legacy_user_id: mig.legacy_user_id
            }
          });

          if (createError) {
            if (createError.message.includes("already been registered")) {
              // This shouldn't happen if cache is complete, but handle it
              errors.push(`${mig.email}: Auth user exists but not in cache`);
              processedIds.push(mig.id);
              continue;
            } else {
              errors.push(`${mig.email}: ${createError.message}`);
              continue;
            }
          }

          userId = newUser.user.id;
          authUsersCreated++;
          authUserCache.set(emailLower, userId); // Add to cache
        }

        // Check if profile already exists for this user_id
        if (existingProfileUserIds.has(userId)) {
          processedIds.push(mig.id);
          skippedExisting++;
          continue;
        }

        // Create profile
        const { error: profileError } = await supabaseAdmin
          .from("profiles")
          .insert({
            user_id: userId,
            tenant_id: tenant_id,
            email: mig.email,
            display_name: mig.display_name,
            first_name: mig.first_name,
            last_name: mig.last_name,
            phone_number: mig.phone_number,
            postal_code: mig.postal_code,
            prefecture: mig.prefecture,
            city: mig.city,
            address_line1: mig.address_line1,
            address_line2: mig.address_line2,
            points_balance: mig.points_balance || 0,
          });

        if (profileError) {
          if (profileError.message.includes("duplicate")) {
            skippedExisting++;
            processedIds.push(mig.id);
          } else {
            errors.push(`Profile ${mig.email}: ${profileError.message}`);
          }
          continue;
        }

        profilesCreated++;
        processedIds.push(mig.id);
        existingProfileEmails.add(emailLower);
        existingProfileUserIds.add(userId);

      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`${mig.email}: ${message}`);
      }
    }

    // Mark processed migrations as applied
    if (processedIds.length > 0) {
      await supabaseAdmin
        .from("user_migrations")
        .update({ is_applied: true })
        .in("id", processedIds);
    }

    const remaining = (totalUnapplied || 0) - processedIds.length;

    const result = {
      success: true,
      total_remaining: remaining,
      processed: migrations.length,
      marked_applied: processedIds.length,
      auth_users_created: authUsersCreated,
      profiles_created: profilesCreated,
      skipped_existing: skippedExisting,
      errors: errors.length > 0 ? errors.slice(0, 20) : undefined,
      error_count: errors.length,
      has_more: remaining > 0,
    };

    console.log("Batch complete:", result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("Bulk profile creation error:", error);
    const message = error instanceof Error ? error.message : "プロファイル一括作成エラー";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
