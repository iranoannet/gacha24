import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback, useMemo } from "react";
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
    glowColor: "rgba(255, 200, 50, 0.9)",
    isRainbow: true,
    label: "★S賞★",
    labelBg: "bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500",
    borderColor: "#ffd700",
  },
  A: {
    glowColor: "rgba(255, 180, 0, 0.7)",
    isRainbow: false,
    label: "A賞",
    labelBg: "bg-gradient-to-r from-amber-400 to-yellow-500",
    borderColor: "#ffb300",
  },
  B: {
    glowColor: "rgba(100, 150, 255, 0.6)",
    isRainbow: false,
    label: "B賞",
    labelBg: "bg-gradient-to-r from-blue-400 to-purple-500",
    borderColor: "#4a90d9",
  },
  miss: {
    glowColor: "rgba(150, 150, 150, 0.4)",
    isRainbow: false,
    label: "C賞",
    labelBg: "bg-gray-500",
    borderColor: "#888888",
  },
};

export function CardPackAnimation({
  isPlaying,
  onComplete,
  onSkip,
  drawnCards,
  playCount,
  fakeSChance = 15,
}: CardPackAnimationProps) {
  // シーン管理
  const [scene, setScene] = useState(0);
  const [showFlash, setShowFlash] = useState(false);
  const [rainbowIndex, setRainbowIndex] = useState(0);
  const [isFakeOut, setIsFakeOut] = useState(false);
  const [revealedCount, setRevealedCount] = useState(0);
  const [currentRevealIndex, setCurrentRevealIndex] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  const sound = useGachaSound();

  // 最高賞を取得
  const highestTier = useMemo(() => {
    if (drawnCards.some(c => c.prizeTier === "S")) return "S";
    if (drawnCards.some(c => c.prizeTier === "A")) return "A";
    if (drawnCards.some(c => c.prizeTier === "B")) return "B";
    return "miss";
  }, [drawnCards]);

  const config = TIER_CONFIG[highestTier as keyof typeof TIER_CONFIG] || TIER_CONFIG.miss;

  // レアカードのみ抽出
  const rareCards = useMemo(() => {
    return drawnCards.filter(c => c.prizeTier === "S" || c.prizeTier === "A" || c.prizeTier === "B");
  }, [drawnCards]);

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

  // スキップ処理
  const handleSkip = useCallback(() => {
    sound.stopAll();
    if (onSkip) {
      onSkip();
    } else {
      onComplete();
    }
  }, [sound, onSkip, onComplete]);

  // ========== 1連演出 (9秒) ==========
  const runSingleAnimation = useCallback(() => {
    const timers: NodeJS.Timeout[] = [];
    
    // Scene 1: パック登場 (0-1.2s)
    setScene(1);
    sound.playSlotSpin();
    
    // Scene 2: 破裂 (1.2-2.5s)
    timers.push(setTimeout(() => {
      setScene(2);
      setShowFlash(true);
      sound.playImpact();
      setTimeout(() => setShowFlash(false), 200);
      if (config.isRainbow || isFakeOut) {
        sound.playDrumRoll(1);
      }
    }, 1200));
    
    // Scene 3: 商品画像登場 (2.5-4.0s)
    timers.push(setTimeout(() => {
      setScene(3);
      sound.playReveal(highestTier === "S" || highestTier === "A");
    }, 2500));
    
    // Scene 4: 浮遊・回転 (4.0-6.5s)
    timers.push(setTimeout(() => {
      setScene(4);
      if (highestTier === "S") {
        sound.playJackpot();
      } else if (highestTier === "A") {
        sound.playCoinSound(5);
      }
    }, 4000));
    
    // Scene 5: 確定・停止 (6.5-8.5s)
    timers.push(setTimeout(() => {
      setScene(5);
    }, 6500));
    
    // 完了
    timers.push(setTimeout(() => {
      onComplete();
    }, 9000));
    
    return () => timers.forEach(clearTimeout);
  }, [config.isRainbow, highestTier, isFakeOut, onComplete, sound]);

  // ========== 10連演出 (16秒) ==========
  const runTenAnimation = useCallback(() => {
    const timers: NodeJS.Timeout[] = [];
    
    // Scene 1: 10パック登場 (0-2s)
    setScene(1);
    sound.playSlotSpin();
    
    // Scene 2: 高速開封 (2-8s) - 9枚まで
    timers.push(setTimeout(() => {
      setScene(2);
      let count = 0;
      const openInterval = setInterval(() => {
        setRevealedCount(prev => prev + 1);
        count++;
        if (count >= 9) {
          clearInterval(openInterval);
        }
      }, 600); // 約0.5秒ごとに1枚
    }, 2000));
    
    // Scene 3: 最後の1枚に集中 (8-12s)
    timers.push(setTimeout(() => {
      setScene(3);
      sound.playDrumRoll(3);
      if (config.isRainbow || isFakeOut) {
        sound.playHeartbeat(4);
      }
    }, 8000));
    
    // Scene 4: 最後の1枚爆発 (12-15s)
    timers.push(setTimeout(() => {
      setScene(4);
      setShowFlash(true);
      sound.playImpact();
      setTimeout(() => setShowFlash(false), 200);
      setRevealedCount(10);
      if (highestTier === "S") {
        sound.playJackpot();
      } else if (highestTier === "A") {
        sound.playReveal(true);
        sound.playCoinSound(5);
      }
    }, 12000));
    
    // Scene 5: 結果グリッド (15-16.5s)
    timers.push(setTimeout(() => {
      setScene(5);
      setShowSummary(true);
    }, 15000));
    
    // 完了
    timers.push(setTimeout(() => {
      onComplete();
    }, 16500));
    
    return () => timers.forEach(clearTimeout);
  }, [config.isRainbow, highestTier, isFakeOut, onComplete, sound]);

  // ========== 100連演出 (28秒) ==========
  const runHundredAnimation = useCallback(() => {
    const timers: NodeJS.Timeout[] = [];
    
    // Scene 1: "100" 数字登場 (0-3s)
    setScene(1);
    sound.playSlotSpin();
    
    // Scene 2: 超高速開封 (3-12s)
    timers.push(setTimeout(() => {
      setScene(2);
      let count = 0;
      const openInterval = setInterval(() => {
        setRevealedCount(prev => Math.min(prev + 3, 100)); // 3枚ずつ
        count += 3;
        if (count >= 100) {
          clearInterval(openInterval);
        }
      }, 100);
    }, 3000));
    
    // Scene 3: スローダウン (12-18s)
    timers.push(setTimeout(() => {
      setScene(3);
      sound.playDrumRoll(5);
    }, 12000));
    
    // Scene 4: レアカード個別表示 (18-24s)
    timers.push(setTimeout(() => {
      setScene(4);
      setCurrentRevealIndex(0);
      if (rareCards.length > 0) {
        let idx = 0;
        const revealInterval = setInterval(() => {
          setCurrentRevealIndex(idx);
          sound.playImpact();
          idx++;
          if (idx >= rareCards.length) {
            clearInterval(revealInterval);
          }
        }, 1000);
      }
    }, 18000));
    
    // Scene 5: サマリー画面 (24-28s)
    timers.push(setTimeout(() => {
      setScene(5);
      setShowSummary(true);
      if (highestTier === "S") {
        sound.playJackpot();
      }
    }, 24000));
    
    // 完了
    timers.push(setTimeout(() => {
      onComplete();
    }, 28000));
    
    return () => timers.forEach(clearTimeout);
  }, [highestTier, onComplete, rareCards.length, sound]);

  // メイン演出制御
  useEffect(() => {
    if (!isPlaying) {
      setScene(0);
      setRevealedCount(0);
      setCurrentRevealIndex(0);
      setShowSummary(false);
      return;
    }

    // 回数に応じた演出を実行
    if (playCount === 1) {
      return runSingleAnimation();
    } else if (playCount <= 10) {
      return runTenAnimation();
    } else {
      return runHundredAnimation();
    }
  }, [isPlaying, playCount, runSingleAnimation, runTenAnimation, runHundredAnimation]);

  if (!isPlaying) return null;

  // 表示用の背景色（フェイク時はS賞風）
  const displayConfig = isFakeOut && scene < 5 ? TIER_CONFIG.S : config;
  const bgGradient = displayConfig.isRainbow || (isFakeOut && scene < 5)
    ? `linear-gradient(135deg, ${RAINBOW_COLORS[rainbowIndex]}, ${RAINBOW_COLORS[(rainbowIndex + 2) % 7]})`
    : `linear-gradient(to bottom, #0a0a0a, #1a1a2e)`;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[110] overflow-hidden"
        style={{ background: bgGradient }}
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

        {/* 背景ラジアルグロー */}
        <motion.div
          className="absolute inset-0"
          animate={{ opacity: scene >= 3 ? 0.8 : 0.3 }}
          style={{
            background: `radial-gradient(circle at center, ${displayConfig.glowColor} 0%, transparent 60%)`,
          }}
        />

        {/* ========== 1連演出 ========== */}
        {playCount === 1 && (
          <div className="absolute inset-0 flex items-center justify-center">
            {/* Scene 1: パック浮遊 */}
            {scene === 1 && (
              <SinglePackFloating />
            )}

            {/* Scene 2: 破裂 */}
            {scene === 2 && (
              <PackBurst />
            )}

            {/* Scene 3-5: 商品画像表示 */}
            {scene >= 3 && drawnCards[0] && (
              <SingleCardReveal
                card={drawnCards[0]}
                scene={scene}
                config={displayConfig}
                isFakeOut={isFakeOut}
                rainbowIndex={rainbowIndex}
              />
            )}
          </div>
        )}

        {/* ========== 10連演出 ========== */}
        {playCount > 1 && playCount <= 10 && (
          <div className="absolute inset-0 flex items-center justify-center">
            {/* Scene 1: 10パック登場 */}
            {scene === 1 && (
              <TenPacksFormation playCount={playCount} />
            )}

            {/* Scene 2: 高速開封 */}
            {scene === 2 && (
              <RapidOpenSequence
                cards={drawnCards}
                revealedCount={Math.min(revealedCount, playCount - 1)}
              />
            )}

            {/* Scene 3: 最後の1パック */}
            {scene === 3 && (
              <FinalPackSuspense config={displayConfig} />
            )}

            {/* Scene 4: 最後の爆発 */}
            {scene === 4 && drawnCards[drawnCards.length - 1] && (
              <SingleCardReveal
                card={drawnCards[drawnCards.length - 1]}
                scene={4}
                config={displayConfig}
                isFakeOut={isFakeOut}
                rainbowIndex={rainbowIndex}
              />
            )}

            {/* Scene 5: 結果グリッド */}
            {scene === 5 && showSummary && (
              <ResultsGrid
                cards={drawnCards}
                config={config}
                isFakeOut={isFakeOut}
              />
            )}
          </div>
        )}

        {/* ========== 100連演出 ========== */}
        {playCount > 10 && (
          <div className="absolute inset-0 flex items-center justify-center">
            {/* Scene 1: "100" 数字 */}
            {scene === 1 && (
              <BigNumberReveal count={playCount} />
            )}

            {/* Scene 2: 超高速開封 + カウンター */}
            {scene === 2 && (
              <MassOpeningCounter
                current={revealedCount}
                total={playCount}
              />
            )}

            {/* Scene 3: スローダウン */}
            {scene === 3 && (
              <SlowdownPhase config={displayConfig} />
            )}

            {/* Scene 4: レアカード個別表示 */}
            {scene === 4 && rareCards[currentRevealIndex] && (
              <SingleCardReveal
                card={rareCards[currentRevealIndex]}
                scene={4}
                config={TIER_CONFIG[rareCards[currentRevealIndex].prizeTier as keyof typeof TIER_CONFIG] || TIER_CONFIG.miss}
                isFakeOut={false}
                rainbowIndex={rainbowIndex}
              />
            )}

            {/* Scene 5: サマリー画面 */}
            {scene === 5 && showSummary && (
              <HundredResultsSummary
                cards={drawnCards}
                rareCards={rareCards}
                highestTier={highestTier}
              />
            )}
          </div>
        )}

        {/* スキップボタン */}
        <div className="absolute bottom-8 left-0 right-0 flex justify-center z-50">
          <Button 
            variant="ghost" 
            onClick={handleSkip}
            className="text-white/70 hover:text-white hover:bg-white/10 px-6"
          >
            スキップ →
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ========== サブコンポーネント ==========

// 1連: パック浮遊
function SinglePackFloating() {
  return (
    <motion.div
      initial={{ scale: 0.5, opacity: 0, y: 100 }}
      animate={{ 
        scale: 1, 
        opacity: 1, 
        y: [0, -10, 0],
      }}
      transition={{ 
        y: { repeat: Infinity, duration: 2 },
        scale: { duration: 0.5 }
      }}
      className="relative"
    >
      <div 
        className="w-48 h-72 rounded-xl overflow-hidden relative"
        style={{
          background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
          boxShadow: "0 0 60px rgba(255, 200, 50, 0.5), 0 20px 40px rgba(0,0,0,0.5)",
        }}
      >
        {/* ホログラム光沢 */}
        <motion.div
          className="absolute inset-0"
          animate={{
            background: [
              "linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.4) 50%, transparent 70%)",
              "linear-gradient(45deg, transparent 50%, rgba(255,255,255,0.4) 70%, transparent 90%)",
            ],
          }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
        {/* 中央コンテンツ */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Sparkles className="w-16 h-16 text-yellow-400" />
          <p className="text-white font-bold mt-2 tracking-widest">CARD PACK</p>
        </div>
        {/* 星装飾 */}
        {[...Array(4)].map((_, i) => (
          <Star 
            key={i} 
            className="absolute w-4 h-4 text-yellow-400 fill-yellow-400"
            style={{
              top: i < 2 ? "1rem" : "auto",
              bottom: i >= 2 ? "1rem" : "auto",
              left: i % 2 === 0 ? "1rem" : "auto",
              right: i % 2 === 1 ? "1rem" : "auto",
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}

// 破裂エフェクト
function PackBurst() {
  const fragments = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    angle: (360 / 12) * i,
  }));

  return (
    <div className="relative">
      {fragments.map(f => (
        <motion.div
          key={f.id}
          className="absolute w-4 h-12 bg-white rounded"
          initial={{ x: 0, y: 0, opacity: 1, rotate: f.angle }}
          animate={{
            x: Math.cos(f.angle * Math.PI / 180) * 200,
            y: Math.sin(f.angle * Math.PI / 180) * 200,
            opacity: 0,
            scale: 0.5,
          }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          style={{
            boxShadow: "0 0 20px white",
            transformOrigin: "center center",
          }}
        />
      ))}
    </div>
  );
}

// 1連カード表示
function SingleCardReveal({ 
  card, 
  scene, 
  config, 
  isFakeOut,
  rainbowIndex,
}: { 
  card: DrawnCard; 
  scene: number; 
  config: typeof TIER_CONFIG.S;
  isFakeOut: boolean;
  rainbowIndex: number;
}) {
  const isHighTier = card.prizeTier === "S" || card.prizeTier === "A";

  return (
    <motion.div
      className="relative flex flex-col items-center"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ 
        scale: 1, 
        opacity: 1,
        y: scene === 4 ? [0, -10, 0] : 0,
        rotateY: scene === 4 ? [0, 5, -5, 0] : 0,
      }}
      transition={{ 
        type: "spring",
        y: scene === 4 ? { repeat: Infinity, duration: 2 } : {},
        rotateY: scene === 4 ? { repeat: Infinity, duration: 3 } : {},
      }}
    >
      {/* 放射状ライトビーム */}
      {scene >= 3 && isHighTier && (
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(12)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute left-1/2 top-1/2 w-2 origin-bottom"
              style={{
                height: "300px",
                transform: `rotate(${i * 30}deg) translateX(-50%)`,
                background: `linear-gradient(to top, ${config.glowColor}, transparent)`,
              }}
              initial={{ opacity: 0, scaleY: 0 }}
              animate={{ opacity: 0.4, scaleY: 1 }}
              transition={{ delay: 0.1 * i, duration: 0.5 }}
            />
          ))}
        </div>
      )}

      {/* 賞ラベル */}
      <motion.div
        className={`mb-4 px-8 py-3 ${config.labelBg} text-white text-3xl font-black rounded-full z-10`}
        initial={{ scale: 0, y: -50 }}
        animate={{ scale: 1, y: 0 }}
        style={{
          boxShadow: `0 0 40px ${config.glowColor}`,
        }}
      >
        {isFakeOut ? "...C賞" : config.label}
      </motion.div>

      {/* カード */}
      <motion.div
        className="relative rounded-xl overflow-hidden"
        style={{
          width: "280px",
          boxShadow: `0 0 60px ${config.glowColor}, 0 20px 40px rgba(0,0,0,0.5)`,
          border: `4px solid ${config.borderColor}`,
        }}
        animate={scene === 4 ? { scale: [1, 1.02, 1] } : {}}
        transition={scene === 4 ? { repeat: Infinity, duration: 2 } : {}}
      >
        <div className="aspect-[3/4] bg-white">
          {card.imageUrl ? (
            <img 
              src={card.imageUrl} 
              alt={card.name} 
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-100">
              <Package className="w-16 h-16 text-gray-400" />
            </div>
          )}
        </div>

        {/* レアカード光沢エフェクト */}
        {isHighTier && (
          <motion.div
            className="absolute inset-0 pointer-events-none"
            animate={{
              background: [
                "linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.6) 50%, transparent 70%)",
                "linear-gradient(45deg, transparent 70%, rgba(255,255,255,0.6) 90%, transparent 100%)",
              ],
            }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}

        {/* レインボーオーバーレイ（S賞） */}
        {card.prizeTier === "S" && (
          <motion.div
            className="absolute inset-0 pointer-events-none opacity-30"
            style={{
              background: `linear-gradient(${rainbowIndex * 30}deg, ${RAINBOW_COLORS[rainbowIndex]}, ${RAINBOW_COLORS[(rainbowIndex + 3) % 7]})`,
            }}
          />
        )}
      </motion.div>

      {/* パーティクル */}
      {isHighTier && (
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 rounded-full"
              style={{
                background: card.prizeTier === "S" 
                  ? RAINBOW_COLORS[i % RAINBOW_COLORS.length]
                  : config.glowColor,
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{
                y: [0, -50, 0],
                opacity: [0, 1, 0],
                scale: [0, 1, 0],
              }}
              transition={{
                duration: 2,
                delay: Math.random() * 2,
                repeat: Infinity,
              }}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}

// 10連: パック配列
function TenPacksFormation({ playCount }: { playCount: number }) {
  const packs = Array.from({ length: playCount }, (_, i) => i);
  
  return (
    <div className="flex flex-wrap justify-center gap-3 max-w-xl">
      {packs.map((_, i) => (
        <motion.div
          key={i}
          initial={{ scale: 0, opacity: 0, y: 50 }}
          animate={{ 
            scale: 1, 
            opacity: 1, 
            y: [0, -5, 0],
          }}
          transition={{ 
            delay: i * 0.1,
            y: { repeat: Infinity, duration: 2, delay: i * 0.2 }
          }}
          className="w-16 h-24 rounded-lg"
          style={{
            background: "linear-gradient(135deg, #1a1a2e, #16213e)",
            boxShadow: "0 0 20px rgba(255, 200, 50, 0.3), 0 5px 15px rgba(0,0,0,0.3)",
            border: "1px solid rgba(255, 215, 0, 0.5)",
          }}
        />
      ))}
    </div>
  );
}

// 10連: 高速開封シーケンス
function RapidOpenSequence({ 
  cards, 
  revealedCount 
}: { 
  cards: DrawnCard[];
  revealedCount: number;
}) {
  const revealed = cards.slice(0, revealedCount);

  return (
    <div className="flex flex-wrap justify-center gap-2 max-w-lg px-4">
      {revealed.map((card, i) => {
        const tierConfig = TIER_CONFIG[card.prizeTier as keyof typeof TIER_CONFIG] || TIER_CONFIG.miss;
        return (
          <motion.div
            key={i}
            initial={{ scale: 0, rotateY: 180 }}
            animate={{ scale: 1, rotateY: 0 }}
            transition={{ type: "spring", stiffness: 300 }}
            className="w-14 h-20 rounded overflow-hidden"
            style={{
              boxShadow: `0 0 10px ${tierConfig.glowColor}`,
              border: `2px solid ${tierConfig.borderColor}`,
            }}
          >
            {card.imageUrl ? (
              <img src={card.imageUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                <Package className="w-4 h-4 text-gray-400" />
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

// 10連: 最後の1パックサスペンス
function FinalPackSuspense({ config }: { config: typeof TIER_CONFIG.S }) {
  return (
    <motion.div
      animate={{ 
        scale: [1, 1.05, 1],
        rotate: [-2, 2, -2, 2, 0],
      }}
      transition={{ 
        scale: { repeat: Infinity, duration: 0.5 },
        rotate: { repeat: Infinity, duration: 0.3 },
      }}
      className="w-32 h-48 rounded-xl relative"
      style={{
        background: "linear-gradient(135deg, #1a1a2e, #16213e)",
        boxShadow: `0 0 60px ${config.glowColor}, 0 0 100px ${config.glowColor}`,
        border: `3px solid ${config.borderColor}`,
      }}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <Sparkles className="w-12 h-12 text-yellow-400 animate-pulse" />
      </div>
    </motion.div>
  );
}

// 結果グリッド（10連）
function ResultsGrid({ 
  cards, 
  config,
  isFakeOut,
}: { 
  cards: DrawnCard[];
  config: typeof TIER_CONFIG.S;
  isFakeOut: boolean;
}) {
  // 最高賞判定
  const highestTier = cards.some(c => c.prizeTier === "S") ? "S"
    : cards.some(c => c.prizeTier === "A") ? "A"
    : cards.some(c => c.prizeTier === "B") ? "B"
    : "miss";
  const resultConfig = TIER_CONFIG[highestTier as keyof typeof TIER_CONFIG];

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="flex flex-col items-center px-4"
    >
      {/* 賞ラベル */}
      <motion.div
        className={`mb-4 px-6 py-2 ${resultConfig.labelBg} text-white text-2xl font-black rounded-full`}
        style={{ boxShadow: `0 0 30px ${resultConfig.glowColor}` }}
      >
        {isFakeOut ? "結果: C賞" : `最高: ${resultConfig.label}`}
      </motion.div>

      {/* グリッド */}
      <div 
        className="grid gap-2 max-h-[50vh] overflow-y-auto p-3 rounded-xl"
        style={{
          gridTemplateColumns: `repeat(${Math.min(cards.length, 5)}, minmax(0, 1fr))`,
          background: "rgba(0, 0, 0, 0.4)",
          backdropFilter: "blur(10px)",
        }}
      >
        {cards.map((card, i) => {
          const tierConfig = TIER_CONFIG[card.prizeTier as keyof typeof TIER_CONFIG] || TIER_CONFIG.miss;
          const isHighTier = card.prizeTier === "S" || card.prizeTier === "A";
          
          return (
            <motion.div
              key={i}
              initial={{ scale: 0, rotateY: 180 }}
              animate={{ scale: 1, rotateY: 0 }}
              transition={{ delay: i * 0.05, type: "spring" }}
              className="relative rounded-lg overflow-hidden"
              style={{
                boxShadow: isHighTier ? `0 0 15px ${tierConfig.glowColor}` : "0 3px 10px rgba(0,0,0,0.3)",
                border: `2px solid ${tierConfig.borderColor}`,
              }}
            >
              <div className={`absolute top-0.5 left-0.5 z-10 px-1 py-0.5 ${tierConfig.labelBg} text-white text-[8px] font-bold rounded`}>
                {tierConfig.label}
              </div>
              <div className="aspect-[3/4] bg-white">
                {card.imageUrl ? (
                  <img src={card.imageUrl} alt={card.name} className="w-full h-full object-contain" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-100">
                    <Package className="w-6 h-6 text-gray-400" />
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      <p className="text-white/80 text-sm mt-3">{cards.length}枚獲得！</p>
    </motion.div>
  );
}

// 100連: 大きな数字表示
function BigNumberReveal({ count }: { count: number }) {
  return (
    <motion.div
      initial={{ scale: 0, rotateX: -90 }}
      animate={{ scale: 1, rotateX: 0 }}
      transition={{ type: "spring", stiffness: 200 }}
      className="text-center"
    >
      <motion.div
        className="text-9xl font-black text-transparent bg-clip-text"
        style={{
          backgroundImage: "linear-gradient(180deg, #ffd700, #fff, #ffd700)",
          textShadow: "0 0 60px rgba(255, 215, 0, 0.8)",
        }}
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ repeat: Infinity, duration: 1 }}
      >
        {count}
      </motion.div>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-white text-2xl font-bold tracking-widest"
      >
        CARDS
      </motion.p>
    </motion.div>
  );
}

// 100連: マスオープニングカウンター
function MassOpeningCounter({ current, total }: { current: number; total: number }) {
  return (
    <div className="text-center">
      {/* パーティクル背景 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(30)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-4 h-4 rounded bg-yellow-400"
            style={{
              left: `${Math.random() * 100}%`,
              top: "-20px",
            }}
            animate={{
              y: ["0vh", "110vh"],
              rotate: 720,
              opacity: [1, 0],
            }}
            transition={{
              duration: 1 + Math.random(),
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
      </div>

      {/* カウンター */}
      <motion.div
        className="text-7xl font-black text-white"
        style={{ textShadow: "0 0 40px rgba(255, 200, 50, 0.8)" }}
      >
        {current} / {total}
      </motion.div>
      
      {/* プログレスバー */}
      <div className="w-64 h-3 bg-gray-800 rounded-full mt-4 mx-auto overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-yellow-400 to-amber-500"
          initial={{ width: 0 }}
          animate={{ width: `${(current / total) * 100}%` }}
        />
      </div>
    </div>
  );
}

// 100連: スローダウンフェーズ
function SlowdownPhase({ config }: { config: typeof TIER_CONFIG.S }) {
  return (
    <motion.div
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{ repeat: Infinity, duration: 1.5 }}
      className="text-center"
    >
      <motion.div
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ repeat: Infinity, duration: 0.5 }}
        className="text-4xl font-bold text-white mb-4"
      >
        レア確認中...
      </motion.div>
      <Sparkles 
        className="w-20 h-20 mx-auto"
        style={{ color: config.borderColor }}
      />
    </motion.div>
  );
}

// 100連: サマリー画面
function HundredResultsSummary({ 
  cards, 
  rareCards,
  highestTier,
}: { 
  cards: DrawnCard[];
  rareCards: DrawnCard[];
  highestTier: string;
}) {
  const config = TIER_CONFIG[highestTier as keyof typeof TIER_CONFIG] || TIER_CONFIG.miss;
  
  // 賞ごとのカウント
  const tierCounts = {
    S: cards.filter(c => c.prizeTier === "S").length,
    A: cards.filter(c => c.prizeTier === "A").length,
    B: cards.filter(c => c.prizeTier === "B").length,
    C: cards.filter(c => c.prizeTier === "miss").length,
  };

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="flex flex-col items-center px-4 max-w-lg"
    >
      {/* 最高賞 */}
      <motion.div
        className={`mb-4 px-8 py-3 ${config.labelBg} text-white text-3xl font-black rounded-full`}
        style={{ boxShadow: `0 0 40px ${config.glowColor}` }}
      >
        最高: {config.label}
      </motion.div>

      {/* 統計 */}
      <div className="grid grid-cols-4 gap-3 mb-4 w-full">
        {Object.entries(tierCounts).map(([tier, count]) => {
          const tierConfig = TIER_CONFIG[tier === "C" ? "miss" : tier as keyof typeof TIER_CONFIG];
          return (
            <div 
              key={tier}
              className="text-center p-2 rounded-lg"
              style={{ background: "rgba(0,0,0,0.4)" }}
            >
              <div className={`text-sm font-bold ${tierConfig.labelBg} bg-clip-text text-transparent`}>
                {tier}賞
              </div>
              <div className="text-2xl font-black text-white">{count}</div>
            </div>
          );
        })}
      </div>

      {/* レアカードグリッド */}
      {rareCards.length > 0 && (
        <div 
          className="grid gap-2 max-h-[35vh] overflow-y-auto p-3 rounded-xl w-full"
          style={{
            gridTemplateColumns: `repeat(${Math.min(rareCards.length, 5)}, minmax(0, 1fr))`,
            background: "rgba(0, 0, 0, 0.4)",
          }}
        >
          {rareCards.map((card, i) => {
            const tierConfig = TIER_CONFIG[card.prizeTier as keyof typeof TIER_CONFIG] || TIER_CONFIG.miss;
            return (
              <motion.div
                key={i}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="relative rounded overflow-hidden"
                style={{
                  boxShadow: `0 0 10px ${tierConfig.glowColor}`,
                  border: `2px solid ${tierConfig.borderColor}`,
                }}
              >
                <div className="aspect-[3/4] bg-white">
                  {card.imageUrl ? (
                    <img src={card.imageUrl} alt="" className="w-full h-full object-contain" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-100">
                      <Package className="w-4 h-4 text-gray-400" />
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <p className="text-white/80 text-sm mt-3">{cards.length}枚獲得！</p>
    </motion.div>
  );
}

// 演出タイプを判定するヘルパー
export function getHighestPrizeTierFromCards(cards: DrawnCard[]): string {
  if (cards.some(c => c.prizeTier === "S")) return "S";
  if (cards.some(c => c.prizeTier === "A")) return "A";
  if (cards.some(c => c.prizeTier === "B")) return "B";
  return "miss";
}
