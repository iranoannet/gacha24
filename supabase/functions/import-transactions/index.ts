import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TransactionRecord {
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

    // Fetch existing gachas for lookup
    const { data: gachas } = await supabaseAdmin
      .from("gacha_masters")
      .select("id, title")
      .eq("tenant_id", tenant_id);
    
    const titleToGachaId = new Map<string, string>();
    gachas?.forEach(g => titleToGachaId.set(g.title.toLowerCase(), g.id));

    // Parse CSV
    const lines = csv_data.trim().split("\n").filter((line: string) => line.trim());
    const records: TransactionRecord[] = [];
    
    // Check for headers
    const firstLine = lines[0]?.toLowerCase() || "";
    const hasHeaders = firstLine.includes("email") || firstLine.includes("user");
    
    const startIndex = hasHeaders ? 1 : 0;
    
    for (let i = startIndex; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      
      if (hasHeaders) {
        const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
        const record: TransactionRecord = { user_email: "" };
        
        headers.forEach((header, idx) => {
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
        // Positional: email, gacha_title, play_count, total_spent_points, created_at
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

    console.log(`Processing ${records.length} transaction records`);

    // Insert transactions
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
        const { data, error } = await supabaseAdmin
          .from("user_transactions")
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
