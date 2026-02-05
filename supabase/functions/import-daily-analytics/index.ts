import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DailyAnalyticsRecordBase {
  legacy_id: number;
  date: string;
  status: number;
}

interface DayDataRecord extends DailyAnalyticsRecordBase {
  payment_amount: number;
  profit: number;
  points_used: number;
}

interface SalesCostRecord extends DailyAnalyticsRecordBase {
  sales: number;
  cost: number;
  expenses: number;
  gross_profit_margin: number;
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

    // Check admin permissions
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

    const lines = csv_data.trim().split("\n").filter((line: string) => line.trim());
    
    // Detect format from header
    const headerLine = lines[0]?.toLowerCase() || "";
    const isSalesCostFormat = headerLine.includes("sales") || headerLine.includes("cost") || headerLine.includes("expenses");
    
    console.log(`Detected format: ${isSalesCostFormat ? "sales_cost_managements" : "day_datas"}`);
    
    const recordsToInsert: any[] = [];
    
    if (isSalesCostFormat) {
      // sales_cost_managements.csv format
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        
        // Parse date - could be YYYY-MM-DD or YYYYMMDD
        let dateStr = values[5]?.trim();
        if (!dateStr) continue;
        
        // Normalize date format
        if (dateStr.length === 8 && !dateStr.includes("-")) {
          dateStr = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
        }
        
        const grossProfitMargin = parseFloat(values[4]?.trim() || "0");
        
        recordsToInsert.push({
          legacy_id: parseInt(values[0]?.trim() || "0", 10),
          date: dateStr,
          payment_amount: parseInt(values[1]?.trim() || "0", 10), // sales
          cost: parseInt(values[2]?.trim() || "0", 10),
          expenses: parseInt(values[3]?.trim() || "0", 10),
          gross_profit_margin: grossProfitMargin,
          status: parseInt(values[6]?.trim() || "0", 10),
          tenant_id,
        });
      }
    } else {
      // day_datas.csv format (original)
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        
        // Parse date from YYYYMMDD format
        const dateStr = values[1]?.trim();
        if (!dateStr || dateStr.length !== 8) continue;
        
        const formattedDate = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
        
        recordsToInsert.push({
          legacy_id: parseInt(values[0]?.trim() || "0", 10),
          date: formattedDate,
          payment_amount: parseInt(values[2]?.trim() || "0", 10),
          profit: parseInt(values[3]?.trim() || "0", 10),
          points_used: parseInt(values[4]?.trim() || "0", 10),
          status: parseInt(values[5]?.trim() || "0", 10),
          tenant_id,
        });
      }
    }

    console.log(`Parsed ${recordsToInsert.length} daily analytics records`);

    // Batch insert (500 records at a time)
    const BATCH_SIZE = 500;
    let inserted = 0;
    const errors: string[] = [];

    for (let i = 0; i < recordsToInsert.length; i += BATCH_SIZE) {
      const batch = recordsToInsert.slice(i, i + BATCH_SIZE);

      const { data, error } = await supabaseAdmin
        .from("daily_analytics")
        .upsert(batch, { 
          onConflict: "tenant_id,date",
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
        total_records: recordsToInsert.length,
        format: isSalesCostFormat ? "sales_cost_managements" : "day_datas",
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
