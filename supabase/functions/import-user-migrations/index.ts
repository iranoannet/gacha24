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

// Column indices for gachamo CSV format (0-indexed)
// Actual format: id(0), lastName(1), firstName(2), middleName(3), zipcode(4), country(5), province(6), pref_id(7), shiku(8), address(9), building(10), availablePoint(11), sub_coin(12), tel(13), mail(14), pass(15)...
const GET24_COLUMN_MAP = {
  legacy_user_id: 0,  // id
  last_name: 1,       // lastName
  first_name: 2,      // firstName
  // middle_name: 3,  // middleName (not stored)
  postal_code: 4,     // zipcode
  // country: 5,      // country (not needed)
  // province: 6,     // province (not needed)
  pref_id: 7,         // pref_id (prefecture code)
  city: 8,            // shiku
  address_line1: 9,   // address
  address_line2: 10,  // building
  points_balance: 11, // availablePoint
  // sub_coin: 12,    // sub_coin (not stored)
  phone_number: 13,   // tel
  email: 14,          // mail
};

// Prefecture ID to name mapping
const PREFECTURE_MAP: Record<number, string> = {
  1: "北海道", 2: "青森県", 3: "岩手県", 4: "宮城県", 5: "秋田県",
  6: "山形県", 7: "福島県", 8: "茨城県", 9: "栃木県", 10: "群馬県",
  11: "埼玉県", 12: "千葉県", 13: "東京都", 14: "神奈川県", 15: "新潟県",
  16: "富山県", 17: "石川県", 18: "福井県", 19: "山梨県", 20: "長野県",
  21: "岐阜県", 22: "静岡県", 23: "愛知県", 24: "三重県", 25: "滋賀県",
  26: "京都府", 27: "大阪府", 28: "兵庫県", 29: "奈良県", 30: "和歌山県",
  31: "鳥取県", 32: "島根県", 33: "岡山県", 34: "広島県", 35: "山口県",
  36: "徳島県", 37: "香川県", 38: "愛媛県", 39: "高知県", 40: "福岡県",
  41: "佐賀県", 42: "長崎県", 43: "熊本県", 44: "大分県", 45: "宮崎県",
  46: "鹿児島県", 47: "沖縄県"
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
      
      // Check if first line looks like a header by examining the first few cells
      // Headers are typically text labels, not numeric IDs or email addresses
      const firstLineValues = parseCSVLine(lines[0]);
      const firstCell = cleanValue(firstLineValues[0]) || "";
      const secondCell = cleanValue(firstLineValues[1]) || "";
      
      // If first cell is a number (legacy_user_id), it's data, not a header
      const firstCellIsNumber = /^\d+$/.test(firstCell);
      
      // Check if cells contain typical header keywords (but NOT email addresses)
      const headerKeywords = ["email", "mail", "メール", "ポイント", "id", "name", "姓", "名", "電話"];
      const cellsLookLikeHeaders = !firstCellIsNumber && 
        headerKeywords.some(keyword => 
          firstCell.toLowerCase().includes(keyword) || 
          secondCell.toLowerCase().includes(keyword)
        );
      
      const hasHeaders = cellsLookLikeHeaders;
      
      console.log(`Header detection: hasHeaders=${hasHeaders}, firstCell="${firstCell}", firstCellIsNumber=${firstCellIsNumber}`);
      
      if (hasHeaders) {
        // Parse with headers
        const headers = lines[0].split(",").map((h: string) => h.trim().toLowerCase().replace(/^"|"$/g, ""));
        totalLinesProcessed = lines.length - 1; // Exclude header
        
        // Valid column names for user_migrations table
        const validColumns = new Set([
          "email", "display_name", "last_name", "first_name", 
          "points_balance", "phone_number", "postal_code", "prefecture",
          "city", "address_line1", "address_line2", "legacy_user_id"
        ]);
        
        for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i]);
          const record: Record<string, any> = {};
          
          headers.forEach((header: string, index: number) => {
            const value = values[index]?.trim();
            if (value && value !== "NULL" && value !== "null") {
              const mappedHeader = mapColumnName(header);
              // Skip empty headers or columns not in our schema
              if (!mappedHeader || !validColumns.has(mappedHeader)) {
                return;
              }
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
          
          // Get prefecture name from ID
          const prefIdRaw = cleanValue(values[GET24_COLUMN_MAP.pref_id]);
          const prefId = prefIdRaw ? parseInt(prefIdRaw, 10) : undefined;
          const prefecture = prefId ? PREFECTURE_MAP[prefId] : undefined;
          
          const lastName = cleanValue(values[GET24_COLUMN_MAP.last_name]);
          const firstName = cleanValue(values[GET24_COLUMN_MAP.first_name]);
          
          const record: MigrationRecord = {
            email: email!,
            last_name: lastName,
            first_name: firstName,
            display_name: `${lastName || ""} ${firstName || ""}`.trim() || undefined,
            points_balance: points,
            phone_number: cleanValue(values[GET24_COLUMN_MAP.phone_number]),
            postal_code: cleanValue(values[GET24_COLUMN_MAP.postal_code]),
            prefecture: prefecture,
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
