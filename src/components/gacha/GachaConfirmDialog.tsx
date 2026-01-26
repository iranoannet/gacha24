import { motion, AnimatePresence } from "framer-motion";
import { Coins, AlertCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GachaConfirmDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  playCount: number;
  pricePerPlay: number;
  currentBalance: number;
  gachaTitle: string;
}

export function GachaConfirmDialog({
  isOpen,
  onConfirm,
  onCancel,
  playCount,
  pricePerPlay,
  currentBalance,
  gachaTitle,
}: GachaConfirmDialogProps) {
  const totalCost = pricePerPlay * playCount;
  const afterBalance = currentBalance - totalCost;
  const canAfford = afterBalance >= 0;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onCancel}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0, y: 20 }}
          transition={{ type: "spring", duration: 0.4 }}
          className="bg-card rounded-2xl w-full max-w-sm overflow-hidden border border-border shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header with animation */}
          <div className="relative bg-gradient-to-br from-primary/20 via-accent/10 to-primary/20 p-6 text-center overflow-hidden">
            <motion.div
              initial={{ rotate: 0 }}
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 opacity-30"
              style={{
                background: "conic-gradient(from 0deg, transparent, hsl(var(--primary)), transparent)",
              }}
            />
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.1, duration: 0.5 }}
              className="relative"
            >
              <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-xl font-bold text-foreground">ガチャを回しますか？</h2>
            </motion.div>
          </div>

          {/* Content */}
          <div className="p-5 space-y-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1 line-clamp-1">{gachaTitle}</p>
              <motion.p 
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                className="text-3xl font-black text-primary"
              >
                {playCount}回
              </motion.p>
            </div>

            {/* Cost breakdown */}
            <div className="bg-muted/50 rounded-xl p-4 space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">消費ポイント</span>
                <span className="font-bold text-foreground flex items-center gap-1">
                  <Coins className="w-4 h-4 text-primary" />
                  {totalCost.toLocaleString()}pt
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">現在の残高</span>
                <span className="font-medium text-foreground">{currentBalance.toLocaleString()}pt</span>
              </div>
              <div className="border-t border-border pt-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">購入後の残高</span>
                  <span className={`font-bold ${canAfford ? "text-primary" : "text-destructive"}`}>
                    {afterBalance.toLocaleString()}pt
                  </span>
                </div>
              </div>
            </div>

            {!canAfford && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 bg-destructive/10 text-destructive rounded-lg p-3"
              >
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm font-medium">ポイントが不足しています</p>
              </motion.div>
            )}
          </div>

          {/* Buttons */}
          <div className="p-5 pt-0 grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={onCancel}
              className="h-12 text-base font-medium"
            >
              キャンセル
            </Button>
            <motion.div
              whileTap={{ scale: 0.95 }}
            >
              <Button
                onClick={onConfirm}
                disabled={!canAfford}
                className="w-full h-12 text-base font-bold btn-gacha"
              >
                回す！
              </Button>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
