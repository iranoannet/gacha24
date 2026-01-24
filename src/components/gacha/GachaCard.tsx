import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface GachaCardProps {
  id: string;
  title: string;
  imageUrl: string;
  pricePerPlay: number;
  totalSlots: number;
  remainingSlots: number;
  borderColor?: "gold" | "red" | "rainbow";
}

const borderStyles = {
  gold: "border-4 border-primary",
  red: "border-4 border-accent",
  rainbow: "border-4 border-transparent bg-gradient-to-r from-purple-500 via-pink-500 to-yellow-500",
};

const GachaCard = ({
  id,
  title,
  imageUrl,
  pricePerPlay,
  totalSlots,
  remainingSlots,
  borderColor = "gold",
}: GachaCardProps) => {
  const navigate = useNavigate();
  const soldPercentage = ((totalSlots - remainingSlots) / totalSlots) * 100;
  const isSoldOut = remainingSlots === 0;

  const handleNavigateToDetail = () => {
    navigate(`/gacha/${id}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      className="gacha-card"
    >
      {/* Border wrapper for rainbow effect */}
      <div className={`rounded-xl overflow-hidden ${borderStyles[borderColor]}`}>
        {/* Image - Clickable to detail */}
        <div 
          className="relative aspect-[4/3] overflow-hidden cursor-pointer"
          onClick={handleNavigateToDetail}
        >
          <img
            src={imageUrl}
            alt={title}
            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
          />
          {isSoldOut && (
            <div className="absolute inset-0 bg-foreground/60 flex items-center justify-center">
              <span className="text-2xl font-black text-card rotate-[-15deg]">
                SOLD OUT
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-3 bg-card">
          {/* Price and Remaining */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1">
              <Coins className="h-4 w-4 text-primary" />
              <span className="font-bold text-foreground">
                {pricePerPlay.toLocaleString()}
              </span>
              <span className="text-xs text-muted-foreground">/1回</span>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">残り </span>
              <span className="font-bold text-foreground">
                {remainingSlots === Infinity ? "∞" : remainingSlots.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <Progress value={soldPercentage} className="h-2 mb-3" />

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              className="flex-1 btn-gacha h-9 text-sm"
              disabled={isSoldOut}
              onClick={handleNavigateToDetail}
            >
              1回ガチャ
            </Button>
            {pricePerPlay <= 100 && (
              <Button
                variant="outline"
                className="flex-1 h-9 text-sm border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                disabled={isSoldOut}
                onClick={handleNavigateToDetail}
              >
                10連ガチャ
              </Button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default GachaCard;
