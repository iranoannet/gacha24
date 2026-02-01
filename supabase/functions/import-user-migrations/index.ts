import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MigrationRecord {
  email: string;
  display_name?: string;
  last_name?: string;
  first_name?: string;
  points_balance?: number;
  phone_number?: string;
  postal_code?: string;
  prefecture?: string;
  city?: string;
  address_line1?: string;
  address_line2?: string;
  legacy_user_id?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify admin access
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "認証が必要です" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "認証エラー" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user is admin or super_admin
    const { data: isAdmin } = await supabase.rpc("is_admin");
    const { data: isSuperAdmin } = await supabase.rpc("is_super_admin");
    
    if (!isAdmin && !isSuperAdmin) {
      return new Response(JSON.stringify({ error: "管理者権限が必要です" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { tenant_id, records, csv_data } = await req.json();

    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let migrationRecords: MigrationRecord[] = [];

    // Handle CSV string input
    if (csv_data) {
      const lines = csv_data.trim().split("\n");
      const headers = lines[0].split(",").map((h: string) => h.trim().toLowerCase());
      
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const record: Record<string, any> = {};
        
        headers.forEach((header: string, index: number) => {
          const value = values[index]?.trim();
          if (value) {
            // Map common CSV column names to our schema
            const mappedHeader = mapColumnName(header);
            if (mappedHeader === "points_balance" || mappedHeader === "legacy_user_id") {
              record[mappedHeader] = parseInt(value, 10) || 0;
            } else {
              record[mappedHeader] = value;
            }
          }
        });
        
        if (record.email) {
          migrationRecords.push(record as MigrationRecord);
        }
      }
    } else if (records && Array.isArray(records)) {
      migrationRecords = records;
    } else {
      return new Response(JSON.stringify({ error: "records or csv_data is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Batch insert (500 records at a time)
    const BATCH_SIZE = 500;
    let inserted = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 0; i < migrationRecords.length; i += BATCH_SIZE) {
      const batch = migrationRecords.slice(i, i + BATCH_SIZE).map(record => ({
        ...record,
        tenant_id,
        is_applied: false,
      }));

      const { data, error } = await supabase
        .from("user_migrations")
        .upsert(batch, { 
          onConflict: "email,tenant_id",
          ignoreDuplicates: false 
        })
        .select("id");

      if (error) {
        errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
      } else {
        inserted += data?.length || 0;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_records: migrationRecords.length,
        inserted,
        skipped: migrationRecords.length - inserted,
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

// Parse CSV line handling quoted values
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

// Map common CSV column names to our schema
function mapColumnName(header: string): string {
  const mappings: Record<string, string> = {
    "email": "email",
    "メールアドレス": "email",
    "mail": "email",
    "name": "display_name",
    "display_name": "display_name",
    "表示名": "display_name",
    "last_name": "last_name",
    "姓": "last_name",
    "first_name": "first_name",
    "名": "first_name",
    "points": "points_balance",
    "points_balance": "points_balance",
    "ポイント": "points_balance",
    "ポイント残高": "points_balance",
    "phone": "phone_number",
    "phone_number": "phone_number",
    "電話番号": "phone_number",
    "postal_code": "postal_code",
    "郵便番号": "postal_code",
    "zip": "postal_code",
    "prefecture": "prefecture",
    "都道府県": "prefecture",
    "city": "city",
    "市区町村": "city",
    "address": "address_line1",
    "address_line1": "address_line1",
    "住所1": "address_line1",
    "address_line2": "address_line2",
    "住所2": "address_line2",
    "user_id": "legacy_user_id",
    "legacy_user_id": "legacy_user_id",
    "旧id": "legacy_user_id",
  };
  
  return mappings[header] || header;
}
