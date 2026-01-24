import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PlayGachaRequest {
  gachaId: string;
  playCount: 1 | 10 | 100;
}

interface DrawnCard {
  slotId: string;
  cardId: string;
  name: string;
  imageUrl: string | null;
  prizeTier: string;
  conversionPoints: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // ユーザー認証
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "認証が必要です" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "認証に失敗しました" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // リクエストボディ
    const { gachaId, playCount } = (await req.json()) as PlayGachaRequest;

    if (!gachaId || ![1, 10, 100].includes(playCount)) {
      return new Response(
        JSON.stringify({ error: "無効なリクエストです" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // サービスロールで操作
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ガチャ情報を取得
    const { data: gacha, error: gachaError } = await supabase
      .from("gacha_masters")
      .select("*")
      .eq("id", gachaId)
      .single();

    if (gachaError || !gacha) {
      return new Response(
        JSON.stringify({ error: "ガチャが見つかりません" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (gacha.status !== "active") {
      return new Response(
        JSON.stringify({ error: "このガチャは現在利用できません" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 残りスロット確認
    if (gacha.remaining_slots < playCount) {
      return new Response(
        JSON.stringify({ error: `残り口数が足りません（残り: ${gacha.remaining_slots}口）` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ユーザーのポイント残高を確認
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("points_balance")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "プロフィールが見つかりません" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const totalCost = gacha.price_per_play * playCount;
    if (profile.points_balance < totalCost) {
      return new Response(
        JSON.stringify({ error: `ポイントが足りません（必要: ${totalCost}pt, 残高: ${profile.points_balance}pt）` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 未抽選スロットをランダムに取得
    const { data: availableSlots, error: slotsError } = await supabase
      .from("gacha_slots")
      .select("id, card_id")
      .eq("gacha_id", gachaId)
      .eq("is_drawn", false)
      .limit(playCount);

    if (slotsError || !availableSlots || availableSlots.length < playCount) {
      return new Response(
        JSON.stringify({ error: "利用可能なスロットがありません" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ランダムにシャッフル
    const shuffledSlots = availableSlots.sort(() => Math.random() - 0.5).slice(0, playCount);
    const slotIds = shuffledSlots.map((s) => s.id);
    const cardIds = shuffledSlots.map((s) => s.card_id).filter(Boolean);

    // カード情報を取得
    const { data: cards, error: cardsError } = await supabase
      .from("cards")
      .select("id, name, image_url, prize_tier, conversion_points")
      .in("id", cardIds);

    if (cardsError) {
      console.error("Cards fetch error:", cardsError);
      return new Response(
        JSON.stringify({ error: "カード情報の取得に失敗しました" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cardsMap = new Map(cards?.map((c) => [c.id, c]) || []);

    // トランザクション作成
    const { data: transaction, error: transactionError } = await supabase
      .from("user_transactions")
      .insert({
        user_id: user.id,
        gacha_id: gachaId,
        play_count: playCount,
        total_spent_points: totalCost,
        status: "completed",
        result_items: slotIds,
      })
      .select()
      .single();

    if (transactionError) {
      console.error("Transaction error:", transactionError);
      return new Response(
        JSON.stringify({ error: "トランザクションの作成に失敗しました" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // スロットを更新
    const { error: updateSlotsError } = await supabase
      .from("gacha_slots")
      .update({
        is_drawn: true,
        user_id: user.id,
        drawn_at: new Date().toISOString(),
        transaction_id: transaction.id,
      })
      .in("id", slotIds);

    if (updateSlotsError) {
      console.error("Update slots error:", updateSlotsError);
      return new Response(
        JSON.stringify({ error: "スロットの更新に失敗しました" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ポイント減算
    const { error: pointsError } = await supabase
      .from("profiles")
      .update({ points_balance: profile.points_balance - totalCost })
      .eq("user_id", user.id);

    if (pointsError) {
      console.error("Points update error:", pointsError);
      return new Response(
        JSON.stringify({ error: "ポイントの更新に失敗しました" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ガチャの残り口数を更新
    const { error: gachaUpdateError } = await supabase
      .from("gacha_masters")
      .update({ remaining_slots: gacha.remaining_slots - playCount })
      .eq("id", gachaId);

    if (gachaUpdateError) {
      console.error("Gacha update error:", gachaUpdateError);
    }

    // 結果を整形
    const drawnCards: DrawnCard[] = shuffledSlots.map((slot) => {
      const card = cardsMap.get(slot.card_id);
      return {
        slotId: slot.id,
        cardId: slot.card_id || "",
        name: card?.name || "不明なカード",
        imageUrl: card?.image_url || null,
        prizeTier: card?.prize_tier || "miss",
        conversionPoints: card?.conversion_points || 0,
      };
    });

    console.log(`User ${user.id} played gacha ${gachaId} x${playCount}, got ${drawnCards.length} cards`);

    return new Response(
      JSON.stringify({
        success: true,
        transactionId: transaction.id,
        drawnCards,
        totalCost,
        newBalance: profile.points_balance - totalCost,
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
