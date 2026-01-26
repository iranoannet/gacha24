import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useGachaSound } from "@/hooks/useGachaSound";
import { Package } from "lucide-react";
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

// 賞に応じた演出設定
const TIER_CONFIG = {
  S: {
    glowColor: "rgba(255, 200, 50, 0.9)",
    isRainbow: true,
    label: "★S賞★",
    labelBg: "bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500",
    borderColor: "#ffd700",
    lightColor: "#ffd700",
  },
  A: {
    glowColor: "rgba(255, 180, 0, 0.7)",
    isRainbow: false,
    label: "A賞",
    labelBg: "bg-gradient-to-r from-amber-400 to-yellow-500",
    borderColor: "#ffb300",
    lightColor: "#ffc107",
  },
  B: {
    glowColor: "rgba(100, 150, 255, 0.6)",
    isRainbow: false,
    label: "B賞",
    labelBg: "bg-gradient-to-r from-blue-400 to-purple-500",
    borderColor: "#4a90d9",
    lightColor: "#64b5f6",
  },
  miss: {
    glowColor: "rgba(200, 200, 200, 0.4)",
    isRainbow: false,
    label: "C賞",
    labelBg: "bg-gray-500",
    borderColor: "#aaaaaa",
    lightColor: "#ffffff",
  },
};

// レインボー色
const RAINBOW_COLORS = [
  "#ff0000", "#ff7f00", "#ffff00", "#00ff00", 
  "#00ffff", "#007fff", "#8b00ff"
];

export function CardPackAnimation({
  isPlaying,
  onComplete,
  onSkip,
  drawnCards,
  playCount,
  fakeSChance = 15,
}: CardPackAnimationProps) {
  const [scene, setScene] = useState(0);
  const [isFakeOut, setIsFakeOut] = useState(false);
  const [rainbowIndex, setRainbowIndex] = useState(0);
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

  // レインボーサイクル（S賞用）
  useEffect(() => {
    if (!isPlaying || highestTier !== "S") return;
    const interval = setInterval(() => {
      setRainbowIndex(prev => (prev + 1) % RAINBOW_COLORS.length);
    }, 120);
    return () => clearInterval(interval);
  }, [isPlaying, highestTier]);

  // スキップ処理
  const handleSkip = useCallback(() => {
    sound.stopAll();
    if (onSkip) {
      onSkip();
    } else {
      onComplete();
    }
  }, [sound, onSkip, onComplete]);

  // ========== 1連演出 (10秒) - 新シネマティック演出 ==========
  const runSingleAnimation = useCallback(() => {
    const timers: NodeJS.Timeout[] = [];
    
    // Scene 1: 暗い空間 (0-1.5s) - カードシルエット、エッジ発光
    setScene(1);
    // 深い環境音（静かな緊張感）
    
    // Scene 2: スリーブスライド (1.5-3.0s)
    timers.push(setTimeout(() => {
      setScene(2);
      sound.playSlotSpin(); // スリーブ摩擦音として
    }, 1500));
    
    // Scene 3: カード裏面静止 (3.0-4.5s) - 心臓の鼓動
    timers.push(setTimeout(() => {
      setScene(3);
      // ドキドキ感を全賞で
      const intensity = highestTier === "S" || isFakeOut ? "high" 
        : highestTier === "A" ? "high" 
        : highestTier === "B" ? "medium" 
        : "low";
      sound.playDrumRoll(1.2, intensity);
      sound.playHeartbeat(3);
    }, 3000));
    
    // Scene 4: 瞬間フリップ (4.5-6.0s) - カード表面登場
    timers.push(setTimeout(() => {
      setScene(4);
      sound.playImpact(); // 重いインパクト音
      
      // 賞別の確定音
      setTimeout(() => {
        if (highestTier === "S") {
          sound.playJackpot();
        } else if (highestTier === "A") {
          sound.playGoldReveal();
        } else if (highestTier === "B") {
          sound.playSilverReveal();
        } else if (isFakeOut) {
          setTimeout(() => sound.playMiss(), 300);
        } else {
          sound.playMiss();
        }
      }, 200);
    }, 4500));
    
    // Scene 5: ホログラム傾き (6.0-8.0s)
    timers.push(setTimeout(() => {
      setScene(5);
      sound.playCoinSound(2); // クリスタルスパークル音
    }, 6000));
    
    // Scene 6: 静止・確定 (8.0-10.0s)
    timers.push(setTimeout(() => {
      setScene(6);
    }, 8000));
    
    // 完了
    timers.push(setTimeout(() => {
      onComplete();
    }, 10000));
    
    return () => timers.forEach(clearTimeout);
  }, [highestTier, isFakeOut, onComplete, sound]);

  // ========== 10連演出 (16秒) ==========
  const runTenAnimation = useCallback(() => {
    const timers: NodeJS.Timeout[] = [];
    
    // Scene 1: 10枚のカードシルエット登場 (0-2s)
    setScene(1);
    sound.playSlotSpin();
    
    // Scene 2: 高速開封 (2-8s) - 9枚まで
    timers.push(setTimeout(() => {
      setScene(2);
      let count = 0;
      const openInterval = setInterval(() => {
        setRevealedCount(prev => prev + 1);
        sound.playCoinSound(1);
        count++;
        if (count >= 9) {
          clearInterval(openInterval);
        }
      }, 600);
    }, 2000));
    
    // Scene 3: 最後の1枚に集中 (8-12s)
    timers.push(setTimeout(() => {
      setScene(3);
      if (highestTier !== "miss" || isFakeOut) {
        sound.playSuspense(isFakeOut ? "S" : highestTier as "S" | "A" | "B");
      }
      const intensity = highestTier === "S" || isFakeOut ? "high" 
        : highestTier === "A" ? "high" 
        : highestTier === "B" ? "medium" 
        : "low";
      sound.playDrumRoll(3.5, intensity);
      sound.playHeartbeat(6);
    }, 8000));
    
    // Scene 4: 最後の1枚フリップ (12-15s)
    timers.push(setTimeout(() => {
      setScene(4);
      sound.playImpact();
      setRevealedCount(10);
      
      setTimeout(() => {
        if (highestTier === "S") {
          sound.playJackpot();
        } else if (highestTier === "A") {
          sound.playGoldReveal();
        } else if (highestTier === "B") {
          sound.playSilverReveal();
        } else if (isFakeOut) {
          setTimeout(() => sound.playMiss(), 300);
        } else {
          sound.playMiss();
        }
      }, 300);
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
  }, [highestTier, isFakeOut, onComplete, sound]);

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
        setRevealedCount(prev => Math.min(prev + 3, 100));
        count += 3;
        if (count >= 100) {
          clearInterval(openInterval);
        }
      }, 100);
    }, 3000));
    
    // Scene 3: スローダウン (12-18s)
    timers.push(setTimeout(() => {
      setScene(3);
      if (highestTier !== "miss") {
        sound.playSuspense(highestTier as "S" | "A" | "B");
      }
      const intensity = highestTier === "S" ? "high" 
        : highestTier === "A" ? "high" 
        : highestTier === "B" ? "medium" 
        : "low";
      sound.playDrumRoll(5, intensity);
      sound.playHeartbeat(8);
    }, 12000));
    
    // Scene 4: レアカード個別表示 (18-24s)
    timers.push(setTimeout(() => {
      setScene(4);
      setCurrentRevealIndex(0);
      if (rareCards.length > 0) {
        let idx = 0;
        const revealInterval = setInterval(() => {
          setCurrentRevealIndex(idx);
          const card = rareCards[idx];
          sound.playImpact();
          setTimeout(() => {
            if (card.prizeTier === "S") {
              sound.playJackpot();
            } else if (card.prizeTier === "A") {
              sound.playGoldReveal();
            } else {
              sound.playSilverReveal();
            }
          }, 200);
          idx++;
          if (idx >= rareCards.length) {
            clearInterval(revealInterval);
          }
        }, 1200);
      }
    }, 18000));
    
    // Scene 5: サマリー画面 (24-28s)
    timers.push(setTimeout(() => {
      setScene(5);
      setShowSummary(true);
      if (highestTier === "S") {
        sound.playJackpot();
      } else if (highestTier === "A") {
        sound.playGoldReveal();
      } else if (highestTier === "B") {
        sound.playSilverReveal();
      }
    }, 24000));
    
    // 完了
    timers.push(setTimeout(() => {
      onComplete();
    }, 28000));
    
    return () => timers.forEach(clearTimeout);
  }, [highestTier, onComplete, rareCards, sound]);

  // メイン演出制御
  useEffect(() => {
    if (!isPlaying) {
      setScene(0);
      setRevealedCount(0);
      setCurrentRevealIndex(0);
      setShowSummary(false);
      return;
    }

    if (playCount === 1) {
      return runSingleAnimation();
    } else if (playCount <= 10) {
      return runTenAnimation();
    } else {
      return runHundredAnimation();
    }
  }, [isPlaying, playCount, runSingleAnimation, runTenAnimation, runHundredAnimation]);

  if (!isPlaying) return null;

  const displayConfig = isFakeOut && scene < 5 ? TIER_CONFIG.S : config;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[110] overflow-hidden"
        style={{ background: "#0a0a0f" }}
      >
        {/* 暗いヴォールト空間の背景 */}
        <div 
          className="absolute inset-0"
          style={{
            background: "radial-gradient(ellipse at center, #141420 0%, #0a0a0f 70%, #050508 100%)",
          }}
        />

        {/* 微細なダストパーティクル */}
        <DustParticles />

        {/* ========== 1連演出 ========== */}
        {playCount === 1 && (
          <div className="absolute inset-0 flex items-center justify-center">
            {drawnCards[0] && (
              <CinematicCardReveal
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
            {scene === 1 && <TenCardsSilhouettes playCount={playCount} />}
            {scene === 2 && (
              <RapidOpenSequence
                cards={drawnCards}
                revealedCount={Math.min(revealedCount, playCount - 1)}
              />
            )}
            {scene === 3 && <FinalCardSuspense config={displayConfig} />}
            {scene === 4 && drawnCards[drawnCards.length - 1] && (
              <CinematicCardReveal
                card={drawnCards[drawnCards.length - 1]}
                scene={4}
                config={displayConfig}
                isFakeOut={isFakeOut}
                rainbowIndex={rainbowIndex}
                skipIntro
              />
            )}
            {scene === 5 && showSummary && (
              <ResultsGrid cards={drawnCards} config={config} isFakeOut={isFakeOut} />
            )}
          </div>
        )}

        {/* ========== 100連演出 ========== */}
        {playCount > 10 && (
          <div className="absolute inset-0 flex items-center justify-center">
            {scene === 1 && <BigNumberReveal count={playCount} />}
            {scene === 2 && <MassOpeningCounter current={revealedCount} total={playCount} />}
            {scene === 3 && <SlowdownPhase config={displayConfig} />}
            {scene === 4 && rareCards[currentRevealIndex] && (
              <CinematicCardReveal
                card={rareCards[currentRevealIndex]}
                scene={4}
                config={TIER_CONFIG[rareCards[currentRevealIndex].prizeTier as keyof typeof TIER_CONFIG] || TIER_CONFIG.miss}
                isFakeOut={false}
                rainbowIndex={rainbowIndex}
                skipIntro
              />
            )}
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
            className="text-white/50 hover:text-white hover:bg-white/10 px-6"
          >
            スキップ →
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ========== サブコンポーネント ==========

// ダストパーティクル
function DustParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(30)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-0.5 h-0.5 bg-white/20 rounded-full"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{
            y: [-20, 20],
            x: [-10, 10],
            opacity: [0.1, 0.3, 0.1],
          }}
          transition={{
            duration: 4 + Math.random() * 4,
            repeat: Infinity,
            delay: Math.random() * 3,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

// シネマティックカード演出（1連メイン）
function CinematicCardReveal({ 
  card, 
  scene, 
  config, 
  isFakeOut,
  rainbowIndex,
  skipIntro = false,
}: { 
  card: DrawnCard; 
  scene: number; 
  config: typeof TIER_CONFIG.S;
  isFakeOut: boolean;
  rainbowIndex: number;
  skipIntro?: boolean;
}) {
  const isHighTier = card.prizeTier === "S" || card.prizeTier === "A";
  const isFlipped = scene >= 4;
  const showHoloTilt = scene >= 5;
  const showFinal = scene >= 6;

  // シーン別の演出計算
  const sceneStyles = useMemo(() => {
    if (scene === 1 && !skipIntro) {
      // Scene 1: シルエット、エッジのみ発光
      return {
        cardOpacity: 0.1,
        borderGlow: true,
        sleeveVisible: true,
        sleeveProgress: 0,
      };
    } else if (scene === 2 && !skipIntro) {
      // Scene 2: スリーブスライド
      return {
        cardOpacity: 0.3,
        borderGlow: true,
        sleeveVisible: true,
        sleeveProgress: 1,
      };
    } else if (scene === 3 && !skipIntro) {
      // Scene 3: カード裏面静止
      return {
        cardOpacity: 1,
        borderGlow: true,
        sleeveVisible: false,
        showPulse: true,
      };
    }
    // Scene 4以降、またはskipIntro
    return {
      cardOpacity: 1,
      borderGlow: true,
      sleeveVisible: false,
    };
  }, [scene, skipIntro]);

  return (
    <motion.div
      className="relative flex flex-col items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* 賞ラベル（フリップ後に表示） */}
      <AnimatePresence>
        {isFlipped && (
          <motion.div
            initial={{ scale: 0, y: -30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            className={`mb-4 px-6 py-2 ${config.labelBg} text-white text-2xl font-black rounded-full z-10`}
            style={{
              boxShadow: `0 0 30px ${config.glowColor}`,
            }}
          >
            {isFakeOut ? "...C賞" : config.label}
          </motion.div>
        )}
      </AnimatePresence>

      {/* カードコンテナ */}
      <motion.div
        className="relative"
        style={{ perspective: "1000px" }}
        animate={{
          rotateY: showHoloTilt ? [0, 8, -8, 0] : 0,
          rotateX: showHoloTilt ? [0, -3, 3, 0] : 0,
        }}
        transition={{
          rotateY: showHoloTilt ? { duration: 4, repeat: Infinity, ease: "easeInOut" } : {},
          rotateX: showHoloTilt ? { duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.5 } : {},
        }}
      >
        {/* スリーブ（Scene 1-2） */}
        <AnimatePresence>
          {sceneStyles.sleeveVisible && (
            <motion.div
              className="absolute inset-0 z-20 pointer-events-none"
              initial={{ y: 0, opacity: 1 }}
              animate={{ y: scene === 2 ? -280 : 0, opacity: scene === 2 ? 0 : 0.8 }}
              exit={{ y: -280, opacity: 0 }}
              transition={{ duration: 1.5, ease: "easeOut" }}
            >
              <div 
                className="w-[280px] h-[400px] rounded-xl"
                style={{
                  background: "linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  backdropFilter: "blur(4px)",
                  boxShadow: "inset 0 0 30px rgba(255,255,255,0.1)",
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* カード本体 */}
        <motion.div
          className="relative rounded-xl overflow-hidden"
          style={{
            width: "280px",
            opacity: sceneStyles.cardOpacity,
            transformStyle: "preserve-3d",
          }}
          initial={{ rotateY: skipIntro ? 0 : 180 }}
          animate={{ 
            rotateY: isFlipped ? 0 : 180,
            scale: showFinal ? 1 : isFlipped ? 1.02 : 1,
          }}
          transition={{ 
            rotateY: { duration: 0.4, ease: "easeOut" },
            scale: { duration: 0.3 },
          }}
        >
          {/* カード裏面 */}
          <motion.div
            className="absolute inset-0 rounded-xl"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
              background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
              border: `2px solid ${config.borderColor}`,
              boxShadow: sceneStyles.borderGlow 
                ? `0 0 20px ${config.glowColor}, inset 0 0 20px rgba(255,255,255,0.1)`
                : "none",
            }}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-20 h-28 border-2 border-white/20 rounded-lg" />
            </div>
            {/* パルス光（Scene 3） */}
            {sceneStyles.showPulse && (
              <motion.div
                className="absolute inset-0 rounded-xl"
                animate={{ opacity: [0, 0.3, 0] }}
                transition={{ duration: 1.2, repeat: Infinity }}
                style={{ background: `radial-gradient(circle, ${config.lightColor}40 0%, transparent 70%)` }}
              />
            )}
          </motion.div>

          {/* カード表面 */}
          <div
            className="rounded-xl overflow-hidden"
            style={{
              backfaceVisibility: "hidden",
              border: `3px solid ${config.borderColor}`,
              boxShadow: isFlipped 
                ? `0 0 40px ${config.glowColor}, 0 20px 50px rgba(0,0,0,0.5)`
                : "none",
            }}
          >
            <div className="aspect-[3/4] bg-white relative">
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

              {/* ホログラフィック反射（Scene 5+） */}
              {showHoloTilt && isHighTier && (
                <motion.div
                  className="absolute inset-0 pointer-events-none"
                  animate={{
                    background: [
                      "linear-gradient(120deg, transparent 20%, rgba(255,255,255,0.4) 50%, transparent 80%)",
                      "linear-gradient(120deg, transparent 60%, rgba(255,255,255,0.4) 90%, transparent 100%)",
                      "linear-gradient(120deg, transparent 0%, rgba(255,255,255,0.4) 10%, transparent 40%)",
                    ],
                  }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                />
              )}

              {/* レインボーオーバーレイ（S賞） */}
              {card.prizeTier === "S" && isFlipped && (
                <motion.div
                  className="absolute inset-0 pointer-events-none opacity-20"
                  style={{
                    background: `linear-gradient(${rainbowIndex * 40}deg, ${RAINBOW_COLORS[rainbowIndex]}, ${RAINBOW_COLORS[(rainbowIndex + 3) % 7]})`,
                  }}
                />
              )}
            </div>
          </div>
        </motion.div>

        {/* エッジライトストリーク（Scene 3） */}
        {scene === 3 && !skipIntro && (
          <>
            {[0, 1, 2, 3].map((i) => (
              <motion.div
                key={i}
                className="absolute"
                style={{
                  top: i < 2 ? 0 : "auto",
                  bottom: i >= 2 ? 0 : "auto",
                  left: i % 2 === 0 ? 0 : "auto",
                  right: i % 2 === 1 ? 0 : "auto",
                  width: i < 2 ? "100%" : "2px",
                  height: i < 2 ? "2px" : "100%",
                  background: `linear-gradient(${i < 2 ? "to right" : "to bottom"}, transparent, ${config.lightColor}, transparent)`,
                }}
                animate={{ opacity: [0.2, 0.8, 0.2] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

// 10連: カードシルエット配列
function TenCardsSilhouettes({ playCount }: { playCount: number }) {
  return (
    <div className="flex flex-wrap justify-center gap-3 max-w-xl">
      {Array.from({ length: playCount }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 0.3, y: 0 }}
          transition={{ delay: i * 0.08 }}
          className="w-12 h-16 rounded border border-white/20"
          style={{
            background: "linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)",
            boxShadow: "0 0 10px rgba(255,255,255,0.1)",
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

// 10連: 最後の1枚サスペンス
function FinalCardSuspense({ config }: { config: typeof TIER_CONFIG.S }) {
  return (
    <motion.div
      animate={{ 
        scale: [1, 1.02, 1],
      }}
      transition={{ repeat: Infinity, duration: 0.8 }}
      className="w-28 h-40 rounded-xl relative"
      style={{
        background: "linear-gradient(135deg, #1a1a2e, #16213e)",
        boxShadow: `0 0 40px ${config.glowColor}`,
        border: `2px solid ${config.borderColor}`,
      }}
    >
      {/* パルス光 */}
      <motion.div
        className="absolute inset-0 rounded-xl"
        animate={{ opacity: [0.2, 0.5, 0.2] }}
        transition={{ duration: 1, repeat: Infinity }}
        style={{
          background: `radial-gradient(circle, ${config.lightColor}30 0%, transparent 70%)`,
        }}
      />
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
      <motion.div
        className={`mb-4 px-6 py-2 ${resultConfig.labelBg} text-white text-2xl font-black rounded-full`}
        style={{ boxShadow: `0 0 30px ${resultConfig.glowColor}` }}
      >
        {isFakeOut ? "結果: C賞" : `最高: ${resultConfig.label}`}
      </motion.div>

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

      <motion.div
        className="text-7xl font-black text-white"
        style={{ textShadow: "0 0 40px rgba(255, 200, 50, 0.8)" }}
      >
        {current} / {total}
      </motion.div>
      
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
      <motion.div
        className="w-16 h-16 mx-auto rounded-full"
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
        style={{
          border: `3px solid ${config.borderColor}`,
          borderTopColor: "transparent",
        }}
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
      <motion.div
        className={`mb-4 px-8 py-3 ${config.labelBg} text-white text-3xl font-black rounded-full`}
        style={{ boxShadow: `0 0 40px ${config.glowColor}` }}
      >
        最高: {config.label}
      </motion.div>

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
