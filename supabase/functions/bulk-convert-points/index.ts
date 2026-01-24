import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ConvertItem {
  slotId: string;
  cardId: string;
  conversionPoints: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Get auth token from request
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "認証が必要です" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create client with user's token to get user ID
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "認証エラー" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;
    console.log(`Bulk convert request from user: ${userId}`);

    const { items } = await req.json() as { items: ConvertItem[] };
    
    if (!items || items.length === 0) {
      return new Response(
        JSON.stringify({ error: "変換するアイテムがありません" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Converting ${items.length} items for user ${userId}`);

    // Use service role for database operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Calculate total points
    const totalPoints = items.reduce((sum, item) => sum + item.conversionPoints, 0);

    // Batch insert inventory_actions (最大500件ずつ)
    const batchSize = 500;
    const now = new Date().toISOString();
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const insertData = batch.map(item => ({
        user_id: userId,
        slot_id: item.slotId,
        card_id: item.cardId,
        action_type: "conversion" as const,
        status: "completed" as const,
        converted_points: item.conversionPoints,
        processed_at: now,
      }));

      const { error: insertError } = await supabaseAdmin
        .from("inventory_actions")
        .insert(insertData);

      if (insertError) {
        console.error(`Batch insert error at index ${i}:`, insertError);
        throw new Error(`一括登録エラー: ${insertError.message}`);
      }
      
      console.log(`Inserted batch ${i / batchSize + 1}, ${batch.length} items`);
    }

    // Update user points balance
    const { data: profile, error: fetchError } = await supabaseAdmin
      .from("profiles")
      .select("points_balance")
      .eq("user_id", userId)
      .single();

    if (fetchError) {
      console.error("Profile fetch error:", fetchError);
      throw new Error(`プロフィール取得エラー: ${fetchError.message}`);
    }

    const newBalance = (profile?.points_balance || 0) + totalPoints;

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ points_balance: newBalance })
      .eq("user_id", userId);

    if (updateError) {
      console.error("Profile update error:", updateError);
      throw new Error(`ポイント更新エラー: ${updateError.message}`);
    }

    console.log(`Successfully converted ${items.length} items, added ${totalPoints} points. New balance: ${newBalance}`);

    return new Response(
      JSON.stringify({
        success: true,
        convertedCount: items.length,
        totalPoints,
        newBalance,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "一括変換に失敗しました";
    console.error("Bulk convert error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
