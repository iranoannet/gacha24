import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Column indices for userpoint_trigger_histories CSV (0-indexed)
// id(0), user_id(1), old_point(2), new_point(3), created(4), modified(5)
const COLUMN_MAP = {
  id: 0,
  user_id: 1,
  old_point: 2,
  new_point: 3,
  created: 4,
  modified: 5,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

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
      console.error("Auth error:", authError);
      return new Response(JSON.stringify({ error: "認証エラー" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create user-context client for RPC calls
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

    const { tenant_id, csv_data } = await req.json();

    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!csv_data) {
      return new Response(JSON.stringify({ error: "csv_data is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build legacy_user_id to user_id mapping from profiles
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("user_id, id")
      .eq("tenant_id", tenant_id);

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      return new Response(JSON.stringify({ error: "プロファイルの取得に失敗しました" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get legacy_user_id mapping from user_migrations
    const { data: migrations, error: migrationsError } = await supabaseAdmin
      .from("user_migrations")
      .select("legacy_user_id, email")
      .eq("tenant_id", tenant_id)
      .not("legacy_user_id", "is", null);

    if (migrationsError) {
      console.error("Error fetching migrations:", migrationsError);
    }

    // Build email to profile mapping
    const { data: profilesWithEmail, error: profileEmailError } = await supabaseAdmin
      .from("profiles")
      .select("user_id, email")
      .eq("tenant_id", tenant_id)
      .not("email", "is", null);

    // Create legacy_user_id -> user_id map
    const legacyToUserMap = new Map<number, string>();
    if (migrations && profilesWithEmail) {
      const emailToUserId = new Map<string, string>();
      for (const p of profilesWithEmail) {
        if (p.email) {
          emailToUserId.set(p.email.toLowerCase(), p.user_id);
        }
      }
      for (const m of migrations) {
        if (m.legacy_user_id && m.email) {
          const userId = emailToUserId.get(m.email.toLowerCase());
          if (userId) {
            legacyToUserMap.set(m.legacy_user_id, userId);
          }
        }
      }
    }

    console.log(`Built legacy user mapping: ${legacyToUserMap.size} mappings`);

    // Parse CSV
    const lines = csv_data.trim().split("\n").filter((line: string) => line.trim());
    let totalLines = lines.length;
    let dataStartIndex = 0;

    // Check for header row
    const firstLine = lines[0].toLowerCase();
    if (firstLine.includes("user_id") || firstLine.includes("old_point") || firstLine.includes("new_point")) {
      dataStartIndex = 1;
      totalLines = lines.length - 1;
    }

    console.log(`Processing ${totalLines} lines (hasHeader: ${dataStartIndex === 1})`);

    const conversionRecords: any[] = [];
    let skippedNoUser = 0;
    let skippedNotConversion = 0;

    for (let i = dataStartIndex; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      
      const legacyId = parseInt(cleanValue(values[COLUMN_MAP.id]) || "0", 10);
      const legacyUserId = parseInt(cleanValue(values[COLUMN_MAP.user_id]) || "0", 10);
      const oldPoint = parseInt(cleanValue(values[COLUMN_MAP.old_point]) || "0", 10);
      const newPoint = parseInt(cleanValue(values[COLUMN_MAP.new_point]) || "0", 10);
      const created = cleanValue(values[COLUMN_MAP.created]);

      // Only import conversions (points increased)
      if (newPoint <= oldPoint) {
        skippedNotConversion++;
        continue;
      }

      const userId = legacyToUserMap.get(legacyUserId);
      if (!userId) {
        skippedNoUser++;
        continue;
      }

      const convertedPoints = newPoint - oldPoint;

      conversionRecords.push({
        user_id: userId,
        tenant_id,
        action_type: "conversion",
        converted_points: convertedPoints,
        status: "completed",
        requested_at: created ? new Date(created).toISOString() : new Date().toISOString(),
        processed_at: created ? new Date(created).toISOString() : new Date().toISOString(),
        legacy_id: legacyId,
      });
    }

    console.log(`Found ${conversionRecords.length} conversion records (skipped: ${skippedNoUser} no user, ${skippedNotConversion} not conversion)`);

    // Deduplicate by legacy_id
    const legacyIdMap = new Map<number, any>();
    for (const record of conversionRecords) {
      legacyIdMap.set(record.legacy_id, record);
    }
    const uniqueRecords = Array.from(legacyIdMap.values());
    const duplicatesRemoved = conversionRecords.length - uniqueRecords.length;

    // Batch insert with upsert
    const BATCH_SIZE = 500;
    let inserted = 0;
    const errors: string[] = [];

    for (let i = 0; i < uniqueRecords.length; i += BATCH_SIZE) {
      const batch = uniqueRecords.slice(i, i + BATCH_SIZE);

      const { data, error } = await supabaseAdmin
        .from("inventory_actions")
        .upsert(batch, { 
          onConflict: "legacy_id,tenant_id",
          ignoreDuplicates: false 
        })
        .select("id");

      if (error) {
        console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} error:`, error);
        errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
      } else {
        inserted += data?.length || 0;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_lines: totalLines,
        conversion_records: conversionRecords.length,
        unique_records: uniqueRecords.length,
        duplicates_in_file: duplicatesRemoved,
        skipped_no_user: skippedNoUser,
        skipped_not_conversion: skippedNotConversion,
        inserted,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Import error:", error);
    const message = error instanceof Error ? error.message : "インポートエラー";
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function cleanValue(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const cleaned = value.trim().replace(/^"|"$/g, "");
  if (cleaned === "" || cleaned === "NULL" || cleaned === "null") {
    return undefined;
  }
  return cleaned;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  
  return result;
}
