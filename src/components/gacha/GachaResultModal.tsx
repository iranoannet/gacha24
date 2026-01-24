import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Package, Coins, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface DrawnCard {
  slotId: string;
  cardId: string;
  name: string;
  imageUrl: string | null;
  prizeTier: string;
  conversionPoints: number;
}

interface GachaResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  drawnCards: DrawnCard[];
  totalCost: number;
  newBalance: number;
}

const prizeTierStyles: Record<string, { bg: string; text: string; glow: string; label: string; color: string }> = {
  S: { 
    bg: "bg-gradient-to-br from-yellow-400 via-amber-500 to-orange-500", 
    text: "text-white", 
    glow: "shadow-[0_0_30px_rgba(251,191,36,0.8)]",
    label: "S賞",
    color: "from-yellow-400 to-orange-500"
  },
  A: { 
    bg: "bg-gradient-to-br from-rose-400 via-pink-500 to-red-500", 
    text: "text-white", 
    glow: "shadow-[0_0_25px_rgba(244,63,94,0.7)]",
    label: "A賞",
    color: "from-rose-400 to-red-500"
  },
  B: { 
    bg: "bg-gradient-to-br from-blue-400 via-indigo-500 to-purple-500", 
    text: "text-white", 
    glow: "shadow-[0_0_20px_rgba(99,102,241,0.6)]",
    label: "B賞",
    color: "from-blue-400 to-purple-500"
  },
  miss: { 
    bg: "bg-gradient-to-br from-gray-400 to-gray-600", 
    text: "text-white", 
    glow: "",
    label: "ハズレ",
    color: "from-gray-400 to-gray-600"
  },
};

export function GachaResultModal({ isOpen, onClose, drawnCards, totalCost, newBalance }: GachaResultModalProps) {
  const [revealedCount, setRevealedCount] = useState(0);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (isOpen && drawnCards.length > 0) {
      setRevealedCount(0);
      setShowAll(false);
      
      // 1枚ずつ表示するアニメーション
      const interval = setInterval(() => {
        setRevealedCount((prev) => {
          if (prev >= drawnCards.length) {
            clearInterval(interval);
            return prev;
          }
          return prev + 1;
        });
      }, drawnCards.length > 10 ? 100 : 300);

      return () => clearInterval(interval);
    }
  }, [isOpen, drawnCards.length]);

  const handleSkip = () => {
    setRevealedCount(drawnCards.length);
    setShowAll(true);
  };

  // 賞別にグループ化
  const groupedCards = drawnCards.reduce((acc, card) => {
    const tier = card.prizeTier;
    if (!acc[tier]) acc[tier] = [];
    acc[tier].push(card);
    return acc;
  }, {} as Record<string, DrawnCard[]>);

  const tierOrder = ["S", "A", "B", "miss"];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={(e) => e.target === e.currentTarget && revealedCount >= drawnCards.length && onClose()}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          className="bg-card rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="relative p-4 border-b border-border">
            <div className="flex items-center justify-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold text-foreground">ガチャ結果</h2>
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            {revealedCount >= drawnCards.length && (
              <button
                onClick={onClose}
                className="absolute right-4 top-4 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Cards Display */}
          <div className="flex-1 overflow-y-auto p-4">
            {revealedCount < drawnCards.length ? (
              // 演出中：1枚ずつ表示
              <div className="flex flex-col items-center justify-center min-h-[300px]">
                {drawnCards.slice(0, revealedCount + 1).map((card, index) => (
                  <motion.div
                    key={card.slotId}
                    initial={{ scale: 0, rotateY: 180 }}
                    animate={{ scale: index === revealedCount ? 1 : 0.6, rotateY: 0 }}
                    transition={{ type: "spring", duration: 0.5 }}
                    className={`relative ${index === revealedCount ? "" : "hidden"}`}
                  >
                    <div className={`relative w-48 aspect-[3/4] rounded-xl overflow-hidden ${prizeTierStyles[card.prizeTier]?.glow}`}>
                      {/* Prize Tier Badge */}
                      <Badge
                        className={`absolute top-2 left-2 z-10 ${prizeTierStyles[card.prizeTier]?.bg} ${prizeTierStyles[card.prizeTier]?.text} font-black text-sm px-3 py-1`}
                      >
                        {prizeTierStyles[card.prizeTier]?.label}
                      </Badge>

                      {card.imageUrl ? (
                        <img
                          src={card.imageUrl}
                          alt={card.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className={`w-full h-full bg-gradient-to-br ${prizeTierStyles[card.prizeTier]?.color} flex items-center justify-center`}>
                          <Package className="h-16 w-16 text-white/50" />
                        </div>
                      )}

                      {/* Card Name Overlay */}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                        <p className="text-white text-sm font-bold line-clamp-2">{card.name}</p>
                        <p className="text-white/70 text-xs flex items-center gap-1">
                          <Coins className="h-3 w-3" />
                          {card.conversionPoints.toLocaleString()}pt
                        </p>
                      </div>
                    </div>

                    <p className="text-center text-muted-foreground text-sm mt-3">
                      {revealedCount + 1} / {drawnCards.length}
                    </p>
                  </motion.div>
                ))}

                <Button
                  variant="ghost"
                  onClick={handleSkip}
                  className="mt-4 text-muted-foreground"
                >
                  スキップ →
                </Button>
              </div>
            ) : (
              // 結果一覧表示
              <div className="space-y-4">
                {tierOrder.map((tier) => {
                  const cards = groupedCards[tier];
                  if (!cards || cards.length === 0) return null;

                  return (
                    <div key={tier}>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={`${prizeTierStyles[tier]?.bg} ${prizeTierStyles[tier]?.text} font-bold`}>
                          {prizeTierStyles[tier]?.label}
                        </Badge>
                        <span className="text-sm text-muted-foreground">×{cards.length}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {cards.map((card) => (
                          <motion.div
                            key={card.slotId}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className={`relative rounded-lg overflow-hidden aspect-[3/4] ${prizeTierStyles[card.prizeTier]?.glow}`}
                          >
                            {card.imageUrl ? (
                              <img
                                src={card.imageUrl}
                                alt={card.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className={`w-full h-full bg-gradient-to-br ${prizeTierStyles[card.prizeTier]?.color} flex items-center justify-center`}>
                                <Package className="h-8 w-8 text-white/50" />
                              </div>
                            )}
                            <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-1">
                              <p className="text-white text-[10px] line-clamp-1">{card.name}</p>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {revealedCount >= drawnCards.length && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 border-t border-border bg-muted/30"
            >
              <div className="flex justify-between items-center mb-3 text-sm">
                <span className="text-muted-foreground">使用ポイント</span>
                <span className="font-bold text-foreground">-{totalCost.toLocaleString()}pt</span>
              </div>
              <div className="flex justify-between items-center mb-4 text-sm">
                <span className="text-muted-foreground">残高</span>
                <span className="font-bold text-primary">{newBalance.toLocaleString()}pt</span>
              </div>
              <Button onClick={onClose} className="w-full btn-gacha">
                閉じる
              </Button>
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
