import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback } from "react";
import { useGachaSound } from "@/hooks/useGachaSound";
import { Package, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DrawnCard {
  slotId: string;
  cardId: string;
  name: string;
  imageUrl: string | null;
  prizeTier: string;
  conversionPoints: number;
}

interface CardPackAnimationProps {
  isPlaying: boolean;
  onComplete: () => void;
  onSkip?: () => void;
  drawnCards: DrawnCard[];
  playCount: number;
}

// 7色レインボー
const RAINBOW_COLORS = [
  "#ff0000", "#ff7f00", "#ffff00", "#00ff00", 
  "#00ffff", "#007fff", "#8b00ff"
];

// 賞に応じた演出設定
const TIER_CONFIG = {
  S: {
    bgGradient: "from-red-600 via-orange-500 to-yellow-400",
    glowColor: "rgba(255, 200, 50, 0.9)",
    isRainbow: true,
    particleCount: 100,
    explosionScale: 1.8,
    label: "★S賞★",
    labelBg: "bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500",
  },
  A: {
    bgGradient: "from-amber-600 via-yellow-500 to-amber-400",
    glowColor: "rgba(255, 180, 0, 0.7)",
    isRainbow: false,
    particleCount: 60,
    explosionScale: 1.5,
    label: "A賞",
    labelBg: "bg-gradient-to-r from-amber-400 to-yellow-500",
  },
  B: {
    bgGradient: "from-blue-600 via-indigo-500 to-purple-400",
    glowColor: "rgba(100, 150, 255, 0.6)",
    isRainbow: false,
    particleCount: 40,
    explosionScale: 1.3,
    label: "B賞",
    labelBg: "bg-gradient-to-r from-blue-400 to-purple-500",
  },
  miss: {
    bgGradient: "from-gray-600 via-gray-500 to-gray-400",
    glowColor: "rgba(150, 150, 150, 0.4)",
    isRainbow: false,
    particleCount: 20,
    explosionScale: 1.1,
    label: "C賞",
    labelBg: "bg-gray-500",
  },
};

// フェイク演出の確率（ハズレでもS賞風の演出が出る確率）
const FAKE_S_TIER_CHANCE = 0.15; // 15%

export function CardPackAnimation({
  isPlaying,
  onComplete,
  onSkip,
  drawnCards,
  playCount,
}: CardPackAnimationProps) {
  const [phase, setPhase] = useState<"pack" | "tearing" | "reveal" | "explosion" | "cards">("pack");
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [showFlash, setShowFlash] = useState(false);
  const [rainbowIndex, setRainbowIndex] = useState(0);
  const [isFakeOut, setIsFakeOut] = useState(false);
  const sound = useGachaSound();

  // 最高賞を取得
  const getHighestTier = useCallback(() => {
    if (drawnCards.some(c => c.prizeTier === "S")) return "S";
    if (drawnCards.some(c => c.prizeTier === "A")) return "A";
    if (drawnCards.some(c => c.prizeTier === "B")) return "B";
    return "miss";
  }, [drawnCards]);

  const highestTier = getHighestTier();
  const config = TIER_CONFIG[highestTier as keyof typeof TIER_CONFIG] || TIER_CONFIG.miss;

  // フェイク演出判定
  useEffect(() => {
    if (isPlaying && highestTier === "miss") {
      setIsFakeOut(Math.random() < FAKE_S_TIER_CHANCE);
    } else {
      setIsFakeOut(false);
    }
  }, [isPlaying, highestTier]);

  // レインボーサイクル
  useEffect(() => {
    if (!isPlaying || !config.isRainbow) return;
    const interval = setInterval(() => {
      setRainbowIndex(prev => (prev + 1) % RAINBOW_COLORS.length);
    }, 80);
    return () => clearInterval(interval);
  }, [isPlaying, config.isRainbow]);

  // スキップ処理
  const handleSkip = useCallback(() => {
    sound.stopAll();
    if (onSkip) {
      onSkip();
    } else {
      onComplete();
    }
  }, [sound, onSkip, onComplete]);

  // フェーズ管理
  useEffect(() => {
    if (!isPlaying) {
      setPhase("pack");
      setCurrentCardIndex(0);
      return;
    }

    // パック登場
    setPhase("pack");
    sound.playSlotSpin();

    const timers: NodeJS.Timeout[] = [];

    // パック破れ演出
    timers.push(setTimeout(() => {
      setPhase("tearing");
      sound.playDrumRoll(1.5);
      if (config.isRainbow || isFakeOut) {
        sound.playHeartbeat(5);
      }
    }, 1200));

    // リビール前のフラッシュ
    timers.push(setTimeout(() => {
      setShowFlash(true);
      sound.playImpact();
      setTimeout(() => setShowFlash(false), 150);
    }, 2500));

    // カード噴出
    timers.push(setTimeout(() => {
      setPhase("explosion");
      if (config.isRainbow && !isFakeOut) {
        sound.playJackpot();
      } else if (highestTier === "A") {
        sound.playReveal(true);
        sound.playCoinSound(5);
      } else if (highestTier === "B") {
        sound.playReveal(false);
        sound.playCoinSound(3);
      } else if (isFakeOut) {
        // フェイク演出後のがっかり
        setTimeout(() => sound.playMiss(), 300);
      } else {
        sound.playMiss();
      }
    }, 2700));

    // カード順次表示
    timers.push(setTimeout(() => {
      setPhase("cards");
      setCurrentCardIndex(0);
    }, 3500));

    // 完了
    const cardRevealTime = Math.min(drawnCards.length * 200, 3000); // 最大3秒
    timers.push(setTimeout(() => {
      onComplete();
    }, 3500 + cardRevealTime + 1500));

    return () => timers.forEach(clearTimeout);
  }, [isPlaying, sound, config.isRainbow, highestTier, isFakeOut, drawnCards.length, onComplete]);

  // カード順次表示
  useEffect(() => {
    if (phase !== "cards" || !isPlaying) return;
    
    const interval = setInterval(() => {
      setCurrentCardIndex(prev => {
        if (prev >= drawnCards.length - 1) {
          clearInterval(interval);
          return prev;
        }
        sound.playCoinSound(1);
        return prev + 1;
      });
    }, 200);

    return () => clearInterval(interval);
  }, [phase, isPlaying, drawnCards.length, sound]);

  // パーティクル生成
  const particles = Array.from({ length: config.particleCount }, (_, i) => ({
    id: i,
    x: 50 + (Math.random() - 0.5) * 80,
    y: 50 + (Math.random() - 0.5) * 80,
    size: Math.random() * 12 + 6,
    delay: Math.random() * 0.5,
    color: config.isRainbow 
      ? RAINBOW_COLORS[i % RAINBOW_COLORS.length]
      : config.glowColor,
  }));

  // コイン爆発パーティクル
  const coinParticles = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    angle: (360 / 30) * i,
    distance: 100 + Math.random() * 150,
    delay: Math.random() * 0.3,
  }));

  if (!isPlaying) return null;

  // 実際に使う背景グラデーション（フェイク時はS賞風）
  const displayConfig = isFakeOut && phase !== "cards" 
    ? TIER_CONFIG.S 
    : config;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[110] overflow-hidden"
        style={{ 
          background: config.isRainbow || (isFakeOut && phase !== "cards")
            ? `linear-gradient(135deg, ${RAINBOW_COLORS[rainbowIndex]}, ${RAINBOW_COLORS[(rainbowIndex + 2) % 7]})`
            : `linear-gradient(to bottom, #0a0a0a, #1a1a2e)` 
        }}
      >
        {/* フラッシュ */}
        <AnimatePresence>
          {showFlash && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 bg-white"
            />
          )}
        </AnimatePresence>

        {/* 背景グロー */}
        <motion.div
          className="absolute inset-0"
          animate={{
            opacity: phase === "explosion" || phase === "cards" ? 0.8 : 0.3,
          }}
          style={{
            background: `radial-gradient(circle at center, ${displayConfig.glowColor} 0%, transparent 60%)`,
          }}
        />

        {/* パーティクル */}
        {(phase === "explosion" || phase === "cards") && (
          <div className="absolute inset-0 pointer-events-none">
            {particles.map(p => (
              <motion.div
                key={p.id}
                className="absolute rounded-full"
                style={{
                  width: p.size,
                  height: p.size,
                  background: p.color,
                  boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
                }}
                initial={{ x: "50%", y: "50%", opacity: 0, scale: 0 }}
                animate={{
                  x: `${p.x}%`,
                  y: `${p.y}%`,
                  opacity: [0, 1, 1, 0],
                  scale: [0, 1, 1.5, 0],
                }}
                transition={{
                  duration: 1.5,
                  delay: p.delay,
                  repeat: Infinity,
                  repeatDelay: 0.5,
                }}
              />
            ))}
          </div>
        )}

        {/* コイン爆発 */}
        {(phase === "explosion" || phase === "cards") && highestTier !== "miss" && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            {coinParticles.map(p => (
              <motion.div
                key={p.id}
                className="absolute w-4 h-4 rounded-full bg-gradient-to-br from-yellow-300 to-amber-500"
                style={{
                  boxShadow: "0 0 10px rgba(255, 200, 50, 0.8)",
                }}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{
                  x: Math.cos(p.angle * Math.PI / 180) * p.distance,
                  y: Math.sin(p.angle * Math.PI / 180) * p.distance,
                  opacity: [1, 1, 0],
                  scale: [1, 0.8, 0.3],
                  rotate: 720,
                }}
                transition={{
                  duration: 1.2,
                  delay: p.delay,
                  ease: "easeOut",
                }}
              />
            ))}
          </div>
        )}

        {/* パック */}
        <div className="absolute inset-0 flex items-center justify-center">
          <AnimatePresence mode="wait">
            {(phase === "pack" || phase === "tearing") && (
              <motion.div
                key="pack"
                className="relative"
                initial={{ scale: 0.5, opacity: 0, rotateY: -30 }}
                animate={{ 
                  scale: phase === "tearing" ? [1, 1.1, 1.05] : 1, 
                  opacity: 1, 
                  rotateY: 0,
                  rotateZ: phase === "tearing" ? [-3, 3, -3, 3, 0] : 0,
                }}
                exit={{ 
                  scale: 2, 
                  opacity: 0,
                  filter: "blur(20px)",
                }}
                transition={{ duration: 0.5 }}
              >
                {/* パック本体 */}
                <div 
                  className={`w-48 h-72 rounded-xl overflow-hidden bg-gradient-to-br ${displayConfig.bgGradient} relative`}
                  style={{
                    boxShadow: `0 0 60px ${displayConfig.glowColor}`,
                  }}
                >
                  {/* パック表面のデザイン */}
                  <div className="absolute inset-0 bg-black/10" />
                  <div className="absolute inset-4 border-2 border-white/30 rounded-lg" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                    <Package className="w-16 h-16 mb-2 opacity-80" />
                    <span className="text-lg font-bold">{playCount}枚</span>
                    <span className="text-sm opacity-70">CARD PACK</span>
                  </div>
                  
                  {/* 破れエフェクト */}
                  {phase === "tearing" && (
                    <>
                      <motion.div
                        className="absolute top-0 left-1/2 w-1 bg-white"
                        initial={{ height: 0, x: "-50%" }}
                        animate={{ height: "100%" }}
                        transition={{ duration: 0.8, ease: "easeIn" }}
                        style={{ boxShadow: "0 0 20px white" }}
                      />
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0, 0.8, 0] }}
                        transition={{ duration: 0.5, delay: 0.5 }}
                      />
                    </>
                  )}
                </div>
              </motion.div>
            )}

            {/* 爆発・カード噴出フェーズ */}
            {(phase === "explosion" || phase === "cards") && (
              <motion.div
                key="cards-container"
                className="relative w-full max-w-lg px-4"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
              >
                {/* 賞ラベル */}
                <motion.div
                  className="text-center mb-6"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", delay: 0.2 }}
                >
                  <span className={`inline-block px-6 py-2 ${config.labelBg} text-white text-2xl font-black rounded-full`}
                    style={{
                      textShadow: "0 2px 10px rgba(0,0,0,0.5)",
                      boxShadow: `0 0 30px ${config.glowColor}`,
                    }}
                  >
                    {isFakeOut ? "...C賞" : config.label}
                  </span>
                </motion.div>

                {/* カードグリッド */}
                <div className="grid grid-cols-5 gap-2 max-h-[60vh] overflow-y-auto p-2">
                  {drawnCards.slice(0, currentCardIndex + 1).map((card, index) => {
                    const tierStyle = TIER_CONFIG[card.prizeTier as keyof typeof TIER_CONFIG] || TIER_CONFIG.miss;
                    const isLast = index === currentCardIndex;
                    const isHighTier = card.prizeTier === "S" || card.prizeTier === "A";
                    
                    return (
                      <motion.div
                        key={card.slotId}
                        className="relative rounded-lg overflow-hidden"
                        initial={{ 
                          scale: 0, 
                          opacity: 0, 
                          y: -50,
                          rotateY: 180,
                        }}
                        animate={{ 
                          scale: isLast && isHighTier ? [1, 1.1, 1] : 1, 
                          opacity: 1, 
                          y: 0,
                          rotateY: 0,
                        }}
                        transition={{ 
                          type: "spring", 
                          stiffness: 300, 
                          damping: 20,
                        }}
                        style={{
                          boxShadow: isHighTier ? `0 0 15px ${tierStyle.glowColor}` : undefined,
                        }}
                      >
                        {/* 賞バッジ */}
                        <div className={`absolute top-0.5 left-0.5 z-10 px-1 py-0.5 ${tierStyle.labelBg} text-white text-[8px] font-bold rounded`}>
                          {tierStyle.label}
                        </div>
                        
                        {/* カード画像 */}
                        <div className="aspect-[3/4] bg-white">
                          {card.imageUrl ? (
                            <img 
                              src={card.imageUrl} 
                              alt={card.name} 
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gray-200">
                              <Package className="w-6 h-6 text-gray-400" />
                            </div>
                          )}
                        </div>

                        {/* S賞の特別エフェクト */}
                        {card.prizeTier === "S" && (
                          <motion.div
                            className="absolute inset-0 pointer-events-none"
                            animate={{
                              background: [
                                "linear-gradient(45deg, transparent 40%, rgba(255,255,255,0.4) 50%, transparent 60%)",
                                "linear-gradient(45deg, transparent 60%, rgba(255,255,255,0.4) 70%, transparent 80%)",
                              ],
                            }}
                            transition={{
                              duration: 1,
                              repeat: Infinity,
                              repeatType: "reverse",
                            }}
                          />
                        )}
                      </motion.div>
                    );
                  })}
                </div>

                {/* 進捗表示 */}
                <motion.p
                  className="text-center text-white/70 text-sm mt-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  {currentCardIndex + 1} / {drawnCards.length}枚
                </motion.p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* スキップボタン */}
        <div className="absolute bottom-8 left-0 right-0 flex justify-center">
          <Button 
            variant="ghost" 
            onClick={handleSkip}
            className="text-white/70 hover:text-white hover:bg-white/10"
          >
            スキップ →
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// 演出タイプを判定するヘルパー
export function getHighestPrizeTierFromCards(cards: DrawnCard[]): string {
  if (cards.some(c => c.prizeTier === "S")) return "S";
  if (cards.some(c => c.prizeTier === "A")) return "A";
  if (cards.some(c => c.prizeTier === "B")) return "B";
  return "miss";
}
