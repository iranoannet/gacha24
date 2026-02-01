import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { useEffect, useState, useMemo, useCallback } from "react";
import { useGachaSound } from "@/hooks/useGachaSound";

interface BeigomaBattleAnimationProps {
  isPlaying: boolean;
  onComplete: () => void;
  onSkip?: () => void;
  prizeTier: "S" | "A" | "B" | "miss";
  playCount: number;
}

// ベーゴマカラー設定
const BEIGOMA_COLORS = {
  gold: {
    primary: "#FFD700",
    secondary: "#FFA500",
    glow: "rgba(255, 215, 0, 0.9)",
    gradient: "linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #FFD700 100%)",
  },
  red: {
    primary: "#FF2222",
    secondary: "#CC0000",
    glow: "rgba(255, 34, 34, 0.8)",
    gradient: "linear-gradient(135deg, #FF4444 0%, #CC0000 50%, #FF2222 100%)",
  },
  black: {
    primary: "#1A1A1A",
    secondary: "#333333",
    glow: "rgba(80, 80, 80, 0.6)",
    gradient: "linear-gradient(135deg, #333333 0%, #1A1A1A 50%, #2A2A2A 100%)",
  },
  white: {
    primary: "#FFFFFF",
    secondary: "#DDDDDD",
    glow: "rgba(255, 255, 255, 0.7)",
    gradient: "linear-gradient(135deg, #FFFFFF 0%, #EEEEEE 50%, #FFFFFF 100%)",
  },
};

// 演出タイミング (8秒尺)
const TIMING = {
  INTRO: 0,           // 0s - 開始
  ZOOM_IN: 0.5,       // 0.5s - スローズームイン
  BATTLE_START: 1.5,  // 1.5s - バトル開始
  COLLISION_1: 2.5,   // 2.5s - 衝突1
  COLLISION_2: 3.5,   // 3.5s - 衝突2
  FAKE_TENSION: 4.5,  // 4.5s - フェイク煽り
  SLOW_MO: 5.5,       // 5.5s - スローモーション
  CLIMAX: 6.5,        // 6.5s - クライマックス
  RESULT: 7.5,        // 7.5s - 結果表示
  END: 8.5,           // 8.5s - 終了
};

export function BeigomaBattleAnimation({
  isPlaying,
  onComplete,
  onSkip,
  prizeTier,
  playCount,
}: BeigomaBattleAnimationProps) {
  const [phase, setPhase] = useState<"intro" | "battle" | "fake" | "slowmo" | "climax" | "result">("intro");
  const [cameraZoom, setCameraZoom] = useState(1);
  const [cameraRotation, setCameraRotation] = useState(0);
  const [screenShake, setScreenShake] = useState(0);
  const [showImpact, setShowImpact] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const [slowMoActive, setSlowMoActive] = useState(false);
  const [winnerRevealed, setWinnerRevealed] = useState(false);
  const [goldCrash, setGoldCrash] = useState(false);
  const sound = useGachaSound();

  // 結果に応じた対戦設定
  const battleConfig = useMemo(() => {
    switch (prizeTier) {
      case "S":
        // 赤vs黒 → 金が上から降ってきて勝利
        return {
          left: BEIGOMA_COLORS.red,
          right: BEIGOMA_COLORS.black,
          winner: BEIGOMA_COLORS.gold,
          winnerName: "GOLD",
          hasGoldCrash: true,
          mood: "jackpot",
        };
      case "A":
        // 赤vs白 → 赤が勝利
        return {
          left: BEIGOMA_COLORS.red,
          right: BEIGOMA_COLORS.white,
          winner: BEIGOMA_COLORS.red,
          winnerName: "RED",
          hasGoldCrash: false,
          mood: "victory",
        };
      case "B":
        // 赤vs黒 → 黒が勝利（重い雰囲気）
        return {
          left: BEIGOMA_COLORS.red,
          right: BEIGOMA_COLORS.black,
          winner: BEIGOMA_COLORS.black,
          winnerName: "BLACK",
          hasGoldCrash: false,
          mood: "ominous",
        };
      case "miss":
      default:
        // 赤vs白 → 白が勝利（フェイク煽り後）
        return {
          left: BEIGOMA_COLORS.red,
          right: BEIGOMA_COLORS.white,
          winner: BEIGOMA_COLORS.white,
          winnerName: "WHITE",
          hasGoldCrash: false,
          mood: "disappointment",
        };
    }
  }, [prizeTier]);

  // スパークパーティクル
  const sparks = useMemo(() => 
    Array.from({ length: 40 }, (_, i) => ({
      id: i,
      angle: (i / 40) * 360 + Math.random() * 20,
      distance: 80 + Math.random() * 150,
      size: 4 + Math.random() * 8,
      delay: Math.random() * 0.2,
    })), []);

  // 浮遊パーティクル
  const dustParticles = useMemo(() =>
    Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 2 + Math.random() * 4,
      duration: 3 + Math.random() * 4,
      delay: Math.random() * 2,
    })), []);

  // 画面シェイク
  const triggerShake = useCallback((intensity: number, duration: number = 200) => {
    setScreenShake(intensity);
    setTimeout(() => setScreenShake(0), duration);
  }, []);

  // インパクトフレーム
  const triggerImpact = useCallback(() => {
    setShowImpact(true);
    setTimeout(() => setShowImpact(false), 100);
  }, []);

  // フラッシュ
  const triggerFlash = useCallback((duration: number = 150) => {
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), duration);
  }, []);

  // スキップハンドラー
  const handleSkip = () => {
    sound.stopAll();
    if (onSkip) {
      onSkip();
    } else {
      onComplete();
    }
  };

  // メイン演出シーケンス
  useEffect(() => {
    if (!isPlaying) return;

    // 初期化
    setPhase("intro");
    setCameraZoom(1);
    setCameraRotation(0);
    setScreenShake(0);
    setSlowMoActive(false);
    setWinnerRevealed(false);
    setGoldCrash(false);

    const timers: NodeJS.Timeout[] = [];

    // イントロ - スローズームイン
    sound.playSlotSpin();
    timers.push(setTimeout(() => {
      setCameraZoom(1.3);
    }, TIMING.ZOOM_IN * 1000));

    // バトル開始
    timers.push(setTimeout(() => {
      setPhase("battle");
      sound.playDrumRoll(3);
    }, TIMING.BATTLE_START * 1000));

    // 衝突1
    timers.push(setTimeout(() => {
      triggerImpact();
      triggerShake(15);
      sound.playImpact();
      setCameraRotation(5);
    }, TIMING.COLLISION_1 * 1000));

    // 衝突2
    timers.push(setTimeout(() => {
      triggerImpact();
      triggerShake(20);
      sound.playImpact();
      setCameraRotation(-5);
      setCameraZoom(1.5);
    }, TIMING.COLLISION_2 * 1000));

    // フェイク煽り（missとS賞で特別演出）
    timers.push(setTimeout(() => {
      setPhase("fake");
      if (prizeTier === "miss") {
        // 赤が勝ちそうに見せる
        triggerShake(10);
      } else if (prizeTier === "S") {
        // 黒が押してるように見せる
        triggerShake(12);
      }
      sound.playHeartbeat(3);
    }, TIMING.FAKE_TENSION * 1000));

    // スローモーション
    timers.push(setTimeout(() => {
      setPhase("slowmo");
      setSlowMoActive(true);
      setCameraZoom(1.8);
      setCameraRotation(0);
    }, TIMING.SLOW_MO * 1000));

    // クライマックス
    timers.push(setTimeout(() => {
      setPhase("climax");
      setSlowMoActive(false);
      
      if (battleConfig.hasGoldCrash) {
        // S賞: 金が上から落下
        setGoldCrash(true);
        triggerFlash(300);
        triggerShake(30, 500);
        sound.playJackpot();
      } else {
        triggerFlash(200);
        triggerShake(25, 400);
        if (prizeTier === "A") {
          sound.playReveal(true);
        } else if (prizeTier === "B") {
          sound.playReveal(false);
        } else {
          sound.playMiss();
        }
      }
      
      setCameraZoom(2);
    }, TIMING.CLIMAX * 1000));

    // 結果表示
    timers.push(setTimeout(() => {
      setPhase("result");
      setWinnerRevealed(true);
      setCameraZoom(1);
      setCameraRotation(0);
      
      if (prizeTier === "S") {
        sound.playCoinSound(10);
      }
    }, TIMING.RESULT * 1000));

    // 終了
    timers.push(setTimeout(() => {
      onComplete();
    }, TIMING.END * 1000));

    return () => timers.forEach(clearTimeout);
  }, [isPlaying, prizeTier, battleConfig, onComplete, sound, triggerImpact, triggerShake, triggerFlash]);

  if (!isPlaying) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[110] overflow-hidden"
        style={{
          background: prizeTier === "B" 
            ? "radial-gradient(ellipse at center, #0a0a0a 0%, #000000 100%)"
            : "radial-gradient(ellipse at center, #1a1a2e 0%, #050510 100%)",
        }}
      >
        {/* 浮遊ダスト */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {dustParticles.map((p) => (
            <motion.div
              key={p.id}
              className="absolute rounded-full bg-white/20"
              style={{
                width: p.size,
                height: p.size,
                left: `${p.x}%`,
                top: `${p.y}%`,
              }}
              animate={{
                y: [0, -50, 0],
                opacity: [0.1, 0.4, 0.1],
              }}
              transition={{
                duration: p.duration,
                delay: p.delay,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>

        {/* メインカメラコンテナ */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          animate={{
            scale: cameraZoom,
            rotate: cameraRotation,
            x: screenShake ? (Math.random() - 0.5) * screenShake * 2 : 0,
            y: screenShake ? (Math.random() - 0.5) * screenShake * 2 : 0,
          }}
          transition={{
            scale: { duration: slowMoActive ? 1 : 0.3, ease: "easeOut" },
            rotate: { duration: 0.2 },
            x: { duration: 0.05 },
            y: { duration: 0.05 },
          }}
        >
          {/* バトルアリーナ */}
          <div className="relative w-80 h-80">
            {/* アリーナ床 */}
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{
                background: "radial-gradient(circle, #2a2a3e 0%, #15152a 60%, #0a0a15 100%)",
                boxShadow: "inset 0 0 80px rgba(0,0,0,0.9), 0 0 60px rgba(100,100,255,0.1)",
              }}
              animate={{
                boxShadow: phase === "climax" || phase === "result"
                  ? `inset 0 0 80px rgba(0,0,0,0.9), 0 0 100px ${battleConfig.winner.glow}`
                  : "inset 0 0 80px rgba(0,0,0,0.9), 0 0 60px rgba(100,100,255,0.1)",
              }}
            >
              {/* 同心円リング */}
              {[0.3, 0.5, 0.7, 0.9].map((scale, i) => (
                <motion.div
                  key={i}
                  className="absolute inset-0 rounded-full border border-white/10"
                  style={{ transform: `scale(${scale})` }}
                  animate={{
                    borderColor: phase === "battle" ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.1)",
                  }}
                />
              ))}
            </motion.div>

            {/* 左ベーゴマ（赤） */}
            <motion.div
              className="absolute w-24 h-24"
              style={{ top: "50%", left: "50%" }}
              initial={{ x: "-300%", y: "-50%", scale: 0 }}
              animate={{
                x: phase === "intro" ? "-200%" :
                   phase === "battle" ? ["-120%", "-80%", "-100%", "-70%", "-90%"] :
                   phase === "fake" ? (prizeTier === "miss" ? "-60%" : "-100%") :
                   phase === "slowmo" ? "-80%" :
                   phase === "climax" || phase === "result" ? 
                     (battleConfig.hasGoldCrash ? "200%" : 
                      battleConfig.winner === battleConfig.left ? "-50%" : "-300%") :
                   "-50%",
                y: "-50%",
                scale: phase === "intro" ? 1 :
                       phase === "result" && battleConfig.winner === battleConfig.left ? 1.3 :
                       phase === "climax" && battleConfig.hasGoldCrash ? 0 : 1,
                rotate: phase === "result" ? 0 : [0, 720],
                opacity: phase === "result" && battleConfig.winner !== battleConfig.left && !battleConfig.hasGoldCrash ? 0 : 1,
              }}
              transition={{
                x: { duration: slowMoActive ? 1.5 : 0.4, ease: "easeInOut" },
                y: { duration: 0.3 },
                scale: { duration: 0.3 },
                rotate: { duration: slowMoActive ? 2 : 0.4, repeat: phase !== "result" ? Infinity : 0, ease: "linear" },
                opacity: { duration: 0.5 },
              }}
            >
              <BeigomaSpinner 
                color={battleConfig.left} 
                isWinner={winnerRevealed && battleConfig.winner === battleConfig.left}
                glowing={phase === "fake" && prizeTier === "miss"}
              />
            </motion.div>

            {/* 右ベーゴマ（白/黒） */}
            <motion.div
              className="absolute w-24 h-24"
              style={{ top: "50%", left: "50%" }}
              initial={{ x: "200%", y: "-50%", scale: 0 }}
              animate={{
                x: phase === "intro" ? "100%" :
                   phase === "battle" ? ["20%", "-20%", "0%", "30%", "10%"] :
                   phase === "fake" ? (prizeTier === "B" ? "-20%" : "0%") :
                   phase === "slowmo" ? "-20%" :
                   phase === "climax" || phase === "result" ?
                     (battleConfig.hasGoldCrash ? "-300%" :
                      battleConfig.winner === battleConfig.right ? "-50%" : "300%") :
                   "-50%",
                y: "-50%",
                scale: phase === "intro" ? 1 :
                       phase === "result" && battleConfig.winner === battleConfig.right ? 1.3 :
                       phase === "climax" && battleConfig.hasGoldCrash ? 0 : 1,
                rotate: phase === "result" ? 0 : [0, -720],
                opacity: phase === "result" && battleConfig.winner !== battleConfig.right && !battleConfig.hasGoldCrash ? 0 : 1,
              }}
              transition={{
                x: { duration: slowMoActive ? 1.5 : 0.4, ease: "easeInOut" },
                y: { duration: 0.3 },
                scale: { duration: 0.3 },
                rotate: { duration: slowMoActive ? 2 : 0.4, repeat: phase !== "result" ? Infinity : 0, ease: "linear" },
                opacity: { duration: 0.5 },
              }}
            >
              <BeigomaSpinner 
                color={battleConfig.right} 
                isWinner={winnerRevealed && battleConfig.winner === battleConfig.right}
                glowing={phase === "fake" && prizeTier === "B"}
              />
            </motion.div>

            {/* 金ベーゴマ（S賞のみ - 上から落下） */}
            {battleConfig.hasGoldCrash && (
              <motion.div
                className="absolute w-28 h-28"
                style={{ top: "50%", left: "50%" }}
                initial={{ x: "-50%", y: "-500%", scale: 1.5 }}
                animate={{
                  y: goldCrash ? "-50%" : "-500%",
                  scale: goldCrash ? (phase === "result" ? 1.5 : 1.2) : 1.5,
                  rotate: goldCrash ? [0, 1080] : 0,
                }}
                transition={{
                  y: { duration: 0.3, ease: "easeIn" },
                  scale: { duration: 0.5 },
                  rotate: { duration: 0.8, ease: "linear" },
                }}
              >
                <BeigomaSpinner 
                  color={BEIGOMA_COLORS.gold} 
                  isWinner={winnerRevealed}
                  glowing={goldCrash}
                />
              </motion.div>
            )}

            {/* 衝突スパーク */}
            <AnimatePresence>
              {(phase === "battle" || phase === "climax") && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  {sparks.map((spark) => (
                    <motion.div
                      key={spark.id}
                      className="absolute rounded-full"
                      style={{
                        width: spark.size,
                        height: spark.size,
                        background: phase === "climax" && battleConfig.hasGoldCrash
                          ? "linear-gradient(135deg, #FFD700, #FFA500)"
                          : "linear-gradient(135deg, #FFFFFF, #FFD700)",
                        boxShadow: `0 0 ${spark.size * 2}px ${battleConfig.hasGoldCrash ? "#FFD700" : "#FFF"}`,
                      }}
                      initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
                      animate={{
                        x: Math.cos((spark.angle * Math.PI) / 180) * spark.distance,
                        y: Math.sin((spark.angle * Math.PI) / 180) * spark.distance,
                        opacity: [0, 1, 0],
                        scale: [0, 1, 0],
                      }}
                      transition={{
                        duration: phase === "climax" ? 0.8 : 0.5,
                        delay: spark.delay,
                        repeat: Infinity,
                        repeatDelay: 0.6,
                      }}
                    />
                  ))}
                </div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* インパクトフレーム */}
        <AnimatePresence>
          {showImpact && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-40 pointer-events-none"
              style={{
                background: "radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 50%)",
              }}
            />
          )}
        </AnimatePresence>

        {/* フラッシュエフェクト */}
        <AnimatePresence>
          {showFlash && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.9 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50"
              style={{
                background: battleConfig.hasGoldCrash
                  ? `radial-gradient(circle, ${BEIGOMA_COLORS.gold.primary} 0%, rgba(255,215,0,0.5) 50%, transparent 80%)`
                  : "radial-gradient(circle, white 0%, transparent 70%)",
              }}
            />
          )}
        </AnimatePresence>

        {/* 結果カラーフィル */}
        <AnimatePresence>
          {phase === "result" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.15 }}
              className="absolute inset-0 z-30 pointer-events-none"
              style={{
                background: `radial-gradient(circle at center, ${battleConfig.winner.primary} 0%, transparent 70%)`,
              }}
            />
          )}
        </AnimatePresence>

        {/* 結果テキスト */}
        <AnimatePresence>
          {phase === "result" && winnerRevealed && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="absolute inset-x-0 top-16 flex flex-col items-center z-60"
            >
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }}
                className="text-center"
              >
                <p className="text-sm font-bold text-white/60 mb-1 tracking-widest">WINNER</p>
                <motion.p
                  className="text-5xl font-black tracking-wider"
                  style={{
                    color: battleConfig.winner.primary,
                    textShadow: `0 0 40px ${battleConfig.winner.glow}, 0 0 80px ${battleConfig.winner.glow}`,
                  }}
                  animate={{
                    textShadow: [
                      `0 0 40px ${battleConfig.winner.glow}, 0 0 80px ${battleConfig.winner.glow}`,
                      `0 0 60px ${battleConfig.winner.glow}, 0 0 120px ${battleConfig.winner.glow}`,
                      `0 0 40px ${battleConfig.winner.glow}, 0 0 80px ${battleConfig.winner.glow}`,
                    ],
                  }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  {battleConfig.winnerName}
                </motion.p>
                
                {prizeTier === "S" && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="mt-4"
                  >
                    <motion.p
                      className="text-3xl font-black text-transparent bg-clip-text"
                      style={{
                        backgroundImage: "linear-gradient(90deg, #FFD700, #FFA500, #FFD700)",
                        backgroundSize: "200% 100%",
                      }}
                      animate={{
                        backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
                      }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      ★ JACKPOT ★
                    </motion.p>
                  </motion.div>
                )}

                {prizeTier === "miss" && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.5 }}
                    transition={{ delay: 0.5 }}
                    className="mt-4 text-sm text-white/40"
                  >
                    . . .
                  </motion.p>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* スローモーションインジケーター */}
        <AnimatePresence>
          {slowMoActive && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-x-0 bottom-32 flex justify-center"
            >
              <motion.p
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 0.5, repeat: Infinity }}
                className="text-2xl font-black text-white/80 tracking-[0.5em]"
              >
                . . .
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* フェーズテキスト */}
        <AnimatePresence>
          {phase === "battle" && (
            <motion.div
              initial={{ opacity: 0, scale: 2 }}
              animate={{ opacity: [0, 1, 0], scale: 1 }}
              transition={{ duration: 0.8 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-40"
            >
              <p className="text-6xl font-black text-white tracking-widest" style={{ textShadow: "0 0 30px rgba(255,255,255,0.5)" }}>
                FIGHT!
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* プレイ回数 */}
        <div className="absolute top-4 left-4 z-50">
          <div className="bg-black/60 backdrop-blur-sm rounded-lg px-4 py-2 border border-white/20">
            <p className="text-white/50 text-xs">DRAW</p>
            <p className="text-white text-xl font-black">×{playCount}</p>
          </div>
        </div>

        {/* スキップボタン */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.7 }}
          whileHover={{ opacity: 1 }}
          transition={{ delay: 1 }}
          onClick={handleSkip}
          className="absolute bottom-6 right-6 px-5 py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full text-white font-medium text-sm transition-colors z-[120] border border-white/20"
        >
          SKIP →
        </motion.button>
      </motion.div>
    </AnimatePresence>
  );
}

// ベーゴマスピナーコンポーネント
function BeigomaSpinner({ 
  color, 
  isWinner,
  glowing = false,
}: { 
  color: typeof BEIGOMA_COLORS.gold;
  isWinner: boolean;
  glowing?: boolean;
}) {
  return (
    <div className="relative w-full h-full">
      {/* 勝者グロー */}
      {(isWinner || glowing) && (
        <motion.div
          className="absolute inset-[-20%] rounded-full blur-2xl"
          style={{ background: color.primary }}
          animate={{ 
            opacity: [0.4, 0.8, 0.4], 
            scale: [1, 1.3, 1] 
          }}
          transition={{ duration: 0.6, repeat: Infinity }}
        />
      )}
      
      {/* ベーゴマ本体 */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: color.gradient,
          boxShadow: `0 0 30px ${color.glow}, inset 0 0 20px rgba(0,0,0,0.4)`,
        }}
      >
        {/* 中心軸 */}
        <div
          className="absolute top-1/2 left-1/2 w-5 h-5 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background: `radial-gradient(circle, ${color.secondary} 0%, ${color.primary} 100%)`,
            boxShadow: "inset 0 2px 6px rgba(255,255,255,0.4), 0 2px 4px rgba(0,0,0,0.3)",
          }}
        />
        
        {/* スポーク模様 */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
          <div
            key={angle}
            className="absolute top-1/2 left-1/2 w-0.5 h-10 origin-bottom"
            style={{
              background: `linear-gradient(to top, ${color.secondary}80, transparent)`,
              transform: `translate(-50%, -100%) rotate(${angle}deg)`,
            }}
          />
        ))}
        
        {/* ハイライト */}
        <div
          className="absolute top-2 left-2 w-5 h-5 rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(255,255,255,0.5) 0%, transparent 70%)",
          }}
        />
        
        {/* リムエッジ */}
        <div
          className="absolute inset-1 rounded-full border-2"
          style={{
            borderColor: `${color.secondary}40`,
          }}
        />
      </div>
    </div>
  );
}

// ヘルパー関数
export function getBeigomaPrizeTier(
  cards: { prizeTier: string }[]
): "S" | "A" | "B" | "miss" {
  const tierOrder = ["S", "A", "B", "miss"];
  let highest = "miss";
  for (const card of cards) {
    if (tierOrder.indexOf(card.prizeTier) < tierOrder.indexOf(highest)) {
      highest = card.prizeTier;
    }
  }
  return highest as "S" | "A" | "B" | "miss";
}
