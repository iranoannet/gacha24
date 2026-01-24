import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

interface GachaPlayAnimationProps {
  isPlaying: boolean;
  playCount: number;
}

export function GachaPlayAnimation({ isPlaying, playCount }: GachaPlayAnimationProps) {
  const [particles, setParticles] = useState<{ id: number; x: number; y: number; delay: number }[]>([]);

  useEffect(() => {
    if (isPlaying) {
      // Generate random particles
      const newParticles = Array.from({ length: 20 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        delay: Math.random() * 0.5,
      }));
      setParticles(newParticles);
    }
  }, [isPlaying]);

  if (!isPlaying) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[110] bg-black/95 flex items-center justify-center overflow-hidden"
      >
        {/* Background glow effect */}
        <motion.div
          animate={{
            scale: [1, 1.5, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute w-96 h-96 rounded-full bg-gradient-to-r from-primary via-accent to-primary blur-3xl"
        />

        {/* Rotating rings */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          className="absolute w-64 h-64 border-4 border-primary/30 rounded-full"
        />
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="absolute w-48 h-48 border-2 border-accent/40 rounded-full"
        />
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          className="absolute w-32 h-32 border-2 border-primary/50 rounded-full"
        />

        {/* Sparkle particles */}
        {particles.map((particle) => (
          <motion.div
            key={particle.id}
            initial={{ 
              x: "50%", 
              y: "50%", 
              scale: 0,
              opacity: 0 
            }}
            animate={{
              x: `${particle.x}%`,
              y: `${particle.y}%`,
              scale: [0, 1, 0],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 1.5,
              delay: particle.delay,
              repeat: Infinity,
              repeatDelay: 0.5,
            }}
            className="absolute w-2 h-2 bg-primary rounded-full"
            style={{
              boxShadow: "0 0 10px hsl(var(--primary)), 0 0 20px hsl(var(--primary))",
            }}
          />
        ))}

        {/* Center capsule machine animation */}
        <motion.div 
          className="relative z-10 flex flex-col items-center"
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", duration: 0.5 }}
        >
          {/* Gacha Ball */}
          <motion.div
            animate={{
              y: [0, -20, 0],
              rotateZ: [0, 10, -10, 0],
            }}
            transition={{
              duration: 0.8,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="relative"
          >
            {/* Ball glow */}
            <motion.div
              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
              transition={{ duration: 0.5, repeat: Infinity }}
              className="absolute inset-0 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 blur-xl"
            />
            
            {/* Main ball */}
            <div className="relative w-32 h-32 rounded-full bg-gradient-to-br from-yellow-300 via-amber-400 to-orange-500 flex items-center justify-center shadow-2xl overflow-hidden">
              {/* Shine effect */}
              <motion.div
                animate={{ x: ["-100%", "200%"] }}
                transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 1 }}
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-12"
              />
              
              {/* Top half (lighter) */}
              <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/30 to-transparent rounded-t-full" />
              
              {/* Center line */}
              <div className="absolute left-0 right-0 h-2 bg-gradient-to-r from-gray-800 via-gray-600 to-gray-800 top-1/2 -translate-y-1/2" />
              
              {/* Play count */}
              <motion.span 
                className="relative z-10 text-2xl font-black text-white drop-shadow-lg"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 0.5, repeat: Infinity }}
              >
                ×{playCount}
              </motion.span>
            </div>
          </motion.div>

          {/* Loading text */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-8 text-center"
          >
            <motion.p
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="text-xl font-bold text-white"
            >
              抽選中...
            </motion.p>
            <p className="text-sm text-white/60 mt-2">結果をお待ちください</p>
          </motion.div>
        </motion.div>

        {/* Corner decorations */}
        {[0, 1, 2, 3].map((i) => (
          <motion.div
            key={i}
            initial={{ scale: 0, rotate: i * 90 }}
            animate={{ scale: 1, rotate: i * 90 + 360 }}
            transition={{ 
              duration: 8, 
              repeat: Infinity, 
              ease: "linear",
              delay: i * 0.2 
            }}
            className="absolute w-16 h-16"
            style={{
              top: i < 2 ? "10%" : "auto",
              bottom: i >= 2 ? "10%" : "auto",
              left: i % 2 === 0 ? "10%" : "auto",
              right: i % 2 === 1 ? "10%" : "auto",
            }}
          >
            <div className="w-full h-full border-t-2 border-l-2 border-primary/50 rounded-tl-full" />
          </motion.div>
        ))}
      </motion.div>
    </AnimatePresence>
  );
}
