import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useMemo, useCallback } from "react";
import { useGachaSound } from "@/hooks/useGachaSound";
import mascotImage from "@/assets/mascot-character.jpeg";

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

// 演出タイミング (9秒尺)
const TIMING = {
  INTRO: 0,
  KANJI_BATTLE: 0.8,
  BATTLE_START: 1.8,
  COLLISION_1: 2.6,
  COLLISION_2: 3.5,
  COLLISION_3: 4.3,
  GEKIATSU: 5.0,
  SLOW_MO: 6.0,
  CLIMAX: 7.0,
  RESULT: 8.0,
  END: 9.5,
};

type MascotPose = "excited" | "shocked" | "happy" | "sad" | "watching";

export function BeigomaBattleAnimation({
  isPlaying,
  onComplete,
  onSkip,
  prizeTier,
  playCount,
}: BeigomaBattleAnimationProps) {
  const [phase, setPhase] = useState<"intro" | "battle" | "gekiatsu" | "slowmo" | "climax" | "result">("intro");
  const [cameraZoom, setCameraZoom] = useState(1);
  const [cameraRotation, setCameraRotation] = useState(0);
  const [screenShake, setScreenShake] = useState(0);
  const [showFlash, setShowFlash] = useState(false);
  const [slowMoActive, setSlowMoActive] = useState(false);
  const [winnerRevealed, setWinnerRevealed] = useState(false);
  const [goldCrash, setGoldCrash] = useState(false);
  const [showKanji, setShowKanji] = useState<string | null>(null);
  const [showGekiatsu, setShowGekiatsu] = useState(false);
  const [showRush, setShowRush] = useState(false);
  const [mascotPose, setMascotPose] = useState<MascotPose>("watching");
  const [showMascot, setShowMascot] = useState(false);
  const [fireIntensity, setFireIntensity] = useState(0);
  const sound = useGachaSound();

  // 結果に応じた対戦設定
  const battleConfig = useMemo(() => {
    switch (prizeTier) {
      case "S":
        return {
          left: BEIGOMA_COLORS.red,
          right: BEIGOMA_COLORS.black,
          winner: BEIGOMA_COLORS.gold,
          winnerName: "GOLD",
          hasGoldCrash: true,
        };
      case "A":
        return {
          left: BEIGOMA_COLORS.red,
          right: BEIGOMA_COLORS.white,
          winner: BEIGOMA_COLORS.red,
          winnerName: "RED",
          hasGoldCrash: false,
        };
      case "B":
        return {
          left: BEIGOMA_COLORS.red,
          right: BEIGOMA_COLORS.black,
          winner: BEIGOMA_COLORS.black,
          winnerName: "BLACK",
          hasGoldCrash: false,
        };
      case "miss":
      default:
        return {
          left: BEIGOMA_COLORS.red,
          right: BEIGOMA_COLORS.white,
          winner: BEIGOMA_COLORS.white,
          winnerName: "WHITE",
          hasGoldCrash: false,
        };
    }
  }, [prizeTier]);

  // 火花パーティクル
  const fireParticles = useMemo(() => 
    Array.from({ length: 80 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 3 + Math.random() * 15,
      duration: 1 + Math.random() * 2,
      delay: Math.random() * 0.5,
      type: Math.random() > 0.5 ? "ember" : "spark",
    })), []);

  // 爆発スパーク
  const explosionSparks = useMemo(() => 
    Array.from({ length: 60 }, (_, i) => ({
      id: i,
      angle: (i / 60) * 360 + Math.random() * 30,
      distance: 120 + Math.random() * 200,
      size: 6 + Math.random() * 14,
      delay: Math.random() * 0.1,
    })), []);

  // 画面シェイク
  const triggerShake = useCallback((intensity: number, duration: number = 200) => {
    setScreenShake(intensity);
    setTimeout(() => setScreenShake(0), duration);
  }, []);

  // フラッシュ
  const triggerFlash = useCallback((duration: number = 150) => {
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), duration);
  }, []);

  // スキップ
  const handleSkip = () => {
    sound.stopAll();
    onSkip ? onSkip() : onComplete();
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
    setShowKanji(null);
    setShowGekiatsu(false);
    setShowRush(false);
    setShowMascot(false);
    setMascotPose("watching");
    setFireIntensity(0);

    const timers: NodeJS.Timeout[] = [];

    // イントロ
    sound.playPachinkoReach(2.5);
    timers.push(setTimeout(() => setFireIntensity(0.3), 300));

    // 「戦」漢字表示
    timers.push(setTimeout(() => {
      setShowKanji("戦");
      triggerFlash(200);
      triggerShake(15);
      setCameraZoom(1.2);
    }, TIMING.KANJI_BATTLE * 1000));

    // バトル開始
    timers.push(setTimeout(() => {
      setPhase("battle");
      setShowKanji(null);
      setFireIntensity(0.5);
      sound.playTaikoDrumRoll(3.5);
    }, TIMING.BATTLE_START * 1000));

    // 衝突1
    timers.push(setTimeout(() => {
      triggerFlash(100);
      triggerShake(25);
      sound.playMetalClash();
      setCameraRotation(10);
      setFireIntensity(0.7);
      setShowMascot(true);
      setMascotPose("excited");
    }, TIMING.COLLISION_1 * 1000));

    // 衝突2
    timers.push(setTimeout(() => {
      triggerFlash(100);
      triggerShake(30);
      sound.playSlotRapidFire(0.8);
      setCameraRotation(-10);
      setCameraZoom(1.5);
    }, TIMING.COLLISION_2 * 1000));

    // 衝突3
    timers.push(setTimeout(() => {
      triggerFlash(100);
      triggerShake(35);
      sound.playElectronicAlarm(1.2);
      setCameraRotation(5);
      setMascotPose("shocked");
    }, TIMING.COLLISION_3 * 1000));

    // 激熱演出
    timers.push(setTimeout(() => {
      setPhase("gekiatsu");
      setShowGekiatsu(true);
      setFireIntensity(1);
      triggerFlash(300);
      triggerShake(20, 500);
      sound.playHeartbeat(4);
      
      if (prizeTier === "S" || prizeTier === "A") {
        setMascotPose("excited");
      }
    }, TIMING.GEKIATSU * 1000));

    // スローモー
    timers.push(setTimeout(() => {
      setPhase("slowmo");
      setSlowMoActive(true);
      setShowGekiatsu(false);
      setCameraZoom(2);
      setCameraRotation(0);
      setMascotPose("watching");
    }, TIMING.SLOW_MO * 1000));

    // クライマックス
    timers.push(setTimeout(() => {
      setPhase("climax");
      setSlowMoActive(false);
      
      if (battleConfig.hasGoldCrash) {
        setGoldCrash(true);
        setShowRush(true);
        triggerFlash(500);
        triggerShake(50, 700);
        sound.playThunder();
        setTimeout(() => sound.playJackpot(), 250);
        setMascotPose("happy");
      } else {
        triggerFlash(300);
        triggerShake(35, 500);
        sound.playThunder();
        if (prizeTier === "A") {
          setTimeout(() => sound.playGoldReveal(), 200);
          setMascotPose("happy");
        } else if (prizeTier === "B") {
          setTimeout(() => sound.playSilverReveal(), 200);
          setMascotPose("watching");
        } else {
          setTimeout(() => sound.playMiss(), 300);
          setMascotPose("sad");
        }
      }
      
      setCameraZoom(2.3);
    }, TIMING.CLIMAX * 1000));

    // 結果
    timers.push(setTimeout(() => {
      setPhase("result");
      setWinnerRevealed(true);
      setCameraZoom(1);
      setCameraRotation(0);
      setShowMascot(true);
      
      if (prizeTier === "S") {
        sound.playCoinSound(15);
      }
    }, TIMING.RESULT * 1000));

    // 終了
    timers.push(setTimeout(onComplete, TIMING.END * 1000));

    return () => timers.forEach(clearTimeout);
  }, [isPlaying, prizeTier, battleConfig, onComplete, sound, triggerShake, triggerFlash]);

  if (!isPlaying) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[110] overflow-hidden"
      >
        {/* 炎背景グラデーション */}
        <motion.div
          className="absolute inset-0"
          animate={{
            background: phase === "climax" && battleConfig.hasGoldCrash
              ? [
                  "radial-gradient(ellipse at center, #4a1500 0%, #1a0500 50%, #000000 100%)",
                  "radial-gradient(ellipse at center, #6a2500 0%, #3a1500 50%, #0a0000 100%)",
                  "radial-gradient(ellipse at center, #4a1500 0%, #1a0500 50%, #000000 100%)",
                ]
              : phase === "gekiatsu"
              ? "radial-gradient(ellipse at center, #3a0a00 0%, #1a0500 50%, #000000 100%)"
              : "radial-gradient(ellipse at center, #1a0a05 0%, #0a0500 50%, #000000 100%)",
          }}
          transition={{ duration: 0.5, repeat: phase === "climax" && battleConfig.hasGoldCrash ? Infinity : 0 }}
        />

        {/* 火炎パーティクル背景 */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {fireParticles.map((p) => (
            <motion.div
              key={p.id}
              className="absolute rounded-full"
              style={{
                width: p.size,
                height: p.size,
                left: `${p.x}%`,
                bottom: "-10%",
                background: p.type === "ember" 
                  ? "radial-gradient(circle, #FF6600 0%, #FF3300 50%, transparent 100%)"
                  : "radial-gradient(circle, #FFAA00 0%, #FF6600 50%, transparent 100%)",
                boxShadow: p.type === "ember"
                  ? "0 0 10px #FF3300, 0 0 20px #FF0000"
                  : "0 0 8px #FFAA00, 0 0 15px #FF6600",
              }}
              animate={{
                y: [0, -window.innerHeight * (0.8 + Math.random() * 0.4)],
                x: [0, (Math.random() - 0.5) * 100],
                opacity: [0, fireIntensity, fireIntensity * 0.8, 0],
                scale: [0.5, 1, 0.8, 0],
              }}
              transition={{
                duration: p.duration,
                delay: p.delay,
                repeat: Infinity,
                ease: "easeOut",
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
            scale: { duration: slowMoActive ? 1.2 : 0.2, ease: "easeOut" },
            rotate: { duration: 0.12 },
            x: { duration: 0.03 },
            y: { duration: 0.03 },
          }}
        >
          {/* バトルアリーナ */}
          <div className="relative w-72 h-72 sm:w-80 sm:h-80">
            {/* アリーナ（炎の輪） */}
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{
                background: "radial-gradient(circle, #1a0a00 0%, #0a0500 60%, #000000 100%)",
                boxShadow: `inset 0 0 80px rgba(255,100,0,${fireIntensity * 0.3}), 0 0 60px rgba(255,50,0,${fireIntensity * 0.4})`,
              }}
              animate={{
                boxShadow: phase === "climax" || phase === "result"
                  ? `inset 0 0 100px ${battleConfig.winner.glow}, 0 0 100px ${battleConfig.winner.glow}`
                  : `inset 0 0 80px rgba(255,100,0,${fireIntensity * 0.3}), 0 0 60px rgba(255,50,0,${fireIntensity * 0.4})`,
              }}
            >
              {/* 炎のリング */}
              <motion.div
                className="absolute inset-2 rounded-full border-4"
                style={{
                  borderImage: "linear-gradient(45deg, #FF3300, #FF6600, #FFAA00, #FF6600, #FF3300) 1",
                  borderStyle: "solid",
                }}
                animate={{
                  rotate: [0, 360],
                  opacity: [0.5, 1, 0.5],
                }}
                transition={{
                  rotate: { duration: 4, repeat: Infinity, ease: "linear" },
                  opacity: { duration: 1, repeat: Infinity },
                }}
              />
            </motion.div>

            {/* 左ベーゴマ */}
            <motion.div
              className="absolute w-20 h-20 sm:w-24 sm:h-24"
              style={{ top: "50%", left: "50%" }}
              initial={{ x: "-350%", y: "-50%", scale: 0 }}
              animate={{
                x: phase === "intro" ? "-200%" :
                   phase === "battle" ? ["-130%", "-60%", "-110%", "-50%", "-100%"] :
                   phase === "gekiatsu" ? (prizeTier === "miss" ? "-50%" : "-110%") :
                   phase === "slowmo" ? "-80%" :
                   (battleConfig.hasGoldCrash ? "250%" : 
                    battleConfig.winner === battleConfig.left ? "-50%" : "-350%"),
                y: "-50%",
                scale: phase === "result" && battleConfig.winner === battleConfig.left ? 1.5 :
                       phase === "climax" && battleConfig.hasGoldCrash ? 0.2 : 1,
                rotate: phase === "result" ? 0 : [0, 1440],
                opacity: phase === "result" && battleConfig.winner !== battleConfig.left && !battleConfig.hasGoldCrash ? 0 : 1,
              }}
              transition={{
                x: { duration: slowMoActive ? 2 : 0.3, ease: "easeInOut" },
                scale: { duration: 0.4 },
                rotate: { duration: slowMoActive ? 3 : 0.3, repeat: phase !== "result" ? Infinity : 0, ease: "linear" },
                opacity: { duration: 0.5 },
              }}
            >
              <BeigomaSpinner 
                color={battleConfig.left} 
                isWinner={winnerRevealed && battleConfig.winner === battleConfig.left}
                glowing={phase === "gekiatsu" && prizeTier === "miss"}
                fireEffect={fireIntensity > 0.5}
              />
            </motion.div>

            {/* 右ベーゴマ */}
            <motion.div
              className="absolute w-20 h-20 sm:w-24 sm:h-24"
              style={{ top: "50%", left: "50%" }}
              initial={{ x: "250%", y: "-50%", scale: 0 }}
              animate={{
                x: phase === "intro" ? "100%" :
                   phase === "battle" ? ["30%", "-40%", "20%", "50%", "30%"] :
                   phase === "gekiatsu" ? (prizeTier === "B" ? "-40%" : "20%") :
                   phase === "slowmo" ? "-20%" :
                   (battleConfig.hasGoldCrash ? "-350%" :
                    battleConfig.winner === battleConfig.right ? "-50%" : "350%"),
                y: "-50%",
                scale: phase === "result" && battleConfig.winner === battleConfig.right ? 1.5 :
                       phase === "climax" && battleConfig.hasGoldCrash ? 0.2 : 1,
                rotate: phase === "result" ? 0 : [0, -1440],
                opacity: phase === "result" && battleConfig.winner !== battleConfig.right && !battleConfig.hasGoldCrash ? 0 : 1,
              }}
              transition={{
                x: { duration: slowMoActive ? 2 : 0.3, ease: "easeInOut" },
                scale: { duration: 0.4 },
                rotate: { duration: slowMoActive ? 3 : 0.3, repeat: phase !== "result" ? Infinity : 0, ease: "linear" },
                opacity: { duration: 0.5 },
              }}
            >
              <BeigomaSpinner 
                color={battleConfig.right} 
                isWinner={winnerRevealed && battleConfig.winner === battleConfig.right}
                glowing={phase === "gekiatsu" && prizeTier === "B"}
                fireEffect={fireIntensity > 0.5}
              />
            </motion.div>

            {/* 金ベーゴマ（S賞） */}
            {battleConfig.hasGoldCrash && (
              <motion.div
                className="absolute w-24 h-24 sm:w-28 sm:h-28"
                style={{ top: "50%", left: "50%" }}
                initial={{ x: "-50%", y: "-700%", scale: 2 }}
                animate={{
                  y: goldCrash ? "-50%" : "-700%",
                  scale: goldCrash ? (phase === "result" ? 1.8 : 1.4) : 2,
                  rotate: goldCrash ? [0, 2160] : 0,
                }}
                transition={{
                  y: { duration: 0.2, ease: [0.55, 0, 1, 0.45] },
                  scale: { duration: 0.5 },
                  rotate: { duration: 1.2, ease: "linear" },
                }}
              >
                <BeigomaSpinner 
                  color={BEIGOMA_COLORS.gold} 
                  isWinner={winnerRevealed}
                  glowing={goldCrash}
                  fireEffect={true}
                />
              </motion.div>
            )}

            {/* 爆発スパーク */}
            <AnimatePresence>
              {(phase === "battle" || phase === "climax" || phase === "gekiatsu") && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  {explosionSparks.map((spark) => (
                    <motion.div
                      key={spark.id}
                      className="absolute"
                      style={{
                        width: spark.size,
                        height: spark.size * 0.3,
                        background: phase === "climax" && battleConfig.hasGoldCrash
                          ? "linear-gradient(90deg, transparent, #FFD700, #FFA500, transparent)"
                          : "linear-gradient(90deg, transparent, #FF6600, #FFAA00, transparent)",
                        boxShadow: `0 0 ${spark.size}px ${battleConfig.hasGoldCrash ? "#FFD700" : "#FF6600"}`,
                        borderRadius: "50%",
                      }}
                      initial={{ x: 0, y: 0, opacity: 0, scale: 0, rotate: spark.angle }}
                      animate={{
                        x: Math.cos((spark.angle * Math.PI) / 180) * spark.distance,
                        y: Math.sin((spark.angle * Math.PI) / 180) * spark.distance,
                        opacity: [0, 1, 0.8, 0],
                        scale: [0, 1.5, 1, 0],
                      }}
                      transition={{
                        duration: phase === "climax" ? 0.6 : 0.4,
                        delay: spark.delay,
                        repeat: Infinity,
                        repeatDelay: 0.4,
                      }}
                    />
                  ))}
                </div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* 漢字「戦」表示 */}
        <AnimatePresence>
          {showKanji && (
            <motion.div
              initial={{ opacity: 0, scale: 4, rotate: -20 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-50"
            >
              <motion.span
                className="text-[120px] sm:text-[180px] font-black"
                style={{
                  color: "transparent",
                  backgroundImage: "linear-gradient(180deg, #FFD700 0%, #FF6600 50%, #FF3300 100%)",
                  backgroundClip: "text",
                  WebkitBackgroundClip: "text",
                  textShadow: "0 0 60px rgba(255,100,0,0.8), 0 0 120px rgba(255,50,0,0.6)",
                  filter: "drop-shadow(0 0 30px #FF6600)",
                }}
                animate={{
                  textShadow: [
                    "0 0 60px rgba(255,100,0,0.8), 0 0 120px rgba(255,50,0,0.6)",
                    "0 0 100px rgba(255,150,0,1), 0 0 200px rgba(255,100,0,0.8)",
                    "0 0 60px rgba(255,100,0,0.8), 0 0 120px rgba(255,50,0,0.6)",
                  ],
                }}
                transition={{ duration: 0.4, repeat: Infinity }}
              >
                {showKanji}
              </motion.span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 激熱テキスト */}
        <AnimatePresence>
          {showGekiatsu && (
            <motion.div
              initial={{ opacity: 0, y: 100, scale: 0.5 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 1.5 }}
              className="absolute inset-x-0 top-16 sm:top-20 flex justify-center pointer-events-none z-50"
            >
              <motion.div
                animate={{
                  scale: [1, 1.15, 1],
                  rotate: [-2, 2, -2],
                }}
                transition={{ duration: 0.3, repeat: Infinity }}
              >
                <span
                  className="text-5xl sm:text-7xl font-black tracking-wider"
                  style={{
                    color: "transparent",
                    backgroundImage: "linear-gradient(180deg, #FFFF00 0%, #FF6600 40%, #FF0000 100%)",
                    backgroundClip: "text",
                    WebkitBackgroundClip: "text",
                    filter: "drop-shadow(0 0 20px #FF3300) drop-shadow(0 0 40px #FF0000)",
                  }}
                >
                  激熱!!
                </span>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* RUSH表示（S賞） */}
        <AnimatePresence>
          {showRush && (
            <motion.div
              initial={{ opacity: 0, scale: 0, rotate: -30 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              className="absolute inset-x-0 top-12 sm:top-16 flex justify-center pointer-events-none z-50"
            >
              <motion.div
                animate={{
                  scale: [1, 1.1, 1],
                }}
                transition={{ duration: 0.5, repeat: Infinity }}
                className="relative"
              >
                {/* フェニックス風の装飾 */}
                <motion.div
                  className="absolute inset-0 -z-10"
                  animate={{
                    opacity: [0.5, 1, 0.5],
                    scale: [1, 1.2, 1],
                  }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                  style={{
                    background: "radial-gradient(ellipse at center, rgba(255,215,0,0.4) 0%, transparent 70%)",
                    filter: "blur(20px)",
                    transform: "scale(2)",
                  }}
                />
                <span
                  className="text-6xl sm:text-8xl font-black tracking-[0.2em]"
                  style={{
                    color: "transparent",
                    backgroundImage: "linear-gradient(180deg, #FFD700 0%, #FFA500 30%, #FF6600 60%, #FF3300 100%)",
                    backgroundClip: "text",
                    WebkitBackgroundClip: "text",
                    filter: "drop-shadow(0 0 30px #FFD700) drop-shadow(0 0 60px #FF6600)",
                  }}
                >
                  大RUSH
                </span>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* マスコット */}
        <AnimatePresence>
          {showMascot && (
            <motion.div
              initial={{ x: -100, opacity: 0, scale: 0.5 }}
              animate={{ 
                x: 0, 
                opacity: 1, 
                scale: mascotPose === "happy" ? 1.2 : 1,
                y: mascotPose === "excited" ? [0, -15, 0] : 
                   mascotPose === "sad" ? [0, 5, 0] : 0,
              }}
              exit={{ x: -100, opacity: 0 }}
              transition={{ 
                type: "spring", 
                stiffness: 300, 
                y: { duration: 0.4, repeat: mascotPose === "excited" ? Infinity : 0 },
              }}
              className="absolute bottom-20 left-4 z-50"
            >
              <div className="relative">
                <motion.div
                  animate={{
                    rotate: mascotPose === "excited" ? [-8, 8, -8] : 
                            mascotPose === "shocked" ? [-15, 15, -15, 15, 0] :
                            mascotPose === "happy" ? [0, -8, 0, 8, 0] : 0,
                  }}
                  transition={{
                    duration: mascotPose === "shocked" ? 0.25 : 0.5,
                    repeat: mascotPose === "excited" || mascotPose === "happy" ? Infinity : 0,
                  }}
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-4 shadow-xl"
                  style={{
                    borderColor: mascotPose === "happy" ? "#FFD700" : "rgba(255,255,255,0.3)",
                    boxShadow: mascotPose === "happy" 
                      ? "0 0 40px rgba(255, 215, 0, 0.8)" 
                      : "0 0 20px rgba(255, 100, 0, 0.5)",
                  }}
                >
                  <img src={mascotImage} alt="Mascot" className="w-full h-full object-cover" />
                </motion.div>
                
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-8 -right-2 bg-white rounded-full px-3 py-1 shadow-lg"
                >
                  <span className="text-lg font-bold">
                    {mascotPose === "excited" && "🔥"}
                    {mascotPose === "shocked" && "⁉️"}
                    {mascotPose === "happy" && "🎉"}
                    {mascotPose === "sad" && "💦"}
                    {mascotPose === "watching" && "👀"}
                  </span>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* フラッシュ */}
        <AnimatePresence>
          {showFlash && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.9 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-40"
              style={{
                background: battleConfig.hasGoldCrash && phase === "climax"
                  ? "radial-gradient(circle, #FFD700 0%, rgba(255,150,0,0.7) 40%, transparent 80%)"
                  : "radial-gradient(circle, #FF6600 0%, rgba(255,50,0,0.6) 40%, transparent 70%)",
              }}
            />
          )}
        </AnimatePresence>

        {/* 結果テキスト */}
        <AnimatePresence>
          {phase === "result" && winnerRevealed && !showRush && (
            <motion.div
              initial={{ opacity: 0, scale: 0.3, y: 80 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="absolute inset-x-0 top-12 sm:top-16 flex flex-col items-center z-60"
            >
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 0.6, repeat: Infinity }}
                className="text-center"
              >
                <p className="text-xs sm:text-sm font-bold text-orange-300/80 mb-1 tracking-[0.3em]">WINNER</p>
                <motion.p
                  className="text-4xl sm:text-6xl font-black tracking-wider"
                  style={{
                    color: battleConfig.winner.primary,
                    textShadow: `0 0 50px ${battleConfig.winner.glow}, 0 0 100px ${battleConfig.winner.glow}`,
                  }}
                >
                  {battleConfig.winnerName}
                </motion.p>
                
                {prizeTier === "miss" && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.5 }}
                    transition={{ delay: 0.4 }}
                    className="mt-4 text-sm text-white/40"
                  >
                    . . .
                  </motion.p>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* スローモーインジケーター */}
        <AnimatePresence>
          {slowMoActive && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-x-0 bottom-28 flex justify-center"
            >
              <motion.p
                animate={{ opacity: [0.2, 1, 0.2] }}
                transition={{ duration: 0.35, repeat: Infinity }}
                className="text-xl font-black text-orange-300/70 tracking-[1em]"
              >
                . . .
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* プレイ回数 */}
        <div className="absolute top-4 left-4 z-50">
          <div className="bg-black/80 backdrop-blur-sm rounded-lg px-3 py-2 border border-orange-500/30">
            <p className="text-orange-300/60 text-xs">DRAW</p>
            <p className="text-orange-100 text-lg sm:text-xl font-black">×{playCount}</p>
          </div>
        </div>

        {/* スキップ */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          whileHover={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          onClick={handleSkip}
          className="absolute bottom-6 right-6 px-4 py-2 bg-black/50 hover:bg-black/70 backdrop-blur-sm rounded-full text-orange-200 font-medium text-sm transition-colors z-[120] border border-orange-500/30"
        >
          SKIP →
        </motion.button>
      </motion.div>
    </AnimatePresence>
  );
}

// ベーゴマスピナー（炎エフェクト付き）
function BeigomaSpinner({ 
  color, 
  isWinner,
  glowing = false,
  fireEffect = false,
}: { 
  color: typeof BEIGOMA_COLORS.gold;
  isWinner: boolean;
  glowing?: boolean;
  fireEffect?: boolean;
}) {
  return (
    <div className="relative w-full h-full">
      {/* 炎オーラ */}
      {fireEffect && (
        <motion.div
          className="absolute inset-[-30%] rounded-full"
          style={{
            background: `radial-gradient(circle, ${color.primary}60 0%, ${color.glow} 40%, transparent 70%)`,
            filter: "blur(8px)",
          }}
          animate={{ 
            opacity: [0.4, 0.8, 0.4], 
            scale: [1, 1.2, 1],
            rotate: [0, 180, 360],
          }}
          transition={{ duration: 1, repeat: Infinity }}
        />
      )}
      
      {/* 勝者グロー */}
      {(isWinner || glowing) && (
        <motion.div
          className="absolute inset-[-35%] rounded-full blur-2xl"
          style={{ background: color.primary }}
          animate={{ 
            opacity: [0.4, 1, 0.4], 
            scale: [1, 1.5, 1] 
          }}
          transition={{ duration: 0.4, repeat: Infinity }}
        />
      )}
      
      {/* ベーゴマ本体 */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: color.gradient,
          boxShadow: `0 0 50px ${color.glow}, inset 0 0 30px rgba(0,0,0,0.4)`,
        }}
      >
        {/* 中心軸 */}
        <div
          className="absolute top-1/2 left-1/2 w-4 h-4 sm:w-5 sm:h-5 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background: `radial-gradient(circle, ${color.secondary} 0%, ${color.primary} 100%)`,
            boxShadow: "inset 0 2px 8px rgba(255,255,255,0.6)",
          }}
        />
        
        {/* スポーク */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
          <div
            key={angle}
            className="absolute top-1/2 left-1/2 w-0.5 h-8 sm:h-10 origin-bottom"
            style={{
              background: `linear-gradient(to top, ${color.secondary}90, transparent)`,
              transform: `translate(-50%, -100%) rotate(${angle}deg)`,
            }}
          />
        ))}
        
        {/* ハイライト */}
        <div
          className="absolute top-2 left-2 w-4 h-4 sm:w-5 sm:h-5 rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(255,255,255,0.7) 0%, transparent 70%)",
          }}
        />
      </div>
    </div>
  );
}

// ヘルパー
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
