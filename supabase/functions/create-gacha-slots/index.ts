import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SelectedCardItem {
  cardId: string;
  name: string;
  imageUrl: string | null;
  conversionPoints: number;
  quantity: number;
  prizeTier: "S" | "A" | "B" | "miss";
  category: string | null;
}

interface CreateGachaSlotsRequest {
  gachaId: string;
  items: SelectedCardItem[];
  appendMode?: boolean; // 追加モード（既存スロットに追加）
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 認証チェック
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "認証が必要です" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ユーザー認証用クライアント
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "認証に失敗しました" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 管理者チェック
    const { data: isAdmin } = await supabaseAuth.rpc("is_admin");
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "管理者権限が必要です" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // リクエストボディ
    const { gachaId, items, appendMode } = (await req.json()) as CreateGachaSlotsRequest;

    if (!gachaId || !items || items.length === 0) {
      return new Response(
        JSON.stringify({ error: "gachaIdとitemsが必要です" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 追加モードの場合、下書き状態かチェック
    if (appendMode) {
      const { data: gacha, error: gachaError } = await supabaseAuth
        .from("gacha_masters")
        .select("status")
        .eq("id", gachaId)
        .single();
      
      if (gachaError || !gacha) {
        return new Response(
          JSON.stringify({ error: "ガチャが見つかりません" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (gacha.status !== "draft") {
        return new Response(
          JSON.stringify({ error: "下書き状態のガチャのみ追加可能です" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // サービスロールで操作
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`Creating slots for gacha ${gachaId} with ${items.length} card types`);

    // カードとスロットを一括生成
    const cardsToInsert: any[] = [];
    const totalSlots = items.reduce((sum, item) => sum + item.quantity, 0);

    // 各カードについて、必要枚数分のレコードを作成
    for (const item of items) {
      for (let i = 0; i < item.quantity; i++) {
        cardsToInsert.push({
          name: item.name,
          image_url: item.imageUrl,
          conversion_points: item.conversionPoints,
          gacha_id: gachaId,
          prize_tier: item.prizeTier,
          category: item.category,
        });
      }
    }

    console.log(`Inserting ${cardsToInsert.length} cards...`);

    // カードを一括挿入（500件ずつバッチ処理）
    const batchSize = 500;
    const insertedCardIds: string[] = [];

    for (let i = 0; i < cardsToInsert.length; i += batchSize) {
      const batch = cardsToInsert.slice(i, i + batchSize);
      const { data: insertedCards, error: cardError } = await supabase
        .from("cards")
        .insert(batch)
        .select("id");

      if (cardError) {
        console.error("Card insert error:", cardError);
        throw new Error(`カード挿入エラー: ${cardError.message}`);
      }

      if (insertedCards) {
        insertedCardIds.push(...insertedCards.map((c) => c.id));
      }
    }

    console.log(`Inserted ${insertedCardIds.length} cards, creating slots...`);

    // 追加モードの場合は既存の最大slot_numberを取得
    let startSlotNumber = 1;
    let existingTotalSlots = 0;
    let existingRemainingSlots = 0;
    
    if (appendMode) {
      // 既存のガチャ情報を取得
      const { data: gachaData } = await supabase
        .from("gacha_masters")
        .select("total_slots, remaining_slots")
        .eq("id", gachaId)
        .single();
      
      if (gachaData) {
        existingTotalSlots = gachaData.total_slots;
        existingRemainingSlots = gachaData.remaining_slots;
      }
      
      // 既存の最大slot_numberを取得
      const { data: maxSlotData } = await supabase
        .from("gacha_slots")
        .select("slot_number")
        .eq("gacha_id", gachaId)
        .order("slot_number", { ascending: false })
        .limit(1)
        .single();
      
      if (maxSlotData) {
        startSlotNumber = maxSlotData.slot_number + 1;
      }
    }

    // Generate random slot numbers within new range (shuffled)
    const generateRandomSlotNumbers = (count: number, start: number): number[] => {
      const numbers: number[] = [];
      for (let i = start; i < start + count; i++) {
        numbers.push(i);
      }
      // Fisher-Yates shuffle
      for (let i = numbers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
      }
      return numbers;
    };

    const randomSlotNumbers = generateRandomSlotNumbers(insertedCardIds.length, startSlotNumber);

    // スロットを一括生成 with random slot numbers
    const slotsToInsert = insertedCardIds.map((cardId, index) => ({
      gacha_id: gachaId,
      card_id: cardId,
      slot_number: randomSlotNumbers[index],
    }));

    // スロットを一括挿入（500件ずつバッチ処理）
    for (let i = 0; i < slotsToInsert.length; i += batchSize) {
      const batch = slotsToInsert.slice(i, i + batchSize);
      const { error: slotError } = await supabase.from("gacha_slots").insert(batch);

      if (slotError) {
        console.error("Slot insert error:", slotError);
        throw new Error(`スロット挿入エラー: ${slotError.message}`);
      }
    }

    // ガチャマスタの口数を更新（追加モードの場合は加算）
    const newTotalSlots = appendMode ? existingTotalSlots + totalSlots : totalSlots;
    const newRemainingSlots = appendMode ? existingRemainingSlots + totalSlots : totalSlots;
    
    const { error: updateError } = await supabase
      .from("gacha_masters")
      .update({
        total_slots: newTotalSlots,
        remaining_slots: newRemainingSlots,
      })
      .eq("id", gachaId);

    if (updateError) {
      console.error("Update error:", updateError);
      throw new Error(`ガチャ更新エラー: ${updateError.message}`);
    }

    const actionText = appendMode ? "追加" : "作成";
    console.log(`Successfully ${actionText} ${totalSlots} slots for gacha ${gachaId}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `${totalSlots}口のスロットを${actionText}しました`,
        totalSlots: newTotalSlots,
        addedSlots: totalSlots,
        cardCount: insertedCardIds.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "内部エラーが発生しました";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
