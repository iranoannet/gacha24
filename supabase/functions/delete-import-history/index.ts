import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "認証が必要です" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "認証エラー" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check super_admin role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "super_admin")
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "権限がありません" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { history_id } = await req.json();

    if (!history_id) {
      return new Response(JSON.stringify({ error: "history_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the import history record
    const { data: historyRecord, error: historyError } = await supabase
      .from("import_history")
      .select("*")
      .eq("id", history_id)
      .single();

    if (historyError || !historyRecord) {
      return new Response(JSON.stringify({ error: "履歴が見つかりません" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data_type, tenant_id, imported_at } = historyRecord;
    let deletedCount = 0;
    const deletionDetails: string[] = [];

    console.log(`Deleting import history: ${history_id}, type: ${data_type}, tenant: ${tenant_id}`);

    // Delete related data based on data_type
    switch (data_type) {
      case "users": {
        // Delete from user_migrations
        const { data: deleted, error } = await supabase
          .from("user_migrations")
          .delete()
          .eq("tenant_id", tenant_id)
          .select("id");
        
        if (error) {
          console.error("Error deleting user_migrations:", error);
          deletionDetails.push(`user_migrations削除エラー: ${error.message}`);
        } else {
          deletedCount = deleted?.length || 0;
          deletionDetails.push(`user_migrations: ${deletedCount}件削除`);
        }
        break;
      }

      case "transactions": {
        // Delete from user_transactions for this tenant
        const { data: deleted, error } = await supabase
          .from("user_transactions")
          .delete()
          .eq("tenant_id", tenant_id)
          .select("id");
        
        if (error) {
          console.error("Error deleting user_transactions:", error);
          deletionDetails.push(`user_transactions削除エラー: ${error.message}`);
        } else {
          deletedCount = deleted?.length || 0;
          deletionDetails.push(`user_transactions: ${deletedCount}件削除`);
        }
        break;
      }

      case "inventory": {
        // Delete from inventory_actions for this tenant
        const { data: deleted, error } = await supabase
          .from("inventory_actions")
          .delete()
          .eq("tenant_id", tenant_id)
          .select("id");
        
        if (error) {
          console.error("Error deleting inventory_actions:", error);
          deletionDetails.push(`inventory_actions削除エラー: ${error.message}`);
        } else {
          deletedCount = deleted?.length || 0;
          deletionDetails.push(`inventory_actions: ${deletedCount}件削除`);
        }
        break;
      }

      case "daily_analytics": {
        // Delete from daily_analytics for this tenant
        const { data: deleted, error } = await supabase
          .from("daily_analytics")
          .delete()
          .eq("tenant_id", tenant_id)
          .select("id");
        
        if (error) {
          console.error("Error deleting daily_analytics:", error);
          deletionDetails.push(`daily_analytics削除エラー: ${error.message}`);
        } else {
          deletedCount = deleted?.length || 0;
          deletionDetails.push(`daily_analytics: ${deletedCount}件削除`);
        }
        break;
      }

      case "shipping_history": {
        // Delete shipping-type inventory_actions for this tenant
        const { data: deleted, error } = await supabase
          .from("inventory_actions")
          .delete()
          .eq("tenant_id", tenant_id)
          .eq("action_type", "shipping")
          .select("id");
        
        if (error) {
          console.error("Error deleting shipping inventory_actions:", error);
          deletionDetails.push(`shipping履歴削除エラー: ${error.message}`);
        } else {
          deletedCount = deleted?.length || 0;
          deletionDetails.push(`shipping履歴: ${deletedCount}件削除`);
        }
        break;
      }

      case "profiles": {
        // Delete profiles for this tenant (but not auth users)
        const { data: deleted, error } = await supabase
          .from("profiles")
          .delete()
          .eq("tenant_id", tenant_id)
          .select("id");
        
        if (error) {
          console.error("Error deleting profiles:", error);
          deletionDetails.push(`profiles削除エラー: ${error.message}`);
        } else {
          deletedCount = deleted?.length || 0;
          deletionDetails.push(`profiles: ${deletedCount}件削除`);
        }
        break;
      }

      default:
        deletionDetails.push(`未対応のデータタイプ: ${data_type}`);
    }

    // Delete the import_history record itself
    const { error: deleteHistoryError } = await supabase
      .from("import_history")
      .delete()
      .eq("id", history_id);

    if (deleteHistoryError) {
      console.error("Error deleting import_history:", deleteHistoryError);
      return new Response(
        JSON.stringify({ 
          error: `履歴削除エラー: ${deleteHistoryError.message}`,
          deletionDetails 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    deletionDetails.push("import_history: 1件削除");

    console.log("Deletion completed:", deletionDetails);

    return new Response(
      JSON.stringify({
        success: true,
        data_type,
        deleted_records: deletedCount,
        details: deletionDetails,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    const errorMessage = error instanceof Error ? error.message : "予期せぬエラー";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
