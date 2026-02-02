import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// pack_cards CSV format from legacy system
interface PackCardRecord {
  id: string;
  pack_id: string;
  card_id: string;
  user_id: string;
  num: string;
  price: string;
  sale_price: string;
  stock_sale_price: string;
  redemption_point: string;
  show_list: string;
  hit_count: string;
  order: string;
  attention_mode: string;
  action_type: string;
  status: string;
  created: string;
  modified: string;
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

    // Detect CSV format: pack_cards format or email-based format
    const firstLine = csv_data.trim().split("\n")[0]?.toLowerCase() || "";
    const isPackCardsFormat = firstLine.includes("pack_id") || firstLine.includes("redemption_point");

    if (isPackCardsFormat) {
      return await handlePackCardsImport(supabaseAdmin, tenant_id, csv_data);
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

// Handle pack_cards CSV format (legacy gachamo format)
// deno-lint-ignore no-explicit-any
async function handlePackCardsImport(
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: any,
  tenant_id: string,
  csv_data: string
) {
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
  const records: PackCardRecord[] = [];
  
  const firstLine = lines[0]?.toLowerCase() || "";
  const hasHeaders = firstLine.includes("pack_id") || firstLine.includes("card_id");
  
  const startIndex = hasHeaders ? 1 : 0;
  const headers = hasHeaders 
    ? parseCSVLine(lines[0]).map((h: string) => h.toLowerCase().trim())
    : ["id", "pack_id", "card_id", "user_id", "num", "price", "sale_price", "stock_sale_price", "redemption_point", "show_list", "hit_count", "order", "attention_mode", "action_type", "status", "created", "modified"];
  
  for (let i = startIndex; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const record: Record<string, string> = {};
    
    headers.forEach((header: string, idx: number) => {
      record[header] = cleanValue(values[idx]) || "";
    });
    
    records.push(record as unknown as PackCardRecord);
  }

  console.log(`Processing ${records.length} pack_card records`);

  let inserted = 0;
  let skipped = 0;
  let userNotFound = 0;
  let unsoldSkipped = 0;
  const errors: string[] = [];

  const BATCH_SIZE = 100;
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const toInsert = [];
    
    for (const record of batch) {
      const legacyUserId = parseInt(record.user_id);
      
      // Skip unsold items (user_id = 0)
      if (!legacyUserId || legacyUserId === 0) {
        unsoldSkipped++;
        continue;
      }

      const userId = legacyUserIdToUserId.get(legacyUserId);
      if (!userId) {
        userNotFound++;
        continue;
      }

      // Determine action type: status=1 -> shipping, status=0 -> conversion
      const status = parseInt(record.status);
      const actionType = status === 1 ? "shipping" : "conversion";
      
      // Calculate converted points for conversion actions
      const convertedPoints = actionType === "conversion" 
        ? parseInt(record.redemption_point) || 0 
        : null;

      toInsert.push({
        user_id: userId,
        tenant_id,
        action_type: actionType,
        status: "completed",
        legacy_id: parseInt(record.id) || null,
        legacy_pack_card_id: parseInt(record.id) || null,
        converted_points: convertedPoints,
        stock_status: parseInt(record.stock_sale_price) || 0,
        requested_at: record.created || new Date().toISOString(),
        processed_at: record.modified || new Date().toISOString(),
      });
    }

    if (toInsert.length > 0) {
      // Insert one by one to handle duplicates gracefully
      for (const item of toInsert) {
        // Check if already exists
        const { data: existing } = await supabaseAdmin
          .from("inventory_actions")
          .select("id")
          .eq("legacy_pack_card_id", item.legacy_pack_card_id)
          .eq("tenant_id", tenant_id)
          .maybeSingle();

        if (existing) {
          skipped++;
          continue;
        }

        const { error: insertError } = await supabaseAdmin
          .from("inventory_actions")
          .insert(item);
        
        if (insertError) {
          if (insertError.message.includes("duplicate") || insertError.message.includes("unique")) {
            skipped++;
          } else {
            errors.push(`Record ${item.legacy_pack_card_id}: ${insertError.message}`);
          }
        } else {
          inserted++;
        }
      }
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      format: "pack_cards",
      total_records: records.length,
      inserted,
      skipped,
      user_not_found: userNotFound,
      unsold_skipped: unsoldSkipped,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

// Handle email-based CSV format (original format)
// deno-lint-ignore no-explicit-any
async function handleEmailBasedImport(
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: any,
  tenant_id: string,
  csv_data: string
) {
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

  // Fetch existing cards for lookup
  const { data: cards } = await supabaseAdmin
    .from("cards")
    .select("id, name")
    .eq("tenant_id", tenant_id);
  
  const nameToCardId = new Map<string, string>();
  // deno-lint-ignore no-explicit-any
  cards?.forEach((c: any) => nameToCardId.set(c.name.toLowerCase(), c.id));

  // Parse CSV
  const lines = csv_data.trim().split("\n").filter((line: string) => line.trim());
  
  interface InventoryRecord {
    user_email: string;
    card_name?: string;
    action_type?: "shipping" | "conversion";
    status?: "pending" | "processing" | "completed" | "shipped";
    tracking_number?: string;
    converted_points?: number;
    requested_at?: string;
  }
  
  const records: InventoryRecord[] = [];
  
  const firstLine = lines[0]?.toLowerCase() || "";
  const hasHeaders = firstLine.includes("email") || firstLine.includes("user") || firstLine.includes("メール");
  
  const startIndex = hasHeaders ? 1 : 0;
  
  for (let i = startIndex; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    
    if (hasHeaders) {
      const headers = parseCSVLine(lines[0]).map((h: string) => h.toLowerCase().trim());
      const record: InventoryRecord = { user_email: "" };
      
      headers.forEach((header: string, idx: number) => {
        const value = cleanValue(values[idx]);
        if (!value) return;
        
        if (header.includes("email") || header.includes("メール")) {
          record.user_email = value;
        } else if (header.includes("card") || header.includes("カード") || header.includes("item")) {
          record.card_name = value;
        } else if (header.includes("type") || header.includes("タイプ") || header.includes("action")) {
          record.action_type = value.toLowerCase().includes("ship") ? "shipping" : "conversion";
        } else if (header.includes("status") || header.includes("ステータス")) {
          const statusMap: Record<string, InventoryRecord["status"]> = {
            "pending": "pending",
            "processing": "processing",
            "completed": "completed",
            "shipped": "shipped",
            "未処理": "pending",
            "処理中": "processing",
            "完了": "completed",
            "発送済": "shipped",
          };
          record.status = statusMap[value.toLowerCase()] || "pending";
        } else if (header.includes("tracking") || header.includes("追跡")) {
          record.tracking_number = value;
        } else if (header.includes("point") || header.includes("ポイント")) {
          record.converted_points = parseInt(value.replace(/,/g, "")) || 0;
        } else if (header.includes("date") || header.includes("日時") || header.includes("requested")) {
          record.requested_at = value;
        }
      });
      
      if (record.user_email) records.push(record);
    } else {
      const email = cleanValue(values[0]);
      if (email) {
        const actionValue = cleanValue(values[2]) || "";
        records.push({
          user_email: email,
          card_name: cleanValue(values[1]),
          action_type: actionValue.toLowerCase().includes("ship") ? "shipping" : "conversion",
          status: (cleanValue(values[3]) as InventoryRecord["status"]) || "pending",
          tracking_number: cleanValue(values[4]),
          converted_points: parseInt((cleanValue(values[5]) || "0").replace(/,/g, "")) || 0,
          requested_at: cleanValue(values[6]),
        });
      }
    }
  }

  console.log(`Processing ${records.length} inventory records`);

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
      
      const cardId = record.card_name 
        ? nameToCardId.get(record.card_name.toLowerCase()) 
        : null;

      toInsert.push({
        user_id: userId,
        card_id: cardId,
        tenant_id,
        action_type: record.action_type || "shipping",
        status: record.status || "pending",
        tracking_number: record.tracking_number,
        converted_points: record.converted_points,
        requested_at: record.requested_at || new Date().toISOString(),
      });
    }

    if (toInsert.length > 0) {
      const { data, error } = await supabaseAdmin
        .from("inventory_actions")
        .insert(toInsert)
        .select("id");
      
      if (error) {
        errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
        skipped += toInsert.length;
      } else {
        inserted += data?.length || 0;
      }
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      format: "email_based",
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
