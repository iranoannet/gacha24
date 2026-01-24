import { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Coins, Share2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { GachaResultModal } from "@/components/gacha/GachaResultModal";
import { GachaConfirmDialog } from "@/components/gacha/GachaConfirmDialog";
import { 
  GachaAnimationSystem, 
  getAnimationParamsForPrizeTier, 
  getHighestPrizeTier,
  type ColorTheme,
  type IntensityLevel,
  type CameraMotion,
  type ParticleStyle,
} from "@/components/gacha/GachaAnimationSystem";
import type { Database } from "@/integrations/supabase/types";

type GachaMaster = Database["public"]["Tables"]["gacha_masters"]["Row"];
type Card = Database["public"]["Tables"]["cards"]["Row"];
type PrizeTier = Database["public"]["Enums"]["prize_tier"];

const prizeTierStyles: Record<PrizeTier, { bg: string; text: string; glow: string; label: string }> = {
  S: { bg: "bg-rarity-s", text: "text-foreground", glow: "shadow-[0_0_20px_hsl(var(--rarity-s))]", label: "S賞" },
  A: { bg: "bg-rarity-a", text: "text-foreground", glow: "shadow-[0_0_15px_hsl(var(--rarity-a))]", label: "A賞" },
  B: { bg: "bg-rarity-b", text: "text-foreground", glow: "shadow-[0_0_10px_hsl(var(--rarity-b))]", label: "B賞" },
  miss: { bg: "bg-muted", text: "text-muted-foreground", glow: "", label: "ハズレ" },
};

interface GroupedCard {
  id: string;
  name: string;
  imageUrl: string | null;
  prizeTier: PrizeTier;
  conversionPoints: number;
  quantity: number;
}

interface DrawnCard {
  slotId: string;
  cardId: string;
  name: string;
  imageUrl: string | null;
  prizeTier: string;
  conversionPoints: number;
}

interface GachaResult {
  drawnCards: DrawnCard[];
  totalCost: number;
  newBalance: number;
}

const GachaDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [gachaResult, setGachaResult] = useState<GachaResult | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingPlayCount, setPendingPlayCount] = useState<1 | 10 | 100>(1);
  
  // 演出パラメータ
  const [animParams, setAnimParams] = useState<{
    colorTheme: ColorTheme;
    intensity: IntensityLevel;
    cameraMotion: CameraMotion;
    particleStyle: ParticleStyle;
    isRainbow: boolean;
  }>({
    colorTheme: "gold",
    intensity: 3,
    cameraMotion: "zoomIn",
    particleStyle: "spark",
    isRainbow: false,
  });
  
  // 結果データを保持
  const pendingResultRef = useRef<GachaResult | null>(null);

  // ガチャマスタ情報取得
  const { data: gacha, isLoading: isLoadingGacha } = useQuery({
    queryKey: ["gacha-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gacha_masters")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as GachaMaster;
    },
    enabled: !!id,
  });

  // カードラインナップ取得
  const { data: cards, isLoading: isLoadingCards } = useQuery({
    queryKey: ["gacha-cards", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cards")
        .select("*")
        .eq("gacha_id", id!)
        .order("prize_tier", { ascending: true });
      if (error) throw error;
      return data as Card[];
    },
    enabled: !!id,
  });

  // ユーザーのポイント残高取得
  const { data: profile } = useQuery({
    queryKey: ["user-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("points_balance")
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // カードをグループ化
  const groupedCards: GroupedCard[] = cards
    ? Object.values(
        cards.reduce((acc, card) => {
          const key = `${card.name}-${card.prize_tier}`;
          if (!acc[key]) {
            acc[key] = {
              id: card.id,
              name: card.name,
              imageUrl: card.image_url,
              prizeTier: card.prize_tier,
              conversionPoints: card.conversion_points,
              quantity: 0,
            };
          }
          acc[key].quantity++;
          return acc;
        }, {} as Record<string, GroupedCard>)
      )
        .filter((card) => card.prizeTier !== "miss")
        .sort((a, b) => {
          const order = { S: 0, A: 1, B: 2, miss: 3 };
          return order[a.prizeTier] - order[b.prizeTier];
        })
    : [];

  const isLoading = isLoadingGacha || isLoadingCards;

  // 確認ダイアログを表示
  const handlePlayRequest = (count: 1 | 10 | 100) => {
    if (!user) {
      toast.error("ログインが必要です");
      navigate("/auth");
      return;
    }

    if (!gacha) return;

    if (gacha.remaining_slots < count) {
      toast.error(`残り口数が足りません（残り: ${gacha.remaining_slots}口）`);
      return;
    }

    setPendingPlayCount(count);
    setShowConfirm(true);
  };

  // 実際にガチャを回す
  const handleConfirmPlay = async () => {
    if (!user || !gacha) return;

    const count = pendingPlayCount;
    const totalCost = gacha.price_per_play * count;

    if (!profile || profile.points_balance < totalCost) {
      toast.error(`ポイントが足りません（必要: ${totalCost.toLocaleString()}pt）`);
      setShowConfirm(false);
      return;
    }

    setShowConfirm(false);
    setIsPlaying(true);

    try {
      const { data, error } = await supabase.functions.invoke("play-gacha", {
        body: {
          gachaId: gacha.id,
          playCount: count,
        },
      });

      if (error) {
        throw new Error(error.message || "ガチャの実行に失敗しました");
      }

      if (data.error) {
        throw new Error(data.error);
      }

      // 最高賞に応じた演出パラメータを設定
      const highestTier = getHighestPrizeTier(data.drawnCards);
      const params = getAnimationParamsForPrizeTier(highestTier, count);
      setAnimParams(params);

      // 結果をRefに保持（演出完了後に表示）
      pendingResultRef.current = {
        drawnCards: data.drawnCards,
        totalCost: data.totalCost,
        newBalance: data.newBalance,
      };

      // キャッシュを更新
      queryClient.invalidateQueries({ queryKey: ["gacha-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["gacha-cards", id] });
      queryClient.invalidateQueries({ queryKey: ["user-profile", user.id] });
    } catch (error: unknown) {
      setIsPlaying(false);
      const message = error instanceof Error ? error.message : "エラーが発生しました";
      toast.error(message);
    }
  };

  // 演出完了時の処理
  const handleAnimationComplete = () => {
    setIsPlaying(false);
    if (pendingResultRef.current) {
      setGachaResult(pendingResultRef.current);
      pendingResultRef.current = null;
      setShowResult(true);
    }
  };

  const handleCancelConfirm = () => {
    setShowConfirm(false);
  };

  const handleCloseResult = () => {
    setShowResult(false);
    setGachaResult(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!gacha) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">ガチャが見つかりませんでした</p>
          <Button onClick={() => navigate(-1)}>戻る</Button>
        </div>
      </div>
    );
  }

  const soldPercentage = gacha.total_slots > 0
    ? ((gacha.total_slots - gacha.remaining_slots) / gacha.total_slots) * 100
    : 0;

  const userBalance = profile?.points_balance ?? 0;

  return (
    <>
      <div className="min-h-screen bg-background pb-24">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
          <div className="container px-4 h-14 flex items-center justify-between">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="text-sm">戻る</span>
            </button>
            <div className="flex items-center gap-2">
              {user && (
                <div className="points-badge">
                  <span className="text-xs">残高</span>
                  <span className="font-bold">{userBalance.toLocaleString()}pt</span>
                </div>
              )}
              <Button variant="ghost" size="icon">
                <Share2 className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container px-4 py-4">
          {/* Banner with Title */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative rounded-xl overflow-hidden mb-6"
          >
            {gacha.banner_url ? (
              <img
                src={gacha.banner_url}
                alt={gacha.title}
                className="w-full aspect-video object-cover"
              />
            ) : (
              <div className="w-full aspect-video bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                <span className="text-2xl font-bold text-foreground">{gacha.title}</span>
              </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
              <h1 className="text-white font-bold text-lg line-clamp-2">{gacha.title}</h1>
            </div>
          </motion.div>

          {/* Card Lineup Section */}
          <section className="mb-6">
            <h2 className="text-lg font-bold mb-4 text-center text-foreground">
              カードラインナップ
            </h2>
            
            {groupedCards.length === 0 ? (
              <p className="text-center text-muted-foreground">カードが登録されていません</p>
            ) : (
              <motion.div
                className="grid grid-cols-2 gap-3"
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: {},
                  visible: {
                    transition: { staggerChildren: 0.05 },
                  },
                }}
              >
                {groupedCards.map((card) => (
                  <motion.div
                    key={card.id}
                    variants={{
                      hidden: { opacity: 0, scale: 0.9 },
                      visible: { opacity: 1, scale: 1 },
                    }}
                    className={`relative rounded-lg overflow-hidden bg-card border border-border ${prizeTierStyles[card.prizeTier]?.glow || ""}`}
                  >
                    <Badge
                      className={`absolute top-2 left-2 z-10 ${prizeTierStyles[card.prizeTier]?.bg} ${prizeTierStyles[card.prizeTier]?.text} font-black text-xs px-2`}
                    >
                      {prizeTierStyles[card.prizeTier]?.label}
                    </Badge>
                    
                    <div className="absolute bottom-2 right-2 z-10 bg-foreground/80 text-background text-xs font-bold px-2 py-0.5 rounded">
                      ×{card.quantity}
                    </div>
                    
                    {card.imageUrl ? (
                      <img
                        src={card.imageUrl}
                        alt={card.name}
                        className="w-full aspect-[3/4] object-cover"
                      />
                    ) : (
                      <div className="w-full aspect-[3/4] bg-muted flex items-center justify-center p-2">
                        <span className="text-xs text-muted-foreground text-center line-clamp-3">{card.name}</span>
                      </div>
                    )}
                  </motion.div>
                ))}
              </motion.div>
            )}
          </section>

          {/* Gacha Info */}
          <section className="bg-card rounded-xl p-4 border border-border">
            <h3 className="font-bold text-foreground mb-2">ガチャ情報</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">1回の価格</span>
                <span className="font-bold text-primary flex items-center gap-1">
                  <Coins className="h-4 w-4" />
                  {gacha.price_per_play.toLocaleString()} コイン
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">総口数</span>
                <span className="font-bold text-foreground">{gacha.total_slots.toLocaleString()}口</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">残り口数</span>
                <span className="font-bold text-accent">{gacha.remaining_slots.toLocaleString()}口</span>
              </div>
            </div>
          </section>
        </main>

        {/* Fixed Bottom Bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-3 z-50">
          <div className="container">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center gap-1 text-sm">
                <span className="text-primary font-bold">🔥</span>
                <span className="text-muted-foreground">{gacha.remaining_slots.toLocaleString()}/{gacha.total_slots.toLocaleString()}</span>
              </div>
              <Progress value={soldPercentage} className="flex-1 h-2" />
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {gacha.remaining_slots <= gacha.total_slots * 0.3 ? "残りわずかお早めに!!" : ""}
              </span>
            </div>
            
            <div className="grid grid-cols-3 gap-2">
              <Button
                className="btn-gacha h-12 text-sm font-bold"
                onClick={() => handlePlayRequest(1)}
                disabled={isPlaying || gacha.remaining_slots < 1}
              >
                <div className="flex flex-col items-center">
                  <span>1回ガチャ</span>
                  <span className="text-xs opacity-80">{gacha.price_per_play.toLocaleString()}コイン</span>
                </div>
              </Button>
              <Button
                className="h-12 text-sm font-bold bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white"
                onClick={() => handlePlayRequest(10)}
                disabled={isPlaying || gacha.remaining_slots < 10}
              >
                <div className="flex flex-col items-center">
                  <span>10連ガチャ</span>
                  <span className="text-xs opacity-80">{(gacha.price_per_play * 10).toLocaleString()}コイン</span>
                </div>
              </Button>
              <Button
                className="h-12 text-sm font-bold bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                onClick={() => handlePlayRequest(100)}
                disabled={isPlaying || gacha.remaining_slots < 100}
              >
                <div className="flex flex-col items-center">
                  <span>100連ガチャ</span>
                  <span className="text-xs opacity-80">{(gacha.price_per_play * 100).toLocaleString()}コイン</span>
                </div>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirm Dialog */}
      <GachaConfirmDialog
        isOpen={showConfirm}
        onConfirm={handleConfirmPlay}
        onCancel={handleCancelConfirm}
        playCount={pendingPlayCount}
        pricePerPlay={gacha?.price_per_play || 0}
        currentBalance={userBalance}
        gachaTitle={gacha?.title || ""}
      />

      {/* Play Animation - 新演出システム */}
      <GachaAnimationSystem
        isPlaying={isPlaying}
        onComplete={handleAnimationComplete}
        colorTheme={animParams.colorTheme}
        intensity={animParams.intensity}
        cameraMotion={animParams.cameraMotion}
        particleStyle={animParams.particleStyle}
        playCount={pendingPlayCount}
        isRainbow={animParams.isRainbow}
      />

      {/* Result Modal */}
      <GachaResultModal
        isOpen={showResult}
        onClose={handleCloseResult}
        drawnCards={gachaResult?.drawnCards || []}
        totalCost={gachaResult?.totalCost || 0}
        newBalance={gachaResult?.newBalance || 0}
      />
    </>
  );
};

export default GachaDetail;
