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

// Column indices for get24 CSV format (0-indexed)
const GET24_COLUMN_MAP = {
  legacy_user_id: 0,
  last_name: 1,
  first_name: 2,
  postal_code: 5,
  city: 9,
  address_line1: 10,
  address_line2: 11,
  points_balance: 13,
  phone_number: 14,
  email: 15,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    // Service role client for data operations
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

    // Check if user is admin or super_admin using user context
    const { data: isAdmin, error: adminError } = await supabaseUser.rpc("is_admin");
    const { data: isSuperAdmin, error: superAdminError } = await supabaseUser.rpc("is_super_admin");
    
    console.log("Auth check:", { userId: user.id, isAdmin, isSuperAdmin, adminError, superAdminError });
    
    if (!isAdmin && !isSuperAdmin) {
      return new Response(JSON.stringify({ error: "管理者権限が必要です" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Use admin client for data operations
    const supabase = supabaseAdmin;

    const { tenant_id, records, csv_data } = await req.json();

    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let migrationRecords: MigrationRecord[] = [];
    let invalidEmailCount = 0;
    let totalLinesProcessed = 0;

    // Handle CSV string input
    if (csv_data) {
      const lines = csv_data.trim().split("\n").filter((line: string) => line.trim());
      totalLinesProcessed = lines.length;
      
      console.log(`Processing ${lines.length} lines of CSV data`);
      
      // Check if first line looks like a header (contains common header keywords)
      const firstLine = lines[0]?.toLowerCase() || "";
      const hasHeaders = firstLine.includes("email") || firstLine.includes("mail") || 
                         firstLine.includes("メール") || firstLine.includes("ポイント");
      
      console.log(`Header detection: hasHeaders=${hasHeaders}, firstLine="${firstLine.substring(0, 50)}..."`);
      
      if (hasHeaders) {
        // Parse with headers
        const headers = lines[0].split(",").map((h: string) => h.trim().toLowerCase().replace(/^"|"$/g, ""));
        totalLinesProcessed = lines.length - 1; // Exclude header
        
        for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i]);
          const record: Record<string, any> = {};
          
          headers.forEach((header: string, index: number) => {
            const value = values[index]?.trim();
            if (value && value !== "NULL" && value !== "null") {
              const mappedHeader = mapColumnName(header);
              if (mappedHeader === "points_balance" || mappedHeader === "legacy_user_id") {
                record[mappedHeader] = Math.floor(parseFloat(value.replace(/,/g, "")) || 0);
              } else {
                record[mappedHeader] = value;
              }
            }
          });
          
          // Accept all records, track invalid emails
          if (!record.email || !record.email.includes("@")) {
            invalidEmailCount++;
            // Generate placeholder email if missing
            if (!record.email) {
              record.email = `no-email-${Date.now()}-${i}@placeholder.invalid`;
            }
          }
          migrationRecords.push(record as MigrationRecord);
        }
      } else {
        // Parse get24 format without headers (positional)
        for (let i = 0; i < lines.length; i++) {
          const values = parseCSVLine(lines[i]);
          
          let email = cleanValue(values[GET24_COLUMN_MAP.email]);
          const hasValidEmail = email && email.includes("@");
          
          if (!hasValidEmail) {
            invalidEmailCount++;
            // Generate placeholder email if missing/invalid
            email = `no-email-${Date.now()}-${i}@placeholder.invalid`;
          }
          
          const pointsRaw = cleanValue(values[GET24_COLUMN_MAP.points_balance]);
          const points = Math.floor(parseFloat(pointsRaw?.replace(/,/g, "") || "0") || 0);
          
          const record: MigrationRecord = {
            email: email!,
            last_name: cleanValue(values[GET24_COLUMN_MAP.last_name]),
            first_name: cleanValue(values[GET24_COLUMN_MAP.first_name]),
            display_name: `${cleanValue(values[GET24_COLUMN_MAP.last_name]) || ""} ${cleanValue(values[GET24_COLUMN_MAP.first_name]) || ""}`.trim() || undefined,
            points_balance: points,
            phone_number: cleanValue(values[GET24_COLUMN_MAP.phone_number]),
            postal_code: cleanValue(values[GET24_COLUMN_MAP.postal_code]),
            city: cleanValue(values[GET24_COLUMN_MAP.city]),
            address_line1: cleanValue(values[GET24_COLUMN_MAP.address_line1]),
            address_line2: cleanValue(values[GET24_COLUMN_MAP.address_line2]),
            legacy_user_id: parseInt(cleanValue(values[GET24_COLUMN_MAP.legacy_user_id]) || "0", 10) || undefined,
          };
          
          migrationRecords.push(record);
        }
      }
      
      console.log(`Parsed ${migrationRecords.length} records (${invalidEmailCount} with invalid/missing emails) from ${totalLinesProcessed} data lines`);
    } else if (records && Array.isArray(records)) {
      migrationRecords = records;
      totalLinesProcessed = records.length;
    } else {
      return new Response(JSON.stringify({ error: "records or csv_data is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Deduplicate records by email (keep the last occurrence)
    const emailMap = new Map<string, MigrationRecord>();
    for (const record of migrationRecords) {
      const normalizedEmail = record.email.toLowerCase().trim();
      emailMap.set(normalizedEmail, record);
    }
    const uniqueRecords = Array.from(emailMap.values());
    const duplicatesRemoved = migrationRecords.length - uniqueRecords.length;

    console.log(`Deduplication: ${migrationRecords.length} -> ${uniqueRecords.length} (removed ${duplicatesRemoved} duplicates)`);

    // Batch insert (500 records at a time)
    const BATCH_SIZE = 500;
    let inserted = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 0; i < uniqueRecords.length; i += BATCH_SIZE) {
      const batch = uniqueRecords.slice(i, i + BATCH_SIZE).map(record => ({
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
        total_lines: totalLinesProcessed,
        total_records: migrationRecords.length,
        unique_records: uniqueRecords.length,
        duplicates_in_file: duplicatesRemoved,
        invalid_emails: invalidEmailCount,
        inserted,
        skipped: uniqueRecords.length - inserted,
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

// Clean value by removing quotes and handling NULL
function cleanValue(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const cleaned = value.trim().replace(/^"|"$/g, "");
  if (cleaned === "" || cleaned === "NULL" || cleaned === "null" || cleaned === "　") {
    return undefined;
  }
  return cleaned;
}

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
