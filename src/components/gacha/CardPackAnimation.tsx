import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback } from "react";
import { useGachaSound } from "@/hooks/useGachaSound";
import { Package, Sparkles, Star } from "lucide-react";
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
  fakeSChance?: number;
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
    label: "★S賞★",
    labelBg: "bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500",
  },
  A: {
    bgGradient: "from-amber-600 via-yellow-500 to-amber-400",
    glowColor: "rgba(255, 180, 0, 0.7)",
    isRainbow: false,
    particleCount: 60,
    label: "A賞",
    labelBg: "bg-gradient-to-r from-amber-400 to-yellow-500",
  },
  B: {
    bgGradient: "from-blue-600 via-indigo-500 to-purple-400",
    glowColor: "rgba(100, 150, 255, 0.6)",
    isRainbow: false,
    particleCount: 40,
    label: "B賞",
    labelBg: "bg-gradient-to-r from-blue-400 to-purple-500",
  },
  miss: {
    bgGradient: "from-gray-600 via-gray-500 to-gray-400",
    glowColor: "rgba(150, 150, 150, 0.4)",
    isRainbow: false,
    particleCount: 20,
    label: "C賞",
    labelBg: "bg-gray-500",
  },
};

// ホログラムパターン用のCSS
const hologramStyle = {
  background: `
    linear-gradient(
      125deg,
      rgba(255, 0, 0, 0.3) 0%,
      rgba(255, 154, 0, 0.3) 10%,
      rgba(208, 222, 33, 0.3) 20%,
      rgba(79, 220, 74, 0.3) 30%,
      rgba(63, 218, 216, 0.3) 40%,
      rgba(47, 201, 226, 0.3) 50%,
      rgba(28, 127, 238, 0.3) 60%,
      rgba(95, 21, 242, 0.3) 70%,
      rgba(186, 12, 248, 0.3) 80%,
      rgba(251, 7, 217, 0.3) 90%,
      rgba(255, 0, 0, 0.3) 100%
    )
  `,
  backgroundSize: '200% 200%',
};

export function CardPackAnimation({
  isPlaying,
  onComplete,
  onSkip,
  drawnCards,
  playCount,
  fakeSChance = 15,
}: CardPackAnimationProps) {
  const [phase, setPhase] = useState<"pack" | "tearing" | "reveal" | "cards">("pack");
  const [showFlash, setShowFlash] = useState(false);
  const [rainbowIndex, setRainbowIndex] = useState(0);
  const [isFakeOut, setIsFakeOut] = useState(false);
  const [holoAngle, setHoloAngle] = useState(0);
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
      setIsFakeOut(Math.random() * 100 < fakeSChance);
    } else {
      setIsFakeOut(false);
    }
  }, [isPlaying, highestTier, fakeSChance]);

  // レインボーサイクル
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setRainbowIndex(prev => (prev + 1) % RAINBOW_COLORS.length);
    }, 80);
    return () => clearInterval(interval);
  }, [isPlaying]);

  // ホログラムアニメーション
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setHoloAngle(prev => (prev + 3) % 360);
    }, 50);
    return () => clearInterval(interval);
  }, [isPlaying]);

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
    }, 1000));

    // リビール前のフラッシュ
    timers.push(setTimeout(() => {
      setShowFlash(true);
      sound.playImpact();
      setTimeout(() => setShowFlash(false), 150);
    }, 2200));

    // カード一斉表示
    timers.push(setTimeout(() => {
      setPhase("cards");
      if (config.isRainbow && !isFakeOut) {
        sound.playJackpot();
      } else if (highestTier === "A") {
        sound.playReveal(true);
        sound.playCoinSound(5);
      } else if (highestTier === "B") {
        sound.playReveal(false);
        sound.playCoinSound(3);
      } else if (isFakeOut) {
        setTimeout(() => sound.playMiss(), 300);
      } else {
        sound.playMiss();
      }
    }, 2400));

    // 完了
    timers.push(setTimeout(() => {
      onComplete();
    }, 5500));

    return () => timers.forEach(clearTimeout);
  }, [isPlaying, sound, config.isRainbow, highestTier, isFakeOut, onComplete]);

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
  const coinParticles = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    angle: (360 / 40) * i,
    distance: 120 + Math.random() * 180,
    delay: Math.random() * 0.3,
    size: 12 + Math.random() * 8,
  }));

  if (!isPlaying) return null;

  // 実際に使う背景（フェイク時はS賞風）
  const displayConfig = isFakeOut && phase !== "cards" ? TIER_CONFIG.S : config;

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
            opacity: phase === "cards" ? 0.8 : 0.3,
          }}
          style={{
            background: `radial-gradient(circle at center, ${displayConfig.glowColor} 0%, transparent 60%)`,
          }}
        />

        {/* パーティクル */}
        {phase === "cards" && (
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
        {phase === "cards" && highestTier !== "miss" && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            {coinParticles.map(p => (
              <motion.div
                key={p.id}
                className="absolute rounded-full bg-gradient-to-br from-yellow-300 to-amber-500"
                style={{
                  width: p.size,
                  height: p.size,
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
                className="relative perspective-1000"
                initial={{ scale: 0.5, opacity: 0, rotateY: -30 }}
                animate={{ 
                  scale: phase === "tearing" ? [1, 1.1, 1.05] : 1, 
                  opacity: 1, 
                  rotateY: 0,
                  rotateZ: phase === "tearing" ? [-3, 3, -3, 3, 0] : 0,
                }}
                exit={{ 
                  scale: 2.5, 
                  opacity: 0,
                  filter: "blur(30px)",
                }}
                transition={{ duration: 0.4 }}
              >
                {/* パック本体 - リッチなデザイン */}
                <div 
                  className="w-56 h-80 rounded-2xl overflow-hidden relative"
                  style={{
                    background: `linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)`,
                    boxShadow: `
                      0 0 80px ${displayConfig.glowColor},
                      0 25px 50px rgba(0, 0, 0, 0.5),
                      inset 0 1px 0 rgba(255, 255, 255, 0.2)
                    `,
                  }}
                >
                  {/* ホログラム光沢エフェクト */}
                  <motion.div
                    className="absolute inset-0 opacity-60"
                    style={{
                      ...hologramStyle,
                      backgroundPosition: `${holoAngle}% ${holoAngle}%`,
                    }}
                    animate={{
                      backgroundPosition: [`${holoAngle}% ${holoAngle}%`, `${holoAngle + 100}% ${holoAngle + 100}%`],
                    }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  />
                  
                  {/* 光沢ストライプ */}
                  <motion.div
                    className="absolute inset-0"
                    style={{
                      background: `linear-gradient(
                        ${45 + holoAngle}deg,
                        transparent 0%,
                        transparent 40%,
                        rgba(255, 255, 255, 0.4) 45%,
                        rgba(255, 255, 255, 0.6) 50%,
                        rgba(255, 255, 255, 0.4) 55%,
                        transparent 60%,
                        transparent 100%
                      )`,
                    }}
                  />

                  {/* メタリックボーダー */}
                  <div className="absolute inset-3 border-2 rounded-xl"
                    style={{
                      borderImage: `linear-gradient(
                        135deg, 
                        #ffd700, 
                        #fff, 
                        #ffd700, 
                        #fff, 
                        #ffd700
                      ) 1`,
                      borderImageSlice: 1,
                    }}
                  />
                  
                  {/* インナーグロー */}
                  <div className="absolute inset-4 rounded-lg"
                    style={{
                      background: `radial-gradient(ellipse at center, ${displayConfig.glowColor} 0%, transparent 70%)`,
                      opacity: 0.3,
                    }}
                  />

                  {/* パック中央デザイン */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white z-10">
                    {/* スター装飾 */}
                    <div className="absolute top-6 left-6">
                      <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                    </div>
                    <div className="absolute top-6 right-6">
                      <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                    </div>
                    <div className="absolute bottom-6 left-6">
                      <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                    </div>
                    <div className="absolute bottom-6 right-6">
                      <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                    </div>
                    
                    {/* メインアイコン */}
                    <motion.div
                      animate={{ 
                        scale: [1, 1.1, 1],
                        rotate: [0, 5, -5, 0],
                      }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <div className="relative">
                        <Sparkles className="w-20 h-20 text-yellow-400 drop-shadow-lg" />
                        <motion.div
                          className="absolute inset-0"
                          animate={{ opacity: [0.5, 1, 0.5] }}
                          transition={{ duration: 1, repeat: Infinity }}
                        >
                          <Sparkles className="w-20 h-20 text-white blur-sm" />
                        </motion.div>
                      </div>
                    </motion.div>
                    
                    {/* テキスト */}
                    <div className="mt-4 text-center">
                      <motion.div
                        className="text-3xl font-black"
                        style={{
                          background: "linear-gradient(180deg, #ffd700, #fff, #ffd700)",
                          WebkitBackgroundClip: "text",
                          WebkitTextFillColor: "transparent",
                          textShadow: "0 0 20px rgba(255, 215, 0, 0.5)",
                        }}
                        animate={{ scale: [1, 1.05, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        {playCount}枚
                      </motion.div>
                      <p className="text-sm text-white/80 font-bold tracking-widest mt-1">
                        CARD PACK
                      </p>
                    </div>
                  </div>
                  
                  {/* 破れエフェクト - より派手に */}
                  {phase === "tearing" && (
                    <>
                      {/* 中央の裂け目 */}
                      <motion.div
                        className="absolute top-0 left-1/2 w-2"
                        initial={{ height: 0, x: "-50%" }}
                        animate={{ height: "100%" }}
                        transition={{ duration: 0.6, ease: "easeIn" }}
                        style={{ 
                          background: "linear-gradient(to bottom, #fff, #ffd700, #fff)",
                          boxShadow: "0 0 30px white, 0 0 60px rgba(255, 215, 0, 0.8)",
                        }}
                      />
                      {/* 左右に広がる光 */}
                      <motion.div
                        className="absolute inset-0"
                        initial={{ opacity: 0 }}
                        animate={{ 
                          opacity: [0, 0.9, 0],
                          background: [
                            "linear-gradient(90deg, transparent 48%, white 50%, transparent 52%)",
                            "linear-gradient(90deg, transparent 30%, white 50%, transparent 70%)",
                            "linear-gradient(90deg, transparent 0%, white 50%, transparent 100%)",
                          ],
                        }}
                        transition={{ duration: 0.8, delay: 0.3 }}
                      />
                      {/* スパーク効果 */}
                      {[...Array(12)].map((_, i) => (
                        <motion.div
                          key={i}
                          className="absolute left-1/2 top-1/2 w-1 h-8 bg-white rounded-full"
                          initial={{ opacity: 0, scale: 0, rotate: i * 30 }}
                          animate={{ 
                            opacity: [0, 1, 0], 
                            scale: [0, 1.5, 0],
                            y: [-20, -60],
                          }}
                          transition={{ 
                            duration: 0.5, 
                            delay: 0.4 + i * 0.03,
                          }}
                          style={{
                            transformOrigin: "center center",
                            boxShadow: "0 0 10px white",
                          }}
                        />
                      ))}
                    </>
                  )}
                </div>
              </motion.div>
            )}

            {/* カード表示フェーズ - 全カード一斉表示 */}
            {phase === "cards" && (
              <motion.div
                key="cards-container"
                className="relative w-full max-w-2xl px-4"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
              >
                {/* 賞ラベル */}
                <motion.div
                  className="text-center mb-4"
                  initial={{ scale: 0, y: -50 }}
                  animate={{ scale: 1, y: 0 }}
                  transition={{ type: "spring", delay: 0.1 }}
                >
                  <span className={`inline-block px-8 py-3 ${config.labelBg} text-white text-3xl font-black rounded-full`}
                    style={{
                      textShadow: "0 2px 10px rgba(0,0,0,0.5)",
                      boxShadow: `0 0 40px ${config.glowColor}, 0 10px 30px rgba(0,0,0,0.3)`,
                    }}
                  >
                    {isFakeOut ? "...C賞" : config.label}
                  </span>
                </motion.div>

                {/* カードグリッド - 全カード一斉表示 */}
                <motion.div 
                  className="grid gap-2 max-h-[55vh] overflow-y-auto p-2 rounded-xl"
                  style={{
                    gridTemplateColumns: `repeat(${Math.min(drawnCards.length, 5)}, minmax(0, 1fr))`,
                    background: "rgba(0, 0, 0, 0.3)",
                    backdropFilter: "blur(10px)",
                  }}
                >
                  {drawnCards.map((card, index) => {
                    const tierStyle = TIER_CONFIG[card.prizeTier as keyof typeof TIER_CONFIG] || TIER_CONFIG.miss;
                    const isHighTier = card.prizeTier === "S" || card.prizeTier === "A";
                    
                    return (
                      <motion.div
                        key={card.slotId}
                        className="relative rounded-lg overflow-hidden"
                        initial={{ 
                          scale: 0, 
                          opacity: 0, 
                          rotateY: 180,
                          y: -100,
                        }}
                        animate={{ 
                          scale: 1, 
                          opacity: 1, 
                          rotateY: 0,
                          y: 0,
                        }}
                        transition={{ 
                          type: "spring", 
                          stiffness: 300, 
                          damping: 20,
                          delay: index * 0.05, // 順番に登場（高速）
                        }}
                        style={{
                          boxShadow: isHighTier ? `0 0 20px ${tierStyle.glowColor}` : "0 5px 15px rgba(0,0,0,0.3)",
                        }}
                      >
                        {/* 賞バッジ */}
                        <div className={`absolute top-1 left-1 z-10 px-1.5 py-0.5 ${tierStyle.labelBg} text-white text-[10px] font-bold rounded shadow-lg`}>
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
                            <div className="w-full h-full flex items-center justify-center bg-gray-100">
                              <Package className="w-8 h-8 text-gray-400" />
                            </div>
                          )}
                        </div>

                        {/* S賞/A賞の特別エフェクト */}
                        {isHighTier && (
                          <motion.div
                            className="absolute inset-0 pointer-events-none"
                            animate={{
                              background: [
                                "linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.5) 50%, transparent 70%)",
                                "linear-gradient(45deg, transparent 50%, rgba(255,255,255,0.5) 70%, transparent 90%)",
                                "linear-gradient(45deg, transparent 70%, rgba(255,255,255,0.5) 90%, transparent 100%)",
                              ],
                            }}
                            transition={{
                              duration: 1.5,
                              repeat: Infinity,
                              repeatType: "reverse",
                            }}
                          />
                        )}
                      </motion.div>
                    );
                  })}
                </motion.div>

                {/* 結果サマリー */}
                <motion.p
                  className="text-center text-white/80 text-sm mt-3 font-medium"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  {drawnCards.length}枚獲得！
                </motion.p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* スキップボタン */}
        <div className="absolute bottom-8 left-0 right-0 flex justify-center z-50">
          <Button 
            variant="ghost" 
            onClick={handleSkip}
            className="text-white/70 hover:text-white hover:bg-white/10 px-6"
            style={{ pointerEvents: "auto" }}
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
