import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Coins, Zap, Clock, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTenant } from "@/hooks/useTenant";
import { cn } from "@/lib/utils";

interface DarkThemeGachaCardProps {
  id: string;
  title: string;
  imageUrl: string;
  pricePerPlay: number;
  totalSlots: number;
  remainingSlots: number;
  displayTags?: string[];
}

const DarkThemeGachaCard = ({
  id,
  title,
  imageUrl,
  pricePerPlay,
  totalSlots,
  remainingSlots,
  displayTags = [],
}: DarkThemeGachaCardProps) => {
  const navigate = useNavigate();
  const { tenantSlug } = useTenant();
  const soldPercentage = ((totalSlots - remainingSlots) / totalSlots) * 100;
  const isSoldOut = remainingSlots === 0;
  const basePath = tenantSlug ? `/${tenantSlug}` : "";

  // Check for display tags
  const isNewArrival = displayTags.includes("new_arrivals");
  const isHotItem = displayTags.includes("hot_items");

  const handleNavigateToDetail = () => {
    navigate(`${basePath}/gacha/${id}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, scale: 1.02 }}
      className={cn(
        "relative rounded-xl overflow-hidden",
        "bg-[hsl(var(--dark-surface-elevated))]",
        "border border-[hsl(var(--dark-border))]",
        "shadow-lg hover:shadow-[0_0_30px_hsl(var(--dark-neon-primary)/0.2)]",
        "transition-all duration-300"
      )}
    >
      {/* Neon glow border effect on hover */}
      <div className="absolute inset-0 rounded-xl opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
        <div className="absolute inset-0 rounded-xl border-2 border-[hsl(var(--dark-neon-primary))] shadow-[0_0_20px_hsl(var(--dark-neon-primary)/0.5),inset_0_0_20px_hsl(var(--dark-neon-primary)/0.1)]" />
      </div>

      {/* Image */}
      <div 
        className="relative aspect-[4/3] overflow-hidden cursor-pointer"
        onClick={handleNavigateToDetail}
      >
        <img
          src={imageUrl}
          alt={title}
          className="w-full h-full object-cover hover:scale-110 transition-transform duration-500"
        />
        
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[hsl(var(--dark-surface-elevated))] via-transparent to-transparent opacity-60" />
        
        {/* Tag badges (top left) */}
        <div className="absolute top-3 left-3 flex flex-col gap-1">
          {isNewArrival && (
            <Badge className="bg-[hsl(var(--dark-neon-secondary))] text-[hsl(var(--dark-background))] border-0 shadow-[0_0_10px_hsl(var(--dark-neon-secondary)/0.5)] flex items-center gap-1 text-xs">
              <Clock className="h-3 w-3" />
              NEW
            </Badge>
          )}
          {isHotItem && (
            <Badge className="bg-[hsl(var(--dark-neon-accent))] text-white border-0 shadow-[0_0_10px_hsl(var(--dark-neon-accent)/0.5)] flex items-center gap-1 text-xs">
              <Flame className="h-3 w-3" />
              HOT
            </Badge>
          )}
        </div>

        {/* Price badge (top right) */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1 rounded-full bg-[hsl(var(--dark-neon-gold)/0.9)] text-[hsl(var(--dark-background))] font-bold text-sm shadow-[0_0_15px_hsl(var(--dark-neon-gold)/0.5)]">
          <Coins className="h-4 w-4" />
          ¥{pricePerPlay.toLocaleString()}
        </div>

        {isSoldOut && (
          <div className="absolute inset-0 bg-[hsl(var(--dark-background)/0.8)] backdrop-blur-sm flex items-center justify-center">
            <span className="text-2xl font-black text-[hsl(var(--dark-neon-accent))] rotate-[-15deg] tracking-wider drop-shadow-[0_0_10px_hsl(var(--dark-neon-accent)/0.8)]">
              SOLD OUT
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Title */}
        <h3 className="text-[hsl(var(--dark-foreground))] font-bold text-sm mb-3 line-clamp-2">
          {title}
        </h3>

        {/* Remaining slots */}
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-[hsl(var(--dark-muted))]">Remaining</span>
          <span className="font-bold text-[hsl(var(--dark-foreground))]">
            {remainingSlots === Infinity ? "∞" : remainingSlots.toLocaleString()}
            <span className="text-[hsl(var(--dark-muted))] font-normal"> / {totalSlots.toLocaleString()}</span>
          </span>
        </div>

        {/* Progress Bar */}
        <div className="relative h-2 rounded-full bg-[hsl(var(--dark-input))] overflow-hidden mb-4">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${soldPercentage}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[hsl(var(--dark-neon-primary))] to-[hsl(var(--dark-neon-secondary))] shadow-[0_0_10px_hsl(var(--dark-neon-primary)/0.5)]"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            className={cn(
              "flex-1 h-10 text-sm font-bold rounded-lg",
              "bg-gradient-to-r from-[hsl(var(--dark-neon-primary))] to-[hsl(var(--dark-neon-secondary))]",
              "text-[hsl(var(--dark-background))] shadow-[0_0_15px_hsl(var(--dark-neon-primary)/0.4)]",
              "hover:shadow-[0_0_25px_hsl(var(--dark-neon-primary)/0.6)] transition-shadow",
              "disabled:opacity-50 disabled:shadow-none"
            )}
            disabled={isSoldOut}
            onClick={handleNavigateToDetail}
          >
            <Zap className="h-4 w-4 mr-1" />
            Play
          </Button>
          {pricePerPlay <= 100 && (
            <Button
              variant="outline"
              className={cn(
                "flex-1 h-10 text-sm font-bold rounded-lg",
                "border-[hsl(var(--dark-neon-primary))] text-[hsl(var(--dark-neon-primary))]",
                "bg-transparent hover:bg-[hsl(var(--dark-neon-primary)/0.1)]",
                "disabled:opacity-50"
              )}
              disabled={isSoldOut}
              onClick={handleNavigateToDetail}
            >
              10x Play
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default DarkThemeGachaCard;
