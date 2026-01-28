import { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Coins, Share2, Loader2, Zap, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
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
import { CardPackAnimation } from "@/components/gacha/CardPackAnimation";
import type { Database } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

type GachaMaster = Database["public"]["Tables"]["gacha_masters"]["Row"];
type CardPublic = Database["public"]["Views"]["cards_public"]["Row"];
type PrizeTier = Database["public"]["Enums"]["prize_tier"];

const prizeTierStyles: Record<PrizeTier, { bg: string; text: string; glow: string; label: string; gradient: string }> = {
  S: { 
    bg: "bg-gradient-to-br from-red-500 to-rose-600", 
    text: "text-white", 
    glow: "shadow-[0_0_25px_rgba(239,68,68,0.6)]", 
    label: "S TIER",
    gradient: "from-red-500 via-rose-500 to-red-600"
  },
  A: { 
    bg: "bg-gradient-to-br from-amber-400 to-orange-500", 
    text: "text-white", 
    glow: "shadow-[0_0_20px_rgba(245,158,11,0.5)]", 
    label: "A TIER",
    gradient: "from-amber-400 via-yellow-500 to-orange-500"
  },
  B: { 
    bg: "bg-gradient-to-br from-cyan-400 to-blue-500", 
    text: "text-white", 
    glow: "shadow-[0_0_15px_rgba(59,130,246,0.5)]", 
    label: "B TIER",
    gradient: "from-cyan-400 via-blue-500 to-indigo-500"
  },
  miss: { 
    bg: "bg-gradient-to-br from-gray-500 to-gray-600", 
    text: "text-white", 
    glow: "", 
    label: "C TIER",
    gradient: "from-gray-400 via-gray-500 to-gray-600"
  },
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

// Dark theme prize card component
const DarkThemePrizeCard = ({ card, compact = false }: { card: GroupedCard; compact?: boolean }) => {
  const style = prizeTierStyles[card.prizeTier];
  
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, scale: 0.9 },
        visible: { opacity: 1, scale: 1 },
      }}
      className={cn(
        "relative rounded-lg overflow-hidden",
        "bg-[hsl(var(--dark-surface-elevated))]",
        "border border-[hsl(var(--dark-border))]",
        style?.glow || ""
      )}
    >
      {/* Tier Badge */}
      <Badge
        className={cn(
          "absolute top-1 left-1 z-10 font-black border-0",
          style?.bg,
          style?.text,
          compact ? "text-[10px] px-1.5" : "text-xs px-2"
        )}
      >
        {style?.label}
      </Badge>
      
      {/* Quantity Badge */}
      <div className={cn(
        "absolute bottom-1 right-1 z-10 font-bold rounded",
        "bg-[hsl(var(--dark-neon-gold))] text-[hsl(var(--dark-background))]",
        compact ? "text-[10px] px-1" : "text-xs px-2 py-0.5"
      )}>
        ×{card.quantity}
      </div>
      
      {card.imageUrl ? (
        <div className="w-full aspect-[3/4] bg-[hsl(var(--dark-surface))] flex items-center justify-center">
          <img
            src={card.imageUrl}
            alt={card.name}
            className="w-full h-full object-contain"
          />
        </div>
      ) : (
        <div className="w-full aspect-[3/4] bg-[hsl(var(--dark-surface))] flex items-center justify-center p-1">
          <span className={cn(
            "text-[hsl(var(--dark-muted))] text-center line-clamp-3",
            compact ? "text-[8px]" : "text-xs"
          )}>
            {card.name}
          </span>
        </div>
      )}
      
      {/* Item Name */}
      <div className="p-2 bg-[hsl(var(--dark-surface-elevated))]">
        <p className={cn(
          "font-medium text-[hsl(var(--dark-foreground))] line-clamp-2",
          compact ? "text-[10px]" : "text-xs"
        )}>
          {card.name}
        </p>
        <p className={cn(
          "text-[hsl(var(--dark-neon-gold))]",
          compact ? "text-[8px]" : "text-[10px]"
        )}>
          {card.conversionPoints}pt
        </p>
      </div>
    </motion.div>
  );
};

const DarkThemeGachaDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { tenantSlug } = useTenant();
  const basePath = tenantSlug ? `/${tenantSlug}` : "";
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [gachaResult, setGachaResult] = useState<GachaResult | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingPlayCount, setPendingPlayCount] = useState<number>(1);
  const [pendingDrawnCards, setPendingDrawnCards] = useState<DrawnCard[]>([]);
  
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
  
  const pendingResultRef = useRef<GachaResult | null>(null);

  // Fetch gacha master info
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

  // Fetch card lineup
  const { data: cards, isLoading: isLoadingCards } = useQuery({
    queryKey: ["gacha-cards", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cards_public")
        .select("*")
        .eq("gacha_id", id!)
        .order("rarity", { ascending: true });
      if (error) throw error;
      return data as CardPublic[];
    },
    enabled: !!id,
  });

  // Fetch user points balance
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

  // Group cards by name and tier
  const groupedCards: GroupedCard[] = cards
    ? Object.values(
        cards.reduce((acc, card) => {
          const key = `${card.name}-${card.prize_tier}`;
          if (!acc[key]) {
            acc[key] = {
              id: card.id || "",
              name: card.name || "",
              imageUrl: card.image_url,
              prizeTier: (card.prize_tier || "miss") as PrizeTier,
              conversionPoints: card.conversion_points || 0,
              quantity: 0,
            };
          }
          acc[key].quantity++;
          return acc;
        }, {} as Record<string, GroupedCard>)
      )
        .sort((a, b) => {
          const order = { S: 0, A: 1, B: 2, miss: 3 };
          return order[a.prizeTier] - order[b.prizeTier];
        })
    : [];

  const isLoading = isLoadingGacha || isLoadingCards;

  const handlePlayRequest = (count: number) => {
    if (!user) {
      toast.error("Please login to play");
      navigate(`${basePath}/auth`);
      return;
    }

    if (!gacha) return;

    if (gacha.remaining_slots < count) {
      toast.error(`Not enough slots remaining (${gacha.remaining_slots} left)`);
      return;
    }

    setPendingPlayCount(count);
    setShowConfirm(true);
  };

  const handlePlayAll = () => {
    if (!gacha) return;
    handlePlayRequest(gacha.remaining_slots);
  };

  const handleConfirmPlay = async () => {
    if (!user || !gacha) return;

    const count = pendingPlayCount;
    const totalCost = gacha.price_per_play * count;

    if (!profile || profile.points_balance < totalCost) {
      toast.error(`Not enough points (required: ${totalCost.toLocaleString()}pt)`);
      setShowConfirm(false);
      return;
    }

    setShowConfirm(false);

    try {
      const { data, error } = await supabase.functions.invoke("play-gacha", {
        body: {
          gachaId: gacha.id,
          playCount: count,
        },
      });

      if (error) {
        throw new Error(error.message || "Failed to play gacha");
      }

      if (data.error) {
        throw new Error(data.error);
      }

      const highestTier = getHighestPrizeTier(data.drawnCards);
      const params = getAnimationParamsForPrizeTier(highestTier, count);
      setAnimParams(params);
      setPendingDrawnCards(data.drawnCards);

      pendingResultRef.current = {
        drawnCards: data.drawnCards,
        totalCost: data.totalCost,
        newBalance: data.newBalance,
      };

      setIsPlaying(true);

      queryClient.invalidateQueries({ queryKey: ["gacha-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["gacha-cards", id] });
      queryClient.invalidateQueries({ queryKey: ["user-profile", user.id] });
    } catch (error: unknown) {
      setIsPlaying(false);
      const message = error instanceof Error ? error.message : "An error occurred";
      toast.error(message);
    }
  };

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
      <div className="dark-theme min-h-screen bg-[hsl(var(--dark-background))] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--dark-neon-primary))]" />
      </div>
    );
  }

  if (!gacha) {
    return (
      <div className="dark-theme min-h-screen bg-[hsl(var(--dark-background))] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[hsl(var(--dark-muted))] mb-4">Gacha not found</p>
          <Button 
            onClick={() => navigate(-1)}
            className="bg-[hsl(var(--dark-neon-primary))] text-[hsl(var(--dark-background))]"
          >
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const soldPercentage = gacha.total_slots > 0
    ? ((gacha.total_slots - gacha.remaining_slots) / gacha.total_slots) * 100
    : 0;

  const userBalance = profile?.points_balance ?? 0;

  // Tier section renderer
  const renderTierSection = (tier: PrizeTier, tierCards: GroupedCard[]) => {
    if (tierCards.length === 0) return null;
    const style = prizeTierStyles[tier];
    
    return (
      <div key={tier} className="mb-8">
        <div className="flex items-center justify-center mb-4">
          <div className="relative">
            <span 
              className={cn(
                "text-3xl font-black tracking-wider bg-gradient-to-r bg-clip-text text-transparent",
                `bg-gradient-to-r ${style.gradient}`
              )}
              style={{ filter: "drop-shadow(0 2px 8px rgba(255,255,255,0.2))" }}
            >
              {style.label}
            </span>
            {tier === "S" && (
              <>
                <div className="absolute -top-2 -left-4 text-[hsl(var(--dark-neon-gold))] text-xl">✦</div>
                <div className="absolute -top-1 -right-4 text-[hsl(var(--dark-neon-gold))] text-lg">✦</div>
              </>
            )}
          </div>
        </div>
        <motion.div
          className={cn(
            "grid gap-2",
            tierCards.length === 1 ? "grid-cols-1 max-w-[120px] mx-auto" 
              : tierCards.length === 2 ? "grid-cols-2 max-w-[250px] mx-auto" 
              : "grid-cols-3 sm:grid-cols-4 md:grid-cols-6"
          )}
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.05 } },
          }}
        >
          {tierCards.map((card) => (
            <DarkThemePrizeCard key={card.id} card={card} />
          ))}
        </motion.div>
      </div>
    );
  };

  return (
    <div className="dark-theme">
      <div className="min-h-screen bg-[hsl(var(--dark-background))] pb-32">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-[hsl(var(--dark-surface)/0.95)] backdrop-blur border-b border-[hsl(var(--dark-border))]">
          <div className="container px-4 h-14 flex items-center justify-between">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1 text-[hsl(var(--dark-muted))] hover:text-[hsl(var(--dark-foreground))] transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="text-sm">Back</span>
            </button>
            <div className="flex items-center gap-2">
              {user && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[hsl(var(--dark-neon-gold)/0.2)] border border-[hsl(var(--dark-neon-gold)/0.5)]">
                  <Coins className="h-4 w-4 text-[hsl(var(--dark-neon-gold))]" />
                  <span className="text-sm font-bold text-[hsl(var(--dark-neon-gold))]">{userBalance.toLocaleString()}pt</span>
                </div>
              )}
              <Button variant="ghost" size="icon" className="text-[hsl(var(--dark-muted))]">
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
            className="relative rounded-xl overflow-hidden mb-6 border border-[hsl(var(--dark-border))]"
          >
            {gacha.banner_url ? (
              <img
                src={gacha.banner_url}
                alt={gacha.title}
                className="w-full aspect-video object-cover"
              />
            ) : (
              <div className="w-full aspect-video bg-gradient-to-br from-[hsl(var(--dark-neon-primary)/0.2)] to-[hsl(var(--dark-neon-secondary)/0.2)] flex items-center justify-center">
                <span className="text-2xl font-bold text-[hsl(var(--dark-foreground))]">{gacha.title}</span>
              </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[hsl(var(--dark-background))] to-transparent p-4">
              <h1 className="text-[hsl(var(--dark-foreground))] font-bold text-lg line-clamp-2">{gacha.title}</h1>
            </div>
          </motion.div>

          {/* Card Lineup Section */}
          <section className="mb-6">
            <h2 className="text-xl font-bold mb-6 text-center text-[hsl(var(--dark-foreground))]">
              Card Lineup
            </h2>
            
            {groupedCards.length === 0 ? (
              <p className="text-center text-[hsl(var(--dark-muted))]">No cards registered</p>
            ) : (
              <div className="space-y-6">
                {renderTierSection("S", groupedCards.filter(c => c.prizeTier === "S"))}
                {renderTierSection("A", groupedCards.filter(c => c.prizeTier === "A"))}
                {renderTierSection("B", groupedCards.filter(c => c.prizeTier === "B"))}
                {renderTierSection("miss", groupedCards.filter(c => c.prizeTier === "miss"))}
              </div>
            )}
          </section>

          {/* Gacha Info */}
          <section className="rounded-xl p-4 border border-[hsl(var(--dark-border))] bg-[hsl(var(--dark-surface-elevated))]">
            <h3 className="font-bold text-[hsl(var(--dark-foreground))] mb-3 flex items-center gap-2">
              <Info className="h-4 w-4 text-[hsl(var(--dark-neon-primary))]" />
              Gacha Info
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[hsl(var(--dark-muted))]">Price per Play</span>
                <span className="font-bold text-[hsl(var(--dark-neon-gold))] flex items-center gap-1">
                  <Coins className="h-4 w-4" />
                  ¥{gacha.price_per_play.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[hsl(var(--dark-muted))]">Total Slots</span>
                <span className="font-bold text-[hsl(var(--dark-foreground))]">{gacha.total_slots.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[hsl(var(--dark-muted))]">Remaining</span>
                <span className="font-bold text-[hsl(var(--dark-neon-secondary))]">{gacha.remaining_slots.toLocaleString()}</span>
              </div>
            </div>
          </section>

          {/* Notice Section */}
          {(gacha as any).notice_text && (
            <section className="rounded-xl p-4 border border-[hsl(var(--dark-neon-accent)/0.5)] bg-[hsl(var(--dark-neon-accent)/0.1)] mt-4">
              <h3 className="font-bold text-[hsl(var(--dark-foreground))] mb-2 flex items-center gap-2">
                <span className="text-[hsl(var(--dark-neon-accent))]">⚠️</span>
                Notice
              </h3>
              <p className="text-sm text-[hsl(var(--dark-muted))] whitespace-pre-line">
                {(gacha as any).notice_text}
              </p>
            </section>
          )}
        </main>

        {/* Fixed Bottom Bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-[hsl(var(--dark-surface)/0.95)] backdrop-blur border-t border-[hsl(var(--dark-border))] p-3 z-50">
          <div className="container">
            {/* Progress section */}
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center gap-1 text-sm">
                <Zap className="h-4 w-4 text-[hsl(var(--dark-neon-primary))]" />
                <span className="text-[hsl(var(--dark-muted))]">{gacha.remaining_slots.toLocaleString()}/{gacha.total_slots.toLocaleString()}</span>
              </div>
              <div className="flex-1 h-2 rounded-full bg-[hsl(var(--dark-input))] overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${soldPercentage}%` }}
                  className="h-full rounded-full bg-gradient-to-r from-[hsl(var(--dark-neon-primary))] to-[hsl(var(--dark-neon-secondary))]"
                />
              </div>
              {gacha.remaining_slots <= gacha.total_slots * 0.3 && (
                <span className="text-xs text-[hsl(var(--dark-neon-accent))] whitespace-nowrap">
                  Almost gone!
                </span>
              )}
            </div>
            
            {/* Play buttons */}
            <div className="grid grid-cols-4 gap-2">
              <Button
                className={cn(
                  "h-12 text-xs font-bold rounded-lg",
                  "bg-gradient-to-r from-[hsl(var(--dark-neon-primary))] to-[hsl(var(--dark-neon-secondary))]",
                  "text-[hsl(var(--dark-background))] shadow-[0_0_15px_hsl(var(--dark-neon-primary)/0.4)]"
                )}
                onClick={() => handlePlayRequest(1)}
                disabled={isPlaying || gacha.remaining_slots < 1}
              >
                <div className="flex flex-col items-center">
                  <span>1x Play</span>
                  <span className="text-[10px] opacity-80">¥{gacha.price_per_play.toLocaleString()}</span>
                </div>
              </Button>
              <Button
                className="h-12 text-xs font-bold rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white"
                onClick={() => handlePlayRequest(10)}
                disabled={isPlaying || gacha.remaining_slots < 10}
              >
                <div className="flex flex-col items-center">
                  <span>10x Play</span>
                  <span className="text-[10px] opacity-80">¥{(gacha.price_per_play * 10).toLocaleString()}</span>
                </div>
              </Button>
              <Button
                className="h-12 text-xs font-bold rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                onClick={() => handlePlayRequest(100)}
                disabled={isPlaying || gacha.remaining_slots < 100}
              >
                <div className="flex flex-col items-center">
                  <span>100x</span>
                  <span className="text-[10px] opacity-80">¥{(gacha.price_per_play * 100).toLocaleString()}</span>
                </div>
              </Button>
              <Button
                className="h-12 text-xs font-bold rounded-lg bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white animate-pulse"
                onClick={handlePlayAll}
                disabled={isPlaying || gacha.remaining_slots < 1}
              >
                <div className="flex flex-col items-center">
                  <span>All In</span>
                  <span className="text-[10px] opacity-80">¥{(gacha.price_per_play * gacha.remaining_slots).toLocaleString()}</span>
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
        playCount={pendingPlayCount as 1 | 10 | 100}
        pricePerPlay={gacha?.price_per_play || 0}
        currentBalance={userBalance}
        gachaTitle={gacha?.title || ""}
      />

      {/* Animation */}
      {gacha.animation_type === "B" ? (
        <CardPackAnimation
          isPlaying={isPlaying}
          onComplete={handleAnimationComplete}
          onSkip={handleAnimationComplete}
          drawnCards={pendingDrawnCards}
          playCount={pendingPlayCount}
          fakeSChance={gacha.fake_s_tier_chance ?? 15}
        />
      ) : (
        <GachaAnimationSystem
          isPlaying={isPlaying}
          onComplete={handleAnimationComplete}
          onSkip={handleAnimationComplete}
          colorTheme={animParams.colorTheme}
          intensity={animParams.intensity}
          cameraMotion={animParams.cameraMotion}
          particleStyle={animParams.particleStyle}
          playCount={pendingPlayCount}
          isRainbow={animParams.isRainbow}
        />
      )}

      {/* Result Modal */}
      <GachaResultModal
        isOpen={showResult}
        onClose={handleCloseResult}
        drawnCards={gachaResult?.drawnCards || []}
        totalCost={gachaResult?.totalCost || 0}
        newBalance={gachaResult?.newBalance || 0}
      />
    </div>
  );
};

export default DarkThemeGachaDetail;
