import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Legacy user_histories format: id,pack_id,user_id,point,created,modified
interface LegacyTransactionRecord {
  id: number;
  pack_id: number;
  user_id: number;  // legacy user ID
  point: number;
  created: string;
  modified: string;
}

// Email-based format
interface EmailTransactionRecord {
  user_email: string;
  gacha_title?: string;
  play_count?: number;
  total_spent_points?: number;
  created_at?: string;
  legacy_transaction_id?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    // deno-lint-ignore no-explicit-any
    const supabaseAdmin: any = createClient(supabaseUrl, supabaseServiceKey);

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

    // Detect CSV format: legacy (user_histories) or email-based
    const firstLine = csv_data.trim().split("\n")[0]?.toLowerCase() || "";
    const isLegacyFormat = firstLine.includes("pack_id") || 
      (firstLine.includes("user_id") && !firstLine.includes("email") && firstLine.includes("point"));

    console.log(`Detected format: ${isLegacyFormat ? "legacy (user_histories)" : "email-based"}`);

    if (isLegacyFormat) {
      return await handleLegacyImport(supabaseAdmin, tenant_id, csv_data);
    } else {
      return await handleEmailBasedImport(supabaseAdmin, tenant_id, csv_data);
    }
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

// Handle legacy user_histories format (uses legacy user_id)
// deno-lint-ignore no-explicit-any
async function handleLegacyImport(supabaseAdmin: any, tenant_id: string, csv_data: string) {
  // Build mapping: legacy_user_id -> actual user_id via user_migrations
  const { data: migrationsWithEmail } = await supabaseAdmin
    .from("user_migrations")
    .select("legacy_user_id, email")
    .eq("tenant_id", tenant_id);

  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("user_id, email")
    .eq("tenant_id", tenant_id);

  const emailToUserId = new Map<string, string>();
  // deno-lint-ignore no-explicit-any
  profiles?.forEach((p: any) => {
    if (p.email) emailToUserId.set(p.email.toLowerCase(), p.user_id);
  });

  const legacyUserIdToUserId = new Map<number, string>();
  // deno-lint-ignore no-explicit-any
  migrationsWithEmail?.forEach((m: any) => {
    if (m.legacy_user_id && m.email) {
      const userId = emailToUserId.get(m.email.toLowerCase());
      if (userId) {
        legacyUserIdToUserId.set(m.legacy_user_id, userId);
      }
    }
  });

  console.log(`Built legacy user mapping: ${legacyUserIdToUserId.size} users`);

  // Parse CSV
  const lines = csv_data.trim().split("\n").filter((line: string) => line.trim());
  const records: LegacyTransactionRecord[] = [];
  
  const firstLine = lines[0]?.toLowerCase() || "";
  const hasHeaders = firstLine.includes("pack_id") || firstLine.includes("user_id");
  const startIndex = hasHeaders ? 1 : 0;
  
  for (let i = startIndex; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    
    // Format: id,pack_id,user_id,point,created,modified
    const id = parseInt(values[0]) || 0;
    const pack_id = parseInt(values[1]) || 0;
    const user_id = parseInt(values[2]) || 0;
    const point = parseInt(values[3]) || 0;
    const created = cleanValue(values[4]) || "";
    const modified = cleanValue(values[5]) || "";
    
    if (id > 0 && user_id > 0) {
      records.push({ id, pack_id, user_id, point, created, modified });
    }
  }

  console.log(`Processing ${records.length} legacy transaction records`);

  let inserted = 0;
  let skipped = 0;
  let userNotFound = 0;
  const errors: string[] = [];

  const BATCH_SIZE = 100;
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const toInsert = [];
    
    for (const record of batch) {
      const userId = legacyUserIdToUserId.get(record.user_id);
      if (!userId) {
        userNotFound++;
        continue;
      }

      toInsert.push({
        user_id: userId,
        gacha_id: null, // Legacy doesn't have direct gacha mapping
        tenant_id,
        play_count: 1,
        total_spent_points: record.point,
        status: "completed",
        result_items: [],
        created_at: parseDate(record.created),
      });
    }

    if (toInsert.length > 0) {
      // Check for existing similar transactions in batch
      const existingChecks = await Promise.all(
        toInsert.map(async (item) => {
          const { data } = await supabaseAdmin
            .from("user_transactions")
            .select("id")
            .eq("user_id", item.user_id)
            .eq("tenant_id", tenant_id)
            .eq("total_spent_points", item.total_spent_points)
            .eq("created_at", item.created_at)
            .limit(1);
          return data && data.length > 0;
        })
      );

      const newItems = toInsert.filter((_, idx) => !existingChecks[idx]);
      const skippedCount = toInsert.length - newItems.length;
      skipped += skippedCount;

      if (newItems.length > 0) {
        const { data, error } = await supabaseAdmin
          .from("user_transactions")
          .insert(newItems)
          .select("id");
        
        if (error) {
          errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
        } else {
          inserted += data?.length || 0;
        }
      }
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      format: "legacy",
      total_records: records.length,
      inserted,
      skipped,
      user_not_found: userNotFound,
      errors: errors.length > 0 ? errors : undefined,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

// Handle email-based format (original)
// deno-lint-ignore no-explicit-any
async function handleEmailBasedImport(supabaseAdmin: any, tenant_id: string, csv_data: string) {
  // Fetch existing profiles for user lookup
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("user_id, email")
    .eq("tenant_id", tenant_id);
  
  const emailToUserId = new Map<string, string>();
  // deno-lint-ignore no-explicit-any
  profiles?.forEach((p: any) => {
    if (p.email) emailToUserId.set(p.email.toLowerCase(), p.user_id);
  });

  // Fetch existing gachas for lookup
  const { data: gachas } = await supabaseAdmin
    .from("gacha_masters")
    .select("id, title")
    .eq("tenant_id", tenant_id);
  
  const titleToGachaId = new Map<string, string>();
  // deno-lint-ignore no-explicit-any
  gachas?.forEach((g: any) => titleToGachaId.set(g.title.toLowerCase(), g.id));

  // Parse CSV
  const lines = csv_data.trim().split("\n").filter((line: string) => line.trim());
  const records: EmailTransactionRecord[] = [];
  
  const firstLine = lines[0]?.toLowerCase() || "";
  const hasHeaders = firstLine.includes("email") || firstLine.includes("user");
  
  const startIndex = hasHeaders ? 1 : 0;
  
  for (let i = startIndex; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    
    if (hasHeaders) {
      const headers = parseCSVLine(lines[0]).map((h: string) => h.toLowerCase().trim());
      const record: EmailTransactionRecord = { user_email: "" };
      
      headers.forEach((header: string, idx: number) => {
        const value = cleanValue(values[idx]);
        if (!value) return;
        
        if (header.includes("email") || header.includes("メール")) {
          record.user_email = value;
        } else if (header.includes("gacha") || header.includes("ガチャ") || header.includes("pack")) {
          record.gacha_title = value;
        } else if (header.includes("play") || header.includes("回数")) {
          record.play_count = parseInt(value) || 1;
        } else if (header.includes("point") || header.includes("ポイント") || header.includes("spent")) {
          record.total_spent_points = parseInt(value.replace(/,/g, "")) || 0;
        } else if (header.includes("date") || header.includes("日時") || header.includes("created")) {
          record.created_at = value;
        } else if (header.includes("legacy") || header.includes("id")) {
          record.legacy_transaction_id = value;
        }
      });
      
      if (record.user_email) records.push(record);
    } else {
      const email = cleanValue(values[0]);
      if (email) {
        records.push({
          user_email: email,
          gacha_title: cleanValue(values[1]),
          play_count: parseInt(cleanValue(values[2]) || "1") || 1,
          total_spent_points: parseInt((cleanValue(values[3]) || "0").replace(/,/g, "")) || 0,
          created_at: cleanValue(values[4]),
        });
      }
    }
  }

  console.log(`Processing ${records.length} email-based transaction records`);

  let inserted = 0;
  let skipped = 0;
  let userNotFound = 0;
  const errors: string[] = [];

  const BATCH_SIZE = 100;
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const toInsert = [];
    
    for (const record of batch) {
      const userId = emailToUserId.get(record.user_email.toLowerCase());
      if (!userId) {
        userNotFound++;
        continue;
      }
      
      const gachaId = record.gacha_title 
        ? titleToGachaId.get(record.gacha_title.toLowerCase()) 
        : null;

      toInsert.push({
        user_id: userId,
        gacha_id: gachaId,
        tenant_id,
        play_count: record.play_count || 1,
        total_spent_points: record.total_spent_points || 0,
        status: "completed",
        result_items: [],
        created_at: record.created_at || new Date().toISOString(),
      });
    }

    if (toInsert.length > 0) {
      const existingChecks = await Promise.all(
        toInsert.map(async (item) => {
          const { data } = await supabaseAdmin
            .from("user_transactions")
            .select("id")
            .eq("user_id", item.user_id)
            .eq("tenant_id", tenant_id)
            .eq("total_spent_points", item.total_spent_points)
            .eq("created_at", item.created_at)
            .limit(1);
          return data && data.length > 0;
        })
      );

      const newItems = toInsert.filter((_, idx) => !existingChecks[idx]);
      const skippedCount = toInsert.length - newItems.length;
      skipped += skippedCount;

      if (newItems.length > 0) {
        const { data, error } = await supabaseAdmin
          .from("user_transactions")
          .insert(newItems)
          .select("id");
        
        if (error) {
          errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
        } else {
          inserted += data?.length || 0;
        }
      }
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      format: "email",
      total_records: records.length,
      inserted,
      skipped,
      user_not_found: userNotFound,
      errors: errors.length > 0 ? errors : undefined,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

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
