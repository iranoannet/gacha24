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
    const { gachaId, items } = (await req.json()) as CreateGachaSlotsRequest;

    if (!gachaId || !items || items.length === 0) {
      return new Response(
        JSON.stringify({ error: "gachaIdとitemsが必要です" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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

    // Generate random slot numbers
    const generateRandomSlotNumbers = (count: number): number[] => {
      const numbers: number[] = [];
      const maxRange = count * 100; // Large range for random numbers
      while (numbers.length < count) {
        const randomNum = Math.floor(Math.random() * maxRange) + 1;
        if (!numbers.includes(randomNum)) {
          numbers.push(randomNum);
        }
      }
      return numbers;
    };

    const randomSlotNumbers = generateRandomSlotNumbers(insertedCardIds.length);

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

    // ガチャマスタの口数を更新
    const { error: updateError } = await supabase
      .from("gacha_masters")
      .update({
        total_slots: totalSlots,
        remaining_slots: totalSlots,
      })
      .eq("id", gachaId);

    if (updateError) {
      console.error("Update error:", updateError);
      throw new Error(`ガチャ更新エラー: ${updateError.message}`);
    }

    console.log(`Successfully created ${totalSlots} slots for gacha ${gachaId}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `${totalSlots}口のスロットを作成しました`,
        totalSlots,
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
