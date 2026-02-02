import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { 
  Environment, 
  Float, 
  Sparkles, 
  Trail,
  MeshDistortMaterial,
  MeshWobbleMaterial,
  Stars,
  Text3D,
  Center,
  useTexture,
} from "@react-three/drei";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useRef, useMemo, Suspense } from "react";
import * as THREE from "three";
import { useGachaSound } from "@/hooks/useGachaSound";

interface Beigoma3DAnimationProps {
  isPlaying: boolean;
  onComplete: () => void;
  onSkip?: () => void;
  playCount: number;
}

// 演出タイミング
const TIMING = {
  INTRO: 0,
  BATTLE: 1.5,
  COLLISION: 3.0,
  SLOWMO: 5.0,
  GOLD_CRASH: 6.0,
  EXPLOSION: 6.5,
  RESULT: 7.5,
  END: 10.0,
};

export function Beigoma3DAnimation({
  isPlaying,
  onComplete,
  onSkip,
  playCount,
}: Beigoma3DAnimationProps) {
  const [phase, setPhase] = useState<"intro" | "battle" | "slowmo" | "crash" | "explosion" | "result">("intro");
  const [showKanji, setShowKanji] = useState(false);
  const [showRush, setShowRush] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const sound = useGachaSound();

  const handleSkip = () => {
    sound.stopAll();
    onSkip ? onSkip() : onComplete();
  };

  useEffect(() => {
    if (!isPlaying) return;

    setPhase("intro");
    setShowKanji(false);
    setShowRush(false);

    const timers: NodeJS.Timeout[] = [];

    // イントロ
    sound.playPachinkoReach(2);

    // 戦表示
    timers.push(setTimeout(() => {
      setShowKanji(true);
      setShowFlash(true);
      setTimeout(() => setShowFlash(false), 200);
    }, 800));

    // バトル開始
    timers.push(setTimeout(() => {
      setPhase("battle");
      setShowKanji(false);
      sound.playTaikoDrumRoll(3);
    }, TIMING.BATTLE * 1000));

    // 衝突
    timers.push(setTimeout(() => {
      sound.playMetalClash();
      setShowFlash(true);
      setTimeout(() => setShowFlash(false), 150);
    }, TIMING.COLLISION * 1000));

    timers.push(setTimeout(() => {
      sound.playMetalClash();
    }, (TIMING.COLLISION + 0.8) * 1000));

    // スローモー
    timers.push(setTimeout(() => {
      setPhase("slowmo");
      sound.playHeartbeat(3);
    }, TIMING.SLOWMO * 1000));

    // 金ベーゴマ落下
    timers.push(setTimeout(() => {
      setPhase("crash");
      sound.playThunder();
    }, TIMING.GOLD_CRASH * 1000));

    // 爆発
    timers.push(setTimeout(() => {
      setPhase("explosion");
      setShowFlash(true);
      setTimeout(() => setShowFlash(false), 400);
      sound.playJackpot();
      setShowRush(true);
    }, TIMING.EXPLOSION * 1000));

    // 結果
    timers.push(setTimeout(() => {
      setPhase("result");
      sound.playCoinSound(15);
    }, TIMING.RESULT * 1000));

    // 完了
    timers.push(setTimeout(onComplete, TIMING.END * 1000));

    return () => timers.forEach(clearTimeout);
  }, [isPlaying, onComplete, sound]);

  if (!isPlaying) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[110] bg-black"
      >
        {/* 3Dキャンバス */}
        <Canvas
          camera={{ position: [0, 8, 12], fov: 50 }}
          gl={{ antialias: true, alpha: true }}
          dpr={[1, 2]}
        >
          <Suspense fallback={null}>
            <Scene phase={phase} />
          </Suspense>
        </Canvas>

        {/* フラッシュオーバーレイ */}
        <AnimatePresence>
          {showFlash && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.9 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-20 pointer-events-none"
              style={{
                background: phase === "explosion"
                  ? "radial-gradient(circle, #FFD700 0%, rgba(255,150,0,0.8) 40%, transparent 80%)"
                  : "radial-gradient(circle, white 0%, transparent 60%)",
              }}
            />
          )}
        </AnimatePresence>

        {/* 漢字「戦」 */}
        <AnimatePresence>
          {showKanji && (
            <motion.div
              initial={{ opacity: 0, scale: 5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.25 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-30"
            >
              <span
                className="text-[150px] sm:text-[200px] font-black"
                style={{
                  color: "transparent",
                  backgroundImage: "linear-gradient(180deg, #FFD700 0%, #FF6600 50%, #FF3300 100%)",
                  backgroundClip: "text",
                  WebkitBackgroundClip: "text",
                  filter: "drop-shadow(0 0 40px #FF6600) drop-shadow(0 0 80px #FF3300)",
                }}
              >
                戦
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 大RUSH */}
        <AnimatePresence>
          {showRush && (
            <motion.div
              initial={{ opacity: 0, scale: 0, rotate: -20 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              className="absolute inset-x-0 top-8 sm:top-12 flex justify-center pointer-events-none z-30"
            >
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 0.5, repeat: Infinity }}
              >
                <span
                  className="text-5xl sm:text-7xl font-black tracking-[0.15em]"
                  style={{
                    color: "transparent",
                    backgroundImage: "linear-gradient(180deg, #FFD700 0%, #FFA500 30%, #FF6600 70%, #FF3300 100%)",
                    backgroundClip: "text",
                    WebkitBackgroundClip: "text",
                    filter: "drop-shadow(0 0 30px #FFD700) drop-shadow(0 0 60px #FF6600)",
                  }}
                >
                  ★ 大RUSH ★
                </span>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* JACKPOT表示 */}
        <AnimatePresence>
          {phase === "result" && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute inset-x-0 bottom-32 flex flex-col items-center pointer-events-none z-30"
            >
              <motion.p
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ duration: 0.6, repeat: Infinity }}
                className="text-4xl sm:text-6xl font-black"
                style={{
                  color: "#FFD700",
                  textShadow: "0 0 40px rgba(255,215,0,0.9), 0 0 80px rgba(255,165,0,0.7)",
                }}
              >
                JACKPOT!!
              </motion.p>
              <p className="text-lg text-orange-300/80 mt-2">S賞確定</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* プレイ回数 */}
        <div className="absolute top-4 left-4 z-30">
          <div className="bg-black/80 backdrop-blur-sm rounded-lg px-3 py-2 border border-orange-500/40">
            <p className="text-orange-300/60 text-xs">DRAW</p>
            <p className="text-orange-100 text-xl font-black">×{playCount}</p>
          </div>
        </div>

        {/* スキップ */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          whileHover={{ opacity: 1 }}
          transition={{ delay: 2 }}
          onClick={handleSkip}
          className="absolute bottom-6 right-6 px-4 py-2 bg-black/60 hover:bg-black/80 backdrop-blur-sm rounded-full text-orange-200 font-medium text-sm transition-colors z-30 border border-orange-500/30"
        >
          SKIP →
        </motion.button>
      </motion.div>
    </AnimatePresence>
  );
}

// 3Dシーン
function Scene({ phase }: { phase: string }) {
  return (
    <>
      {/* 照明 */}
      <ambientLight intensity={0.3} />
      <pointLight position={[10, 10, 10]} intensity={1} color="#FF6600" />
      <pointLight position={[-10, 10, -10]} intensity={0.5} color="#FFD700" />
      <spotLight
        position={[0, 20, 0]}
        angle={0.3}
        penumbra={1}
        intensity={phase === "explosion" || phase === "result" ? 3 : 1}
        color={phase === "explosion" || phase === "result" ? "#FFD700" : "#FF4400"}
      />

      {/* 背景スター */}
      <Stars radius={100} depth={50} count={3000} factor={4} fade speed={2} />

      {/* アリーナ床 */}
      <Arena phase={phase} />

      {/* 赤ベーゴマ */}
      <RedBeigoma phase={phase} />

      {/* 黒ベーゴマ */}
      <BlackBeigoma phase={phase} />

      {/* 金ベーゴマ（クラッシュ時） */}
      <GoldBeigoma phase={phase} />

      {/* パーティクル */}
      <FireParticles phase={phase} />

      {/* カメラ制御 */}
      <CameraController phase={phase} />
    </>
  );
}

// アリーナ床
function Arena({ phase }: { phase: string }) {
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (ringRef.current) {
      ringRef.current.rotation.z += 0.005;
    }
  });

  return (
    <group position={[0, -0.5, 0]}>
      {/* メイン床 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[6, 64]} />
        <meshStandardMaterial
          color="#1a0a00"
          metalness={0.8}
          roughness={0.2}
          emissive="#FF3300"
          emissiveIntensity={phase === "explosion" || phase === "result" ? 0.3 : 0.1}
        />
      </mesh>

      {/* 炎リング */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[5, 5.5, 64]} />
        <meshBasicMaterial
          color={phase === "explosion" || phase === "result" ? "#FFD700" : "#FF4400"}
          transparent
          opacity={0.8}
        />
      </mesh>

      {/* 内側リング */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[3, 3.2, 64]} />
        <meshBasicMaterial color="#FF6600" transparent opacity={0.5} />
      </mesh>
    </group>
  );
}

// 赤ベーゴマ
function RedBeigoma({ phase }: { phase: string }) {
  const groupRef = useRef<THREE.Group>(null);
  const [position, setPosition] = useState<[number, number, number]>([-8, 1, 0]);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (phase === "intro") {
      setPosition([-4, 1, 0]);
      setVisible(true);
    } else if (phase === "battle") {
      setPosition([-1.5, 1, 0]);
    } else if (phase === "slowmo") {
      setPosition([-1, 1, 0]);
    } else if (phase === "crash" || phase === "explosion" || phase === "result") {
      setPosition([8, 1, 0]);
      setTimeout(() => setVisible(false), 300);
    }
  }, [phase]);

  useFrame(() => {
    if (groupRef.current && visible) {
      groupRef.current.rotation.y += phase === "slowmo" ? 0.05 : 0.3;
    }
  });

  if (!visible && (phase === "explosion" || phase === "result")) return null;

  return (
    <group ref={groupRef} position={position}>
      <Trail
        width={2}
        length={6}
        color="#FF3300"
        attenuation={(t) => t * t}
      >
        <Float speed={2} floatIntensity={0.5}>
          <mesh castShadow>
            <cylinderGeometry args={[0.8, 1, 0.5, 32]} />
            <MeshWobbleMaterial
              color="#FF2222"
              metalness={0.9}
              roughness={0.1}
              emissive="#FF0000"
              emissiveIntensity={0.3}
              factor={0.1}
              speed={2}
            />
          </mesh>
          {/* 中心軸 */}
          <mesh position={[0, -0.4, 0]}>
            <coneGeometry args={[0.15, 0.5, 16]} />
            <meshStandardMaterial color="#CC0000" metalness={1} roughness={0} />
          </mesh>
        </Float>
      </Trail>
    </group>
  );
}

// 黒ベーゴマ
function BlackBeigoma({ phase }: { phase: string }) {
  const groupRef = useRef<THREE.Group>(null);
  const [position, setPosition] = useState<[number, number, number]>([8, 1, 0]);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (phase === "intro") {
      setPosition([4, 1, 0]);
      setVisible(true);
    } else if (phase === "battle") {
      setPosition([1.5, 1, 0]);
    } else if (phase === "slowmo") {
      setPosition([1, 1, 0]);
    } else if (phase === "crash" || phase === "explosion" || phase === "result") {
      setPosition([-8, 1, 0]);
      setTimeout(() => setVisible(false), 300);
    }
  }, [phase]);

  useFrame(() => {
    if (groupRef.current && visible) {
      groupRef.current.rotation.y -= phase === "slowmo" ? 0.05 : 0.3;
    }
  });

  if (!visible && (phase === "explosion" || phase === "result")) return null;

  return (
    <group ref={groupRef} position={position}>
      <Trail
        width={2}
        length={6}
        color="#444444"
        attenuation={(t) => t * t}
      >
        <Float speed={2} floatIntensity={0.5}>
          <mesh castShadow>
            <cylinderGeometry args={[0.8, 1, 0.5, 32]} />
            <MeshWobbleMaterial
              color="#1A1A1A"
              metalness={0.95}
              roughness={0.05}
              emissive="#333333"
              emissiveIntensity={0.2}
              factor={0.1}
              speed={2}
            />
          </mesh>
          <mesh position={[0, -0.4, 0]}>
            <coneGeometry args={[0.15, 0.5, 16]} />
            <meshStandardMaterial color="#000000" metalness={1} roughness={0} />
          </mesh>
        </Float>
      </Trail>
    </group>
  );
}

// 金ベーゴマ
function GoldBeigoma({ phase }: { phase: string }) {
  const groupRef = useRef<THREE.Group>(null);
  const [position, setPosition] = useState<[number, number, number]>([0, 20, 0]);

  useEffect(() => {
    if (phase === "crash") {
      setPosition([0, 1, 0]);
    } else if (phase === "explosion" || phase === "result") {
      setPosition([0, 1.5, 0]);
    }
  }, [phase]);

  useFrame(() => {
    if (groupRef.current && (phase === "crash" || phase === "explosion" || phase === "result")) {
      groupRef.current.rotation.y += phase === "result" ? 0.1 : 0.5;
    }
  });

  if (phase !== "crash" && phase !== "explosion" && phase !== "result") return null;

  return (
    <group ref={groupRef} position={position}>
      <Trail
        width={3}
        length={10}
        color="#FFD700"
        attenuation={(t) => t * t}
      >
        <Float speed={3} floatIntensity={phase === "result" ? 1 : 0.3}>
          <mesh castShadow scale={phase === "result" ? 1.5 : 1.2}>
            <cylinderGeometry args={[0.9, 1.1, 0.6, 32]} />
            <MeshDistortMaterial
              color="#FFD700"
              metalness={1}
              roughness={0}
              emissive="#FFA500"
              emissiveIntensity={phase === "result" ? 0.8 : 0.5}
              distort={0.2}
              speed={4}
            />
          </mesh>
          <mesh position={[0, -0.5, 0]} scale={phase === "result" ? 1.5 : 1.2}>
            <coneGeometry args={[0.18, 0.6, 16]} />
            <meshStandardMaterial
              color="#FFD700"
              metalness={1}
              roughness={0}
              emissive="#FFA500"
              emissiveIntensity={0.5}
            />
          </mesh>
        </Float>
      </Trail>

      {/* 勝利オーラ */}
      {phase === "result" && (
        <Sparkles
          count={100}
          scale={5}
          size={6}
          speed={2}
          color="#FFD700"
        />
      )}
    </group>
  );
}

// 火花パーティクル
function FireParticles({ phase }: { phase: string }) {
  const count = phase === "explosion" || phase === "result" ? 200 : 50;
  const color = phase === "explosion" || phase === "result" ? "#FFD700" : "#FF4400";

  return (
    <>
      <Sparkles
        count={count}
        scale={12}
        size={phase === "explosion" ? 10 : 4}
        speed={phase === "slowmo" ? 0.5 : 2}
        color={color}
        opacity={0.8}
      />
      
      {(phase === "explosion" || phase === "result") && (
        <Sparkles
          count={150}
          scale={15}
          size={8}
          speed={3}
          color="#FFA500"
          opacity={0.6}
        />
      )}
    </>
  );
}

// カメラ制御
function CameraController({ phase }: { phase: string }) {
  const { camera } = useThree();
  const targetPosition = useRef(new THREE.Vector3(0, 8, 12));
  const targetLookAt = useRef(new THREE.Vector3(0, 0, 0));

  useEffect(() => {
    if (phase === "intro") {
      targetPosition.current.set(0, 10, 15);
    } else if (phase === "battle") {
      targetPosition.current.set(5, 6, 10);
    } else if (phase === "slowmo") {
      targetPosition.current.set(0, 3, 6);
    } else if (phase === "crash") {
      targetPosition.current.set(0, 12, 8);
    } else if (phase === "explosion") {
      targetPosition.current.set(0, 5, 10);
    } else if (phase === "result") {
      targetPosition.current.set(0, 6, 8);
    }
  }, [phase]);

  useFrame(() => {
    camera.position.lerp(targetPosition.current, phase === "slowmo" ? 0.02 : 0.05);
    camera.lookAt(targetLookAt.current);
  });

  return null;
}

export default Beigoma3DAnimation;
