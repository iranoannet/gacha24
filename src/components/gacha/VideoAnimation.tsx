import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { X, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";

// Prize tier mapping from DB values to video tier codes
const TIER_MAPPING: Record<string, string> = {
  S: "S",
  A: "A",
  B: "B",
  miss: "C", // C賞
  C: "D",    // D賞
  D: "E",    // E賞
};

interface VideoAnimationProps {
  isPlaying: boolean;
  onComplete: () => void;
  onSkip: () => void;
  gachaId: string;
  prizeTier: string; // "S" | "A" | "B" | "miss" from the result
}

interface AnimationVideo {
  id: string;
  video_url: string;
  prize_tier: string;
}

export function VideoAnimation({
  isPlaying,
  onComplete,
  onSkip,
  gachaId,
  prizeTier,
}: VideoAnimationProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasError, setHasError] = useState(false);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);

  // Map the prize tier to video tier
  const videoTier = TIER_MAPPING[prizeTier] || "C";

  // Fetch available videos for this gacha and tier
  const { data: videos } = useQuery({
    queryKey: ["animation-videos", gachaId, videoTier],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gacha_animation_videos")
        .select("id, video_url, prize_tier")
        .eq("gacha_id", gachaId)
        .eq("prize_tier", videoTier);
      if (error) throw error;
      return data as AnimationVideo[];
    },
    enabled: isPlaying && !!gachaId,
  });

  // Select a random video
  const selectedVideo = videos && videos.length > 0
    ? videos[Math.floor(Math.random() * videos.length)]
    : null;

  useEffect(() => {
    if (isPlaying && selectedVideo && videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {
        // Autoplay failed, complete immediately
        onComplete();
      });
    }
  }, [isPlaying, selectedVideo, onComplete]);

  useEffect(() => {
    // If no videos available and playing, complete immediately
    if (isPlaying && videos && videos.length === 0) {
      onComplete();
    }
  }, [isPlaying, videos, onComplete]);

  const handleVideoEnd = () => {
    onComplete();
  };

  const handleVideoError = () => {
    setHasError(true);
    onComplete();
  };

  const handleVideoLoaded = () => {
    setIsVideoLoaded(true);
  };

  if (!isPlaying || !selectedVideo) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[110] bg-black flex items-center justify-center"
      >
        {/* Control Buttons */}
        <div className="absolute top-4 right-4 z-20 flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="text-white/70 hover:text-white hover:bg-white/20"
            onClick={onSkip}
            title="スキップ"
          >
            <SkipForward className="w-6 h-6" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-white/70 hover:text-white hover:bg-white/20"
            onClick={onSkip}
            title="閉じる"
          >
            <X className="w-6 h-6" />
          </Button>
        </div>

        {/* Loading indicator */}
        {!isVideoLoaded && !hasError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        )}

        {/* Video Player */}
        <video
          ref={videoRef}
          src={selectedVideo.video_url}
          className="w-full h-full object-contain"
          onEnded={handleVideoEnd}
          onError={handleVideoError}
          onLoadedData={handleVideoLoaded}
          playsInline
          muted={false}
        />

        {/* Tap to skip hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <button
            onClick={onSkip}
            className="text-white/50 text-sm hover:text-white/80 transition-colors"
          >
            タップでスキップ
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Helper function to get the highest prize tier from drawn cards
export function getHighestPrizeTierForVideo(
  drawnCards: Array<{ prizeTier: string }>
): string {
  const tierOrder = ["S", "A", "B", "miss"];
  let highest = "miss";
  
  for (const card of drawnCards) {
    const cardIndex = tierOrder.indexOf(card.prizeTier);
    const currentIndex = tierOrder.indexOf(highest);
    if (cardIndex !== -1 && cardIndex < currentIndex) {
      highest = card.prizeTier;
    }
  }
  
  return highest;
}
