import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ShippingRecord {
  id: number;           // legacy row id
  card_id: number;      // legacy USER id
  pack_card_id: number; // legacy pack/card id
  num: number;
  comment: string;
  shire_state: number;  // 0=out of stock, 1=in stock
  status: number;       // 1=shipped
  created: string;      // requested_at
  modified: string;     // processed_at
}

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

    // Fetch user_migrations to map legacy user IDs to emails
    const { data: migrations } = await supabaseAdmin
      .from("user_migrations")
      .select("legacy_user_id, email")
      .eq("tenant_id", tenant_id);
    
    const legacyIdToEmail = new Map<number, string>();
    migrations?.forEach(m => {
      if (m.legacy_user_id) legacyIdToEmail.set(m.legacy_user_id, m.email);
    });

    // Fetch profiles to map emails to user_ids
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("user_id, email")
      .eq("tenant_id", tenant_id);
    
    const emailToUserId = new Map<string, string>();
    profiles?.forEach(p => {
      if (p.email) emailToUserId.set(p.email.toLowerCase(), p.user_id);
    });

    // Parse CSV
    const lines = csv_data.trim().split("\n").filter((line: string) => line.trim());
    const records: ShippingRecord[] = [];
    
    // Check for headers
    const firstLine = lines[0]?.toLowerCase() || "";
    const hasHeaders = firstLine.includes("id,") || firstLine.includes("card_id");
    const startIndex = hasHeaders ? 1 : 0;
    
    for (let i = startIndex; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      
      // CSV format: id,card_id,pack_card_id,num,comment,shire_state,status,created,modified
      const id = parseInt(values[0]) || 0;
      const card_id = parseInt(values[1]) || 0;
      const pack_card_id = parseInt(values[2]) || 0;
      const num = parseInt(values[3]) || 0;
      const comment = cleanValue(values[4]) || "";
      const shire_state = parseInt(values[5]) || 0;
      const status = parseInt(values[6]) || 0;
      const created = cleanValue(values[7]) || "";
      const modified = cleanValue(values[8]) || "";
      
      if (id > 0 && card_id > 0) {
        records.push({
          id,
          card_id,
          pack_card_id,
          num,
          comment,
          shire_state,
          status,
          created,
          modified,
        });
      }
    }

    console.log(`Processing ${records.length} shipping history records`);
    console.log(`Legacy user mappings available: ${legacyIdToEmail.size}`);
    console.log(`Profile mappings available: ${emailToUserId.size}`);

    // Insert inventory actions
    let inserted = 0;
    let skipped = 0;
    let userNotFound = 0;
    const errors: string[] = [];
    const failedRows: { row: number; legacy_user_id: number; reason: string }[] = [];

    const BATCH_SIZE = 500;
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      const toInsert = [];
      
      for (let j = 0; j < batch.length; j++) {
        const record = batch[j];
        const rowNumber = i + j + (hasHeaders ? 2 : 1); // 1-indexed, accounting for header
        
        // Find user by legacy card_id (which is the legacy user id)
        const email = legacyIdToEmail.get(record.card_id);
        if (!email) {
          userNotFound++;
          failedRows.push({ row: rowNumber, legacy_user_id: record.card_id, reason: "legacy_user_not_in_migrations" });
          continue;
        }
        
        const userId = emailToUserId.get(email.toLowerCase());
        if (!userId) {
          userNotFound++;
          failedRows.push({ row: rowNumber, legacy_user_id: record.card_id, reason: "user_not_logged_in_yet" });
          continue;
        }

        // Map status: 1 = shipped, 0 = pending
        const actionStatus = record.status === 1 ? "shipped" : "pending";

        toInsert.push({
          user_id: userId,
          tenant_id,
          action_type: "shipping",
          status: actionStatus,
          stock_status: record.shire_state,
          legacy_id: record.id,
          legacy_pack_card_id: record.pack_card_id,
          requested_at: parseDate(record.created),
          processed_at: record.status === 1 ? parseDate(record.modified) : null,
        });
      }

      if (toInsert.length > 0) {
        // Use upsert with legacy_id constraint for proper deduplication
        const { data, error } = await supabaseAdmin
          .from("inventory_actions")
          .upsert(toInsert, { 
            onConflict: "legacy_id,tenant_id",
            ignoreDuplicates: false 
          })
          .select("id");
        
        if (error) {
          errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
          skipped += toInsert.length;
        } else {
          inserted += data?.length || 0;
        }
      }
    }

    // Log sample of failed rows for debugging
    if (failedRows.length > 0) {
      console.log(`Failed rows sample (first 20): ${JSON.stringify(failedRows.slice(0, 20))}`);
      console.log(`Total user_not_found: ${userNotFound}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_records: records.length,
        inserted,
        skipped,
        user_not_found: userNotFound,
        errors: errors.length > 0 ? errors : undefined,
        failed_rows_sample: failedRows.slice(0, 50), // Return first 50 failed rows
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

function parseDate(dateStr: string | undefined): string {
  if (!dateStr) return new Date().toISOString();
  
  // Handle format: 2024-06-15 21:01:00
  try {
    const date = new Date(dateStr.replace(" ", "T") + "Z");
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  } catch {
    // Fall through
  }
  
  return new Date().toISOString();
}
