import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ExpiredSlot {
  id: string;
  user_id: string;
  card_id: string;
  selection_deadline: string;
}

interface CardInfo {
  id: string;
  name: string;
  conversion_points: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Starting auto-conversion of expired slots...");

    // 1. 期限切れで未選択のスロットを取得
    // (inventory_actionsに登録されていないスロット)
    const now = new Date().toISOString();
    
    const { data: expiredSlots, error: fetchError } = await supabase
      .from("gacha_slots")
      .select(`
        id,
        user_id,
        card_id,
        selection_deadline
      `)
      .eq("is_drawn", true)
      .not("user_id", "is", null)
      .not("card_id", "is", null)
      .lt("selection_deadline", now)
      .limit(100); // バッチ処理で100件ずつ

    if (fetchError) {
      console.error("Error fetching expired slots:", fetchError);
      throw fetchError;
    }

    if (!expiredSlots || expiredSlots.length === 0) {
      console.log("No expired slots found.");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No expired slots to process",
          processed: 0 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${expiredSlots.length} expired slots to process`);

    // 2. すでにinventory_actionsに登録されているスロットを除外
    const slotIds = expiredSlots.map(s => s.id);
    
    const { data: existingActions, error: actionsError } = await supabase
      .from("inventory_actions")
      .select("slot_id")
      .in("slot_id", slotIds);

    if (actionsError) {
      console.error("Error fetching existing actions:", actionsError);
      throw actionsError;
    }

    const processedSlotIds = new Set(existingActions?.map(a => a.slot_id) || []);
    const unprocessedSlots = expiredSlots.filter(s => !processedSlotIds.has(s.id));

    if (unprocessedSlots.length === 0) {
      console.log("All expired slots are already processed.");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "All expired slots already processed",
          processed: 0 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`${unprocessedSlots.length} slots need auto-conversion`);

    // 3. カード情報を取得
    const cardIds = [...new Set(unprocessedSlots.map(s => s.card_id))];
    
    const { data: cards, error: cardsError } = await supabase
      .from("cards")
      .select("id, name, conversion_points")
      .in("id", cardIds);

    if (cardsError) {
      console.error("Error fetching cards:", cardsError);
      throw cardsError;
    }

    const cardMap = new Map<string, CardInfo>();
    cards?.forEach(c => cardMap.set(c.id, c));

    // 4. ユーザーごとにグループ化して処理
    const userSlots = new Map<string, { slotId: string; cardId: string; points: number }[]>();
    
    for (const slot of unprocessedSlots) {
      const card = cardMap.get(slot.card_id);
      if (!card) continue;

      if (!userSlots.has(slot.user_id)) {
        userSlots.set(slot.user_id, []);
      }
      userSlots.get(slot.user_id)!.push({
        slotId: slot.id,
        cardId: slot.card_id,
        points: card.conversion_points,
      });
    }

    let totalProcessed = 0;
    const errors: string[] = [];

    // 5. 各ユーザーのスロットを処理
    for (const [userId, slots] of userSlots) {
      try {
        const totalPoints = slots.reduce((sum, s) => sum + s.points, 0);

        // inventory_actionsに登録
        const { error: insertError } = await supabase
          .from("inventory_actions")
          .insert(
            slots.map(s => ({
              user_id: userId,
              slot_id: s.slotId,
              card_id: s.cardId,
              action_type: "conversion" as const,
              status: "completed" as const,
              converted_points: s.points,
              processed_at: new Date().toISOString(),
            }))
          );

        if (insertError) {
          console.error(`Error inserting actions for user ${userId}:`, insertError);
          errors.push(`User ${userId}: ${insertError.message}`);
          continue;
        }

        // ポイントを加算
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("points_balance")
          .eq("user_id", userId)
          .single();

        if (profileError) {
          console.error(`Error fetching profile for user ${userId}:`, profileError);
          errors.push(`User ${userId}: Profile fetch failed`);
          continue;
        }

        const { error: updateError } = await supabase
          .from("profiles")
          .update({ points_balance: (profile?.points_balance || 0) + totalPoints })
          .eq("user_id", userId);

        if (updateError) {
          console.error(`Error updating points for user ${userId}:`, updateError);
          errors.push(`User ${userId}: Points update failed`);
          continue;
        }

        totalProcessed += slots.length;
        console.log(`Processed ${slots.length} slots for user ${userId}, added ${totalPoints} points`);

      } catch (err) {
        console.error(`Error processing user ${userId}:`, err);
        errors.push(`User ${userId}: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }

    console.log(`Auto-conversion complete. Processed: ${totalProcessed}, Errors: ${errors.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: totalProcessed,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Auto-conversion error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
