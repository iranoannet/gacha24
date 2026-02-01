import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useMemo } from "react";
import { useGachaSound } from "@/hooks/useGachaSound";

interface BeigomaBattleAnimationProps {
  isPlaying: boolean;
  onComplete: () => void;
  onSkip?: () => void;
  prizeTier: "S" | "A" | "B" | "miss";
  playCount: number;
}

// 色設定: 金=S, 赤=A, 黒=B, 白=miss
const BEIGOMA_COLORS = {
  S: {
    primary: "#FFD700",
    secondary: "#FFA500",
    glow: "rgba(255, 215, 0, 0.8)",
    name: "GOLD",
    gradient: "from-yellow-400 via-amber-500 to-orange-400",
  },
  A: {
    primary: "#FF3B3B",
    secondary: "#CC0000",
    glow: "rgba(255, 59, 59, 0.8)",
    name: "RED",
    gradient: "from-red-500 via-rose-500 to-red-600",
  },
  B: {
    primary: "#1A1A1A",
    secondary: "#333333",
    glow: "rgba(100, 100, 100, 0.5)",
    name: "BLACK",
    gradient: "from-gray-800 via-gray-900 to-black",
  },
  miss: {
    primary: "#FFFFFF",
    secondary: "#DDDDDD",
    glow: "rgba(255, 255, 255, 0.6)",
    name: "WHITE",
    gradient: "from-white via-gray-100 to-gray-200",
  },
};

// フェーズタイミング（8秒尺）
const PHASE = {
  INTRO: { start: 0, end: 1.5 },       // 導入・ベーゴマ登場
  BATTLE: { start: 1.5, end: 5.5 },    // 対決・衝突
  CLIMAX: { start: 5.5, end: 7.0 },    // クライマックス・煽り
  RESULT: { start: 7.0, end: 8.5 },    // 結果発表
};

export function BeigomaBattleAnimation({
  isPlaying,
  onComplete,
  onSkip,
  prizeTier,
  playCount,
}: BeigomaBattleAnimationProps) {
  const [phase, setPhase] = useState<"intro" | "battle" | "climax" | "result">("intro");
  const [showFlash, setShowFlash] = useState(false);
  const [collisionCount, setCollisionCount] = useState(0);
  const [winnerRevealed, setWinnerRevealed] = useState(false);
  const sound = useGachaSound();

  const winnerColor = BEIGOMA_COLORS[prizeTier];
  
  // 対戦相手のベーゴマ色（ランダムに選択、勝者以外）
  const opponentColor = useMemo(() => {
    const opponents = Object.entries(BEIGOMA_COLORS).filter(([key]) => key !== prizeTier);
    const randomIndex = Math.floor(Math.random() * opponents.length);
    return opponents[randomIndex][1];
  }, [prizeTier]);

  // スパークパーティクル
  const sparks = useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => ({
      id: i,
      angle: (i / 30) * 360,
      distance: 50 + Math.random() * 100,
      size: 3 + Math.random() * 6,
      delay: Math.random() * 0.3,
    }));
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

  // フェーズ管理
  useEffect(() => {
    if (!isPlaying) return;

    setPhase("intro");
    setCollisionCount(0);
    setWinnerRevealed(false);
    
    // イントロサウンド
    sound.playSlotSpin();

    const timers = [
      // バトルフェーズ
      setTimeout(() => {
        setPhase("battle");
        sound.playDrumRoll(PHASE.BATTLE.end - PHASE.BATTLE.start);
      }, PHASE.INTRO.end * 1000),
      
      // 衝突エフェクト（複数回）
      ...Array.from({ length: 5 }, (_, i) => 
        setTimeout(() => {
          setCollisionCount(prev => prev + 1);
          setShowFlash(true);
          sound.playImpact();
          setTimeout(() => setShowFlash(false), 100);
        }, (PHASE.BATTLE.start + 0.8 * (i + 1)) * 1000)
      ),
      
      // クライマックスフェーズ
      setTimeout(() => {
        setPhase("climax");
        sound.playHeartbeat(prizeTier === "S" ? 5 : prizeTier === "A" ? 4 : 2);
      }, PHASE.CLIMAX.start * 1000),
      
      // 結果フェーズ
      setTimeout(() => {
        setPhase("result");
        setWinnerRevealed(true);
        setShowFlash(true);
        
        // 賞に応じたサウンド
        if (prizeTier === "S") {
          sound.playJackpot();
        } else if (prizeTier === "A") {
          sound.playReveal(true);
          sound.playCoinSound(5);
        } else if (prizeTier === "B") {
          sound.playReveal(false);
        } else {
          sound.playMiss();
        }
        
        setTimeout(() => setShowFlash(false), 200);
      }, PHASE.RESULT.start * 1000),
      
      // 完了
      setTimeout(() => onComplete(), PHASE.RESULT.end * 1000),
    ];

    return () => timers.forEach(clearTimeout);
  }, [isPlaying, prizeTier, onComplete, sound]);

  if (!isPlaying) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[110] overflow-hidden"
        style={{ background: "radial-gradient(circle at center, #1a1a2e 0%, #0a0a0a 100%)" }}
      >
        {/* フラッシュエフェクト */}
        <AnimatePresence>
          {showFlash && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.8 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50"
              style={{ 
                background: phase === "result" 
                  ? `radial-gradient(circle, ${winnerColor.primary} 0%, transparent 70%)` 
                  : "white" 
              }}
            />
          )}
        </AnimatePresence>

        {/* バトルアリーナ（円形ステージ） */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            className="relative w-80 h-80 rounded-full border-4 border-amber-600/50"
            style={{
              background: "radial-gradient(circle, #2a2a3e 0%, #1a1a2e 70%, #0a0a1e 100%)",
              boxShadow: "inset 0 0 60px rgba(0,0,0,0.8), 0 0 40px rgba(255,165,0,0.2)",
            }}
            animate={{
              scale: phase === "climax" ? [1, 1.02, 1] : 1,
              boxShadow: phase === "result" 
                ? `inset 0 0 60px rgba(0,0,0,0.8), 0 0 80px ${winnerColor.glow}`
                : "inset 0 0 60px rgba(0,0,0,0.8), 0 0 40px rgba(255,165,0,0.2)",
            }}
            transition={{ duration: 0.3, repeat: phase === "climax" ? Infinity : 0 }}
          >
            {/* ステージライン（同心円） */}
            {[0.3, 0.6, 0.9].map((scale, i) => (
              <motion.div
                key={i}
                className="absolute inset-0 rounded-full border border-amber-600/20"
                style={{ transform: `scale(${scale})` }}
              />
            ))}

            {/* 左のベーゴマ（プレイヤー） */}
            <motion.div
              className="absolute w-20 h-20"
              style={{
                top: "50%",
                left: "50%",
              }}
              initial={{ x: "-200%", y: "-50%", rotate: 0 }}
              animate={{
                x: phase === "intro" ? "-150%" : 
                   phase === "battle" ? ["-100%", "-70%", "-100%", "-60%", "-90%"] :
                   phase === "climax" ? ["-80%", "-60%", "-80%"] :
                   winnerRevealed && prizeTier !== "S" && prizeTier !== "A" && prizeTier !== "B" ? "-200%" : "-50%",
                y: "-50%",
                rotate: phase === "result" && winnerRevealed ? 0 : [0, 360, 720, 1080, 1440],
                scale: phase === "result" && winnerRevealed && (prizeTier === "S" || prizeTier === "A" || prizeTier === "B") ? 1.5 : 1,
              }}
              transition={{
                x: { duration: phase === "battle" ? 4 : phase === "climax" ? 1.5 : 0.5, ease: "easeInOut" },
                rotate: { duration: 0.5, repeat: phase !== "result" ? Infinity : 0, ease: "linear" },
                scale: { duration: 0.5 },
              }}
            >
              <Beigoma color={winnerColor} isWinner={winnerRevealed && prizeTier !== "miss"} />
            </motion.div>

            {/* 右のベーゴマ（対戦相手） */}
            <motion.div
              className="absolute w-20 h-20"
              style={{
                top: "50%",
                left: "50%",
              }}
              initial={{ x: "100%", y: "-50%", rotate: 0 }}
              animate={{
                x: phase === "intro" ? "50%" :
                   phase === "battle" ? ["0%", "30%", "0%", "40%", "10%"] :
                   phase === "climax" ? ["20%", "0%", "20%"] :
                   winnerRevealed && prizeTier === "miss" ? "-50%" : "200%",
                y: "-50%",
                rotate: phase === "result" && winnerRevealed ? 0 : [0, -360, -720, -1080, -1440],
                scale: phase === "result" && winnerRevealed && prizeTier === "miss" ? 1.5 : 1,
              }}
              transition={{
                x: { duration: phase === "battle" ? 4 : phase === "climax" ? 1.5 : 0.5, ease: "easeInOut" },
                rotate: { duration: 0.5, repeat: phase !== "result" ? Infinity : 0, ease: "linear" },
                scale: { duration: 0.5 },
              }}
            >
              <Beigoma color={opponentColor} isWinner={winnerRevealed && prizeTier === "miss"} />
            </motion.div>

            {/* 衝突スパーク */}
            {(phase === "battle" || phase === "climax") && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                {sparks.map((spark) => (
                  <motion.div
                    key={spark.id}
                    className="absolute w-1 h-1 rounded-full bg-yellow-400"
                    style={{
                      boxShadow: "0 0 10px #FFD700, 0 0 20px #FFA500",
                    }}
                    initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
                    animate={{
                      x: Math.cos((spark.angle * Math.PI) / 180) * spark.distance,
                      y: Math.sin((spark.angle * Math.PI) / 180) * spark.distance,
                      opacity: [0, 1, 0],
                      scale: [0, spark.size / 3, 0],
                    }}
                    transition={{
                      duration: 0.6,
                      delay: spark.delay + (collisionCount % 5) * 0.1,
                      repeat: Infinity,
                      repeatDelay: 0.8,
                    }}
                  />
                ))}
              </div>
            )}
          </motion.div>
        </div>

        {/* 結果表示 */}
        {phase === "result" && winnerRevealed && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="absolute inset-x-0 top-20 flex flex-col items-center"
          >
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 0.5, repeat: Infinity }}
              className="text-center"
            >
              <p className="text-lg font-bold text-white/70 mb-2">WINNER</p>
              <p
                className="text-5xl font-black"
                style={{
                  color: winnerColor.primary,
                  textShadow: `0 0 30px ${winnerColor.glow}, 0 0 60px ${winnerColor.glow}`,
                }}
              >
                {winnerColor.name}
              </p>
              {prizeTier === "S" && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-3xl font-black mt-4 text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500"
                >
                  ★ JACKPOT ★
                </motion.p>
              )}
            </motion.div>
          </motion.div>
        )}

        {/* 煽りテキスト */}
        {phase === "climax" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 0.5, repeat: Infinity }}
            className="absolute inset-x-0 bottom-32 flex justify-center"
          >
            <p className="text-4xl font-black text-white tracking-widest">
              ⚡ CLASH ⚡
            </p>
          </motion.div>
        )}

        {/* プレイ回数表示 */}
        <div className="absolute top-6 left-6">
          <div className="bg-black/50 backdrop-blur-sm rounded-lg px-4 py-2 border border-white/20">
            <p className="text-white/60 text-sm">DRAW</p>
            <p className="text-white text-2xl font-black">×{playCount}</p>
          </div>
        </div>

        {/* フェーズインジケーター */}
        <div className="absolute top-6 right-6">
          <div className="flex gap-2">
            {["intro", "battle", "climax", "result"].map((p, i) => (
              <motion.div
                key={p}
                className={`w-3 h-3 rounded-full ${
                  phase === p ? "bg-amber-400" : "bg-white/20"
                }`}
                animate={{
                  scale: phase === p ? [1, 1.3, 1] : 1,
                }}
                transition={{ duration: 0.5, repeat: phase === p ? Infinity : 0 }}
              />
            ))}
          </div>
        </div>

        {/* スキップボタン */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          onClick={(e) => {
            e.stopPropagation();
            handleSkip();
          }}
          className="absolute bottom-8 right-8 px-6 py-3 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full text-white font-bold text-sm transition-colors z-[120] cursor-pointer border border-white/30"
          style={{ pointerEvents: "auto" }}
        >
          スキップ →
        </motion.button>
      </motion.div>
    </AnimatePresence>
  );
}

// ベーゴマコンポーネント
function Beigoma({ color, isWinner }: { color: typeof BEIGOMA_COLORS.S; isWinner: boolean }) {
  return (
    <div className="relative w-full h-full">
      {/* グロー */}
      {isWinner && (
        <motion.div
          className="absolute inset-0 rounded-full blur-xl"
          style={{ background: color.primary }}
          animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.3, 1] }}
          transition={{ duration: 0.8, repeat: Infinity }}
        />
      )}
      
      {/* ベーゴマ本体（上から見た図） */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(from 0deg, ${color.primary}, ${color.secondary}, ${color.primary})`,
          boxShadow: `0 0 20px ${color.glow}, inset 0 0 15px rgba(0,0,0,0.5)`,
        }}
      >
        {/* 中心部 */}
        <div
          className="absolute top-1/2 left-1/2 w-6 h-6 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background: `radial-gradient(circle, ${color.secondary} 0%, ${color.primary} 100%)`,
            boxShadow: "inset 0 2px 4px rgba(255,255,255,0.3)",
          }}
        />
        
        {/* スポーク（模様） */}
        {[0, 60, 120, 180, 240, 300].map((angle) => (
          <div
            key={angle}
            className="absolute top-1/2 left-1/2 w-1 h-8 origin-bottom"
            style={{
              background: `linear-gradient(to top, ${color.secondary}, transparent)`,
              transform: `translate(-50%, -100%) rotate(${angle}deg)`,
            }}
          />
        ))}
        
        {/* ハイライト */}
        <div
          className="absolute top-2 left-2 w-4 h-4 rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(255,255,255,0.6) 0%, transparent 70%)",
          }}
        />
      </div>
    </div>
  );
}

// ヘルパー: 賞に応じたパラメータ生成
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
