import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InventoryRecord {
  user_email: string;
  card_name?: string;
  action_type?: "shipping" | "conversion";
  status?: "pending" | "processing" | "completed" | "shipped";
  tracking_number?: string;
  converted_points?: number;
  requested_at?: string;
  legacy_id?: string;
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

    // Fetch existing profiles for user lookup
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("user_id, email")
      .eq("tenant_id", tenant_id);
    
    const emailToUserId = new Map<string, string>();
    profiles?.forEach(p => {
      if (p.email) emailToUserId.set(p.email.toLowerCase(), p.user_id);
    });

    // Fetch existing cards for lookup
    const { data: cards } = await supabaseAdmin
      .from("cards")
      .select("id, name")
      .eq("tenant_id", tenant_id);
    
    const nameToCardId = new Map<string, string>();
    cards?.forEach(c => nameToCardId.set(c.name.toLowerCase(), c.id));

    // Parse CSV
    const lines = csv_data.trim().split("\n").filter((line: string) => line.trim());
    const records: InventoryRecord[] = [];
    
    // Check for headers
    const firstLine = lines[0]?.toLowerCase() || "";
    const hasHeaders = firstLine.includes("email") || firstLine.includes("user") || firstLine.includes("メール");
    
    const startIndex = hasHeaders ? 1 : 0;
    
    for (let i = startIndex; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      
      if (hasHeaders) {
        const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
        const record: InventoryRecord = { user_email: "" };
        
        headers.forEach((header, idx) => {
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
        // Positional: email, card_name, action_type, status, tracking_number, converted_points, requested_at
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

    // Insert inventory actions
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
