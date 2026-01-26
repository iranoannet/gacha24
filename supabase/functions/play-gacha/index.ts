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

interface AtomicGachaResult {
  success: boolean;
  error?: string;
  transactionId?: string;
  totalCost?: number;
  newBalance?: number;
  drawnCards?: DrawnCard[];
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

    // サービスロールで原子的なデータベース関数を呼び出す
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`[play-gacha] User ${user.id} attempting ${playCount}x play on gacha ${gachaId}`);

    // 原子的なガチャ処理を実行
    const { data: result, error: rpcError } = await supabase.rpc('play_gacha_atomic', {
      p_user_id: user.id,
      p_gacha_id: gachaId,
      p_play_count: playCount,
    });

    if (rpcError) {
      console.error("[play-gacha] RPC error:", rpcError);
      return new Response(
        JSON.stringify({ error: "ガチャ処理中にエラーが発生しました" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const atomicResult = result as AtomicGachaResult;

    if (!atomicResult.success) {
      console.log(`[play-gacha] Failed: ${atomicResult.error}`);
      return new Response(
        JSON.stringify({ error: atomicResult.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[play-gacha] Success: User ${user.id} drew ${atomicResult.drawnCards?.length} cards`);

    return new Response(
      JSON.stringify({
        success: true,
        transactionId: atomicResult.transactionId,
        drawnCards: atomicResult.drawnCards,
        totalCost: atomicResult.totalCost,
        newBalance: atomicResult.newBalance,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[play-gacha] Error:", error);
    const message = error instanceof Error ? error.message : "内部エラーが発生しました";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
