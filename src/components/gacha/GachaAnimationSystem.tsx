import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { useEffect, useState, useMemo } from "react";

// ========== 可変パラメータ型定義 ==========
export type ColorTheme = "gold" | "red" | "blue" | "purple" | "green" | "neon" | "monochrome" | "rainbow";
export type IntensityLevel = 1 | 2 | 3 | 4 | 5;
export type CameraMotion = "zoomIn" | "shake" | "slowPan" | "orbit" | "impactZoom";
export type ParticleStyle = "spark" | "dust" | "confetti" | "lightning" | "rainbow";

interface GachaAnimationProps {
  isRainbow?: boolean; // S賞専用レインボー演出
  isPlaying: boolean;
  onComplete: () => void;
  colorTheme: ColorTheme;
  intensity: IntensityLevel;
  cameraMotion: CameraMotion;
  particleStyle: ParticleStyle;
  playCount: number;
}

// ========== カラーテーマ設定 ==========
const colorThemes: Record<ColorTheme, { 
  primary: string; 
  secondary: string; 
  glow: string;
  gradient: string;
  text: string;
}> = {
  gold: {
    primary: "rgb(255, 200, 50)",
    secondary: "rgb(255, 150, 0)",
    glow: "rgba(255, 200, 50, 0.8)",
    gradient: "from-yellow-400 via-amber-500 to-orange-500",
    text: "text-amber-400",
  },
  red: {
    primary: "rgb(255, 50, 80)",
    secondary: "rgb(200, 0, 50)",
    glow: "rgba(255, 50, 80, 0.8)",
    gradient: "from-red-400 via-rose-500 to-pink-500",
    text: "text-rose-400",
  },
  blue: {
    primary: "rgb(50, 150, 255)",
    secondary: "rgb(0, 100, 200)",
    glow: "rgba(50, 150, 255, 0.8)",
    gradient: "from-blue-400 via-cyan-500 to-teal-500",
    text: "text-cyan-400",
  },
  purple: {
    primary: "rgb(180, 100, 255)",
    secondary: "rgb(130, 50, 200)",
    glow: "rgba(180, 100, 255, 0.8)",
    gradient: "from-purple-400 via-violet-500 to-fuchsia-500",
    text: "text-violet-400",
  },
  green: {
    primary: "rgb(50, 255, 150)",
    secondary: "rgb(0, 200, 100)",
    glow: "rgba(50, 255, 150, 0.8)",
    gradient: "from-green-400 via-emerald-500 to-teal-500",
    text: "text-emerald-400",
  },
  neon: {
    primary: "rgb(255, 50, 255)",
    secondary: "rgb(50, 255, 255)",
    glow: "rgba(255, 50, 255, 0.8)",
    gradient: "from-pink-500 via-purple-500 to-cyan-400",
    text: "text-pink-400",
  },
  monochrome: {
    primary: "rgb(200, 200, 200)",
    secondary: "rgb(100, 100, 100)",
    glow: "rgba(200, 200, 200, 0.6)",
    gradient: "from-gray-300 via-gray-500 to-gray-700",
    text: "text-gray-400",
  },
  rainbow: {
    primary: "rgb(255, 200, 50)",
    secondary: "rgb(255, 100, 150)",
    glow: "rgba(255, 200, 50, 0.8)",
    gradient: "from-red-500 via-yellow-500 to-green-500",
    text: "text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-yellow-400 to-cyan-400",
  },
};

// レインボーカラー配列（7色）
const RAINBOW_COLORS = [
  "rgb(255, 0, 0)",     // 赤
  "rgb(255, 127, 0)",   // オレンジ
  "rgb(255, 255, 0)",   // 黄
  "rgb(0, 255, 0)",     // 緑
  "rgb(0, 255, 255)",   // シアン
  "rgb(0, 127, 255)",   // 青
  "rgb(139, 0, 255)",   // 紫
];

// ========== 強度設定 ==========
const intensitySettings: Record<IntensityLevel, {
  glowStrength: number;
  shakeAmount: number;
  particleCount: number;
  flashCount: number;
  pulseScale: number;
}> = {
  1: { glowStrength: 0.3, shakeAmount: 2, particleCount: 10, flashCount: 1, pulseScale: 1.05 },
  2: { glowStrength: 0.5, shakeAmount: 5, particleCount: 20, flashCount: 2, pulseScale: 1.1 },
  3: { glowStrength: 0.7, shakeAmount: 8, particleCount: 35, flashCount: 3, pulseScale: 1.15 },
  4: { glowStrength: 0.85, shakeAmount: 12, particleCount: 50, flashCount: 4, pulseScale: 1.2 },
  5: { glowStrength: 1, shakeAmount: 18, particleCount: 80, flashCount: 6, pulseScale: 1.3 },
};

// ========== フェーズタイミング（6秒尺） ==========
const PHASE = {
  INTRO: { start: 0, end: 1.2 },      // 導入
  ANTICIPATION: { start: 1.2, end: 3.5 }, // 期待煽り
  RESULT: { start: 3.5, end: 5.0 },   // 結果確定
  AFTERGLOW: { start: 5.0, end: 6.0 }, // 余韻
};

export function GachaAnimationSystem({
  isPlaying,
  onComplete,
  colorTheme,
  intensity,
  cameraMotion,
  particleStyle,
  playCount,
  isRainbow = false,
}: GachaAnimationProps) {
  const [phase, setPhase] = useState<"intro" | "anticipation" | "result" | "afterglow">("intro");
  const [showFlash, setShowFlash] = useState(false);
  const [rainbowIndex, setRainbowIndex] = useState(0);
  const theme = colorThemes[colorTheme];
  const settings = intensitySettings[intensity];
  const controls = useAnimation();

  // レインボー色循環（S賞演出用）
  useEffect(() => {
    if (!isRainbow || !isPlaying) return;
    const interval = setInterval(() => {
      setRainbowIndex((prev) => (prev + 1) % RAINBOW_COLORS.length);
    }, 100);
    return () => clearInterval(interval);
  }, [isRainbow, isPlaying]);

  // パーティクル生成
  const particles = useMemo(() => {
    return Array.from({ length: settings.particleCount }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 8 + 4,
      delay: Math.random() * 2,
      duration: Math.random() * 2 + 1,
    }));
  }, [settings.particleCount]);

  // フェーズ管理タイマー
  useEffect(() => {
    if (!isPlaying) return;

    setPhase("intro");

    const timers = [
      setTimeout(() => setPhase("anticipation"), PHASE.INTRO.end * 1000),
      setTimeout(() => {
        setPhase("result");
        // フラッシュ演出
        for (let i = 0; i < settings.flashCount; i++) {
          setTimeout(() => {
            setShowFlash(true);
            setTimeout(() => setShowFlash(false), 80);
          }, i * 150);
        }
      }, PHASE.ANTICIPATION.end * 1000),
      setTimeout(() => setPhase("afterglow"), PHASE.RESULT.end * 1000),
      setTimeout(() => onComplete(), PHASE.AFTERGLOW.end * 1000),
    ];

    return () => timers.forEach(clearTimeout);
  }, [isPlaying, settings.flashCount, onComplete]);

  // カメラモーション
  const getCameraAnimation = () => {
    const shake = settings.shakeAmount;
    switch (cameraMotion) {
      case "zoomIn":
        return {
          scale: phase === "intro" ? 1 : phase === "anticipation" ? 1.1 : phase === "result" ? 1.3 : 1.15,
        };
      case "shake":
        return {
          x: phase === "result" ? [0, -shake, shake, -shake/2, shake/2, 0] : 0,
          y: phase === "result" ? [0, shake/2, -shake, shake, -shake/2, 0] : 0,
        };
      case "slowPan":
        return {
          y: phase === "intro" ? 20 : phase === "anticipation" ? 0 : -10,
        };
      case "orbit":
        return {
          rotateZ: phase === "anticipation" ? [0, 2, -2, 0] : 0,
        };
      case "impactZoom":
        return {
          scale: phase === "result" ? [1, 1.5, 1.2] : 1,
        };
      default:
        return {};
    }
  };

  // パーティクルレンダリング
  const renderParticle = (p: typeof particles[0]) => {
    switch (particleStyle) {
      case "spark":
        return (
          <motion.div
            key={p.id}
            className="absolute rounded-full"
            style={{
              width: p.size,
              height: p.size,
              background: `radial-gradient(circle, ${theme.primary} 0%, transparent 70%)`,
              boxShadow: `0 0 ${p.size * 2}px ${theme.glow}`,
            }}
            initial={{ x: "50%", y: "50%", opacity: 0, scale: 0 }}
            animate={{
              x: `${p.x}%`,
              y: `${p.y}%`,
              opacity: [0, 1, 1, 0],
              scale: [0, 1, 1.2, 0],
            }}
            transition={{
              duration: p.duration,
              delay: p.delay,
              repeat: Infinity,
              repeatDelay: 0.5,
            }}
          />
        );
      case "dust":
        return (
          <motion.div
            key={p.id}
            className="absolute rounded-full opacity-60"
            style={{
              width: p.size / 2,
              height: p.size / 2,
              background: theme.primary,
            }}
            initial={{ x: `${p.x}%`, y: "110%", opacity: 0 }}
            animate={{
              y: "-10%",
              opacity: [0, 0.6, 0.6, 0],
            }}
            transition={{
              duration: p.duration * 3,
              delay: p.delay,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        );
      case "confetti":
        const colors = [theme.primary, theme.secondary, "#fff"];
        return (
          <motion.div
            key={p.id}
            className="absolute"
            style={{
              width: p.size,
              height: p.size * 1.5,
              background: colors[p.id % 3],
              borderRadius: 2,
            }}
            initial={{ x: `${p.x}%`, y: "-10%", rotateZ: 0, opacity: 0 }}
            animate={{
              y: "110%",
              rotateZ: 360 * (p.id % 2 === 0 ? 1 : -1),
              opacity: phase === "result" || phase === "afterglow" ? [0, 1, 1, 0] : 0,
            }}
            transition={{
              duration: p.duration * 2,
              delay: p.delay * 0.5,
              repeat: Infinity,
            }}
          />
        );
      case "lightning":
        return (
          <motion.div
            key={p.id}
            className="absolute"
            style={{
              width: 2,
              height: p.size * 10,
              background: `linear-gradient(to bottom, transparent, ${theme.primary}, transparent)`,
              filter: `blur(1px)`,
            }}
            initial={{ x: `${p.x}%`, y: `${p.y}%`, opacity: 0, scaleY: 0 }}
            animate={{
              opacity: phase === "anticipation" || phase === "result" ? [0, 1, 0] : 0,
              scaleY: [0, 1, 0],
            }}
            transition={{
              duration: 0.2,
              delay: p.delay * 2,
              repeat: Infinity,
              repeatDelay: p.duration,
            }}
          />
        );
      case "rainbow":
        // S賞専用レインボーパーティクル
        const rainbowColor = RAINBOW_COLORS[p.id % RAINBOW_COLORS.length];
        return (
          <motion.div
            key={p.id}
            className="absolute"
            style={{
              width: p.size * 1.5,
              height: p.size * 1.5,
              background: rainbowColor,
              borderRadius: "50%",
              boxShadow: `0 0 ${p.size * 3}px ${rainbowColor}`,
            }}
            initial={{ x: "50%", y: "50%", opacity: 0, scale: 0 }}
            animate={{
              x: `${p.x}%`,
              y: `${p.y}%`,
              opacity: [0, 1, 1, 0],
              scale: [0, 1.5, 2, 0],
              rotate: [0, 180, 360],
            }}
            transition={{
              duration: p.duration * 1.5,
              delay: p.delay * 0.3,
              repeat: Infinity,
              repeatDelay: 0.2,
            }}
          />
        );
    }
  };

  if (!isPlaying) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[110] overflow-hidden"
        style={{ background: "linear-gradient(to bottom, #0a0a0a, #1a1a2e)" }}
      >
        {/* フラッシュエフェクト（レインボー対応） */}
        <AnimatePresence>
          {showFlash && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: settings.glowStrength }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50"
              style={{ 
                background: isRainbow 
                  ? `linear-gradient(135deg, ${RAINBOW_COLORS.join(", ")})`
                  : theme.primary 
              }}
            />
          )}
        </AnimatePresence>

        {/* レインボー背景グロー（S賞専用） */}
        {isRainbow && (phase === "result" || phase === "afterglow") && (
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            style={{
              background: `conic-gradient(from ${rainbowIndex * 51}deg at 50% 50%, ${RAINBOW_COLORS.join(", ")}, ${RAINBOW_COLORS[0]})`,
              filter: "blur(60px)",
            }}
          />
        )}

        {/* 背景グロー */}
        <motion.div
          className="absolute inset-0"
          animate={{
            opacity: phase === "intro" ? 0.2 : phase === "anticipation" ? 0.4 : phase === "result" ? settings.glowStrength : 0.3,
          }}
          transition={{ duration: 0.5 }}
          style={{
            background: isRainbow && phase === "result"
              ? `radial-gradient(circle at center, ${RAINBOW_COLORS[rainbowIndex]} 0%, transparent 60%)`
              : `radial-gradient(circle at center, ${theme.glow} 0%, transparent 60%)`,
          }}
        />

        {/* レインボーリング（S賞専用） */}
        {isRainbow && (phase === "anticipation" || phase === "result" || phase === "afterglow") && (
          <>
            {RAINBOW_COLORS.map((color, i) => (
              <motion.div
                key={`rainbow-ring-${i}`}
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{
                  width: 280 + i * 40,
                  height: 280 + i * 40,
                  border: `3px solid ${color}`,
                  boxShadow: `0 0 20px ${color}, inset 0 0 20px ${color}`,
                  opacity: phase === "result" ? 0.8 : 0.4,
                }}
                animate={{
                  rotate: i % 2 === 0 ? 360 : -360,
                  scale: phase === "result" ? [1, 1.1, 1] : 1,
                }}
                transition={{
                  rotate: { duration: 3 + i * 0.5, repeat: Infinity, ease: "linear" },
                  scale: { duration: 0.5, repeat: Infinity, repeatType: "reverse" },
                }}
              />
            ))}
          </>
        )}

        {/* 回転リング（期待煽り） */}
        {!isRainbow && (phase === "anticipation" || phase === "result") && (
          <>
            <motion.div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
              style={{ 
                width: 300, 
                height: 300, 
                borderColor: theme.primary,
                opacity: settings.glowStrength * 0.5,
              }}
              animate={{ rotate: 360, scale: [1, 1.1, 1] }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            />
            <motion.div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border"
              style={{ 
                width: 220, 
                height: 220, 
                borderColor: theme.secondary,
                opacity: settings.glowStrength * 0.4,
              }}
              animate={{ rotate: -360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            />
          </>
        )}

        {/* パーティクルレイヤー */}
        <div className="absolute inset-0 pointer-events-none">
          {particles.map(renderParticle)}
        </div>

        {/* メインコンテンツ（カメラモーション適用） */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          animate={getCameraAnimation()}
          transition={{ 
            type: phase === "result" ? "spring" : "tween",
            duration: phase === "result" ? 0.3 : 0.8,
            stiffness: 200,
          }}
        >
          {/* ガチャカプセル */}
          <motion.div
            className="relative"
            animate={{
              y: phase === "anticipation" ? [0, -15, 0] : 0,
              rotateZ: phase === "anticipation" ? [0, 5, -5, 0] : 0,
              scale: phase === "result" ? settings.pulseScale : 1,
            }}
            transition={{
              duration: phase === "anticipation" ? 0.4 : 0.3,
              repeat: phase === "anticipation" ? Infinity : 0,
            }}
          >
            {/* グロー効果（レインボー対応） */}
            {isRainbow ? (
              <motion.div
                className="absolute inset-0 rounded-full blur-3xl"
                animate={{
                  opacity: phase === "intro" ? 0.4 : phase === "result" ? 1 : 0.6,
                  scale: phase === "result" ? 1.8 : 1,
                }}
                style={{ 
                  width: 200, 
                  height: 200, 
                  margin: -25,
                  background: `conic-gradient(from ${rainbowIndex * 51}deg, ${RAINBOW_COLORS.join(", ")}, ${RAINBOW_COLORS[0]})`,
                }}
              />
            ) : (
              <motion.div
                className={`absolute inset-0 rounded-full blur-3xl bg-gradient-to-br ${theme.gradient}`}
                animate={{
                  opacity: phase === "intro" ? 0.3 : phase === "result" ? settings.glowStrength : 0.5,
                  scale: phase === "result" ? 1.5 : 1,
                }}
                style={{ width: 200, height: 200, margin: -25 }}
              />
            )}

            {/* カプセル本体（レインボー対応） */}
            <motion.div
              className="relative w-36 h-36 rounded-full flex items-center justify-center overflow-hidden"
              style={{
                background: isRainbow 
                  ? `conic-gradient(from ${rainbowIndex * 51}deg, ${RAINBOW_COLORS.join(", ")}, ${RAINBOW_COLORS[0]})`
                  : undefined,
                boxShadow: isRainbow
                  ? `0 0 50px ${RAINBOW_COLORS[rainbowIndex]}, 0 0 100px ${RAINBOW_COLORS[(rainbowIndex + 2) % 7]}, inset 0 -20px 40px rgba(0,0,0,0.3)`
                  : `0 0 ${30 * settings.glowStrength}px ${theme.glow}, inset 0 -20px 40px rgba(0,0,0,0.3)`,
              }}
            >
              {/* 通常時のグラデーション背景 */}
              {!isRainbow && (
                <div className={`absolute inset-0 bg-gradient-to-br ${theme.gradient}`} />
              )}
              
              {/* 光沢 */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent skew-x-12"
                animate={{ x: ["-200%", "200%"] }}
                transition={{
                  duration: isRainbow ? 0.8 : 1.5,
                  repeat: Infinity,
                  repeatDelay: phase === "result" ? 0 : isRainbow ? 0.2 : 2,
                }}
              />
              
              {/* 上部ハイライト */}
              <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/40 to-transparent rounded-t-full" />
              
              {/* 中央ライン */}
              <div className="absolute left-0 right-0 h-2 bg-gradient-to-r from-gray-800 via-gray-500 to-gray-800 top-1/2 -translate-y-1/2" />
              
              {/* プレイ回数 */}
              <motion.span
                className="relative z-10 text-3xl font-black text-white drop-shadow-lg"
                animate={{ 
                  scale: phase === "result" ? [1, 1.3, 1] : 1,
                }}
                transition={{ duration: 0.3 }}
                style={{
                  textShadow: isRainbow ? `0 0 20px ${RAINBOW_COLORS[rainbowIndex]}` : undefined,
                }}
              >
                ×{playCount}
              </motion.span>
            </motion.div>
          </motion.div>
        </motion.div>

        {/* テキスト演出 */}
        <div className="absolute inset-x-0 bottom-1/4 flex flex-col items-center">
          <AnimatePresence mode="wait">
            {phase === "anticipation" && (
              <motion.p
                key="anticipation-text"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: [0.5, 1, 0.5], y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.8, repeat: Infinity }}
                className={`text-2xl font-bold ${theme.text}`}
              >
                ...
              </motion.p>
            )}
            {phase === "result" && intensity >= 4 && (
              <motion.p
                key="result-text"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: [1, 1.1, 1] }}
                exit={{ opacity: 0 }}
                className={`text-4xl font-black ${isRainbow ? "" : theme.text}`}
                style={{
                  textShadow: isRainbow 
                    ? `0 0 20px ${RAINBOW_COLORS[rainbowIndex]}, 0 0 40px ${RAINBOW_COLORS[(rainbowIndex + 3) % 7]}, 0 0 60px ${RAINBOW_COLORS[(rainbowIndex + 5) % 7]}`
                    : `0 0 20px ${theme.glow}, 0 0 40px ${theme.glow}`,
                  color: isRainbow ? RAINBOW_COLORS[rainbowIndex] : undefined,
                }}
              >
                {isRainbow ? "★S★" : intensity === 5 ? "!?" : "!"}
              </motion.p>
            )}
            {phase === "afterglow" && (
              <motion.p
                key="afterglow-text"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xl font-bold text-white/80"
              >
                RESULT
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* フェーズインジケーター（デバッグ用、本番では非表示） */}
        {/* <div className="absolute top-4 left-4 text-white/50 text-xs">
          Phase: {phase} | Intensity: {intensity}
        </div> */}
      </motion.div>
    </AnimatePresence>
  );
}

// ========== ヘルパー: 賞に応じたパラメータ生成 ==========
export function getAnimationParamsForPrizeTier(
  prizeTier: string,
  playCount: number
): { colorTheme: ColorTheme; intensity: IntensityLevel; cameraMotion: CameraMotion; particleStyle: ParticleStyle; isRainbow: boolean } {
  switch (prizeTier) {
    case "S":
      return {
        colorTheme: "rainbow",
        intensity: 5,
        cameraMotion: "impactZoom",
        particleStyle: "rainbow",
        isRainbow: true,
      };
    case "A":
      return {
        colorTheme: "red",
        intensity: 4,
        cameraMotion: "shake",
        particleStyle: "spark",
        isRainbow: false,
      };
    case "B":
      return {
        colorTheme: "blue",
        intensity: 3,
        cameraMotion: "zoomIn",
        particleStyle: "dust",
        isRainbow: false,
      };
    default: // miss
      return {
        colorTheme: "monochrome",
        intensity: 1,
        cameraMotion: "slowPan",
        particleStyle: "dust",
        isRainbow: false,
      };
  }
}

// ========== ヘルパー: 最高賞を判定 ==========
export function getHighestPrizeTier(cards: { prizeTier: string }[]): string {
  const tierOrder = ["S", "A", "B", "miss"];
  let highest = "miss";
  for (const card of cards) {
    if (tierOrder.indexOf(card.prizeTier) < tierOrder.indexOf(highest)) {
      highest = card.prizeTier;
    }
  }
  return highest;
}
