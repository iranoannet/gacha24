import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Truck, Coins, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ActionConfirmDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  actionType: "shipping" | "conversion";
  itemCount: number;
  totalPoints?: number;
  isProcessing?: boolean;
}

export function ActionConfirmDialog({
  isOpen,
  onConfirm,
  onCancel,
  actionType,
  itemCount,
  totalPoints = 0,
  isProcessing = false,
}: ActionConfirmDialogProps) {
  if (!isOpen) return null;

  const isShipping = actionType === "shipping";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={(e) => e.target === e.currentTarget && !isProcessing && onCancel()}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-card rounded-2xl w-full max-w-sm overflow-hidden shadow-xl"
        >
          {/* Header */}
          <div className={`p-4 ${isShipping ? "bg-blue-500" : "bg-amber-500"}`}>
            <div className="flex items-center justify-center gap-2 text-white">
              {isShipping ? (
                <Truck className="h-6 w-6" />
              ) : (
                <Coins className="h-6 w-6" />
              )}
              <h2 className="text-lg font-bold">
                {isShipping ? "発送依頼の確認" : "ポイント変換の確認"}
              </h2>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
          <div className="text-center mb-6">
            {isShipping ? (
              <>
                <p className="text-foreground font-bold text-lg mb-3">
                  {itemCount}件のアイテムを発送依頼しますか？
                </p>
                <p className="text-muted-foreground text-sm mb-4">
                  発送依頼後、管理者が順次発送処理を行います。
                  <br />
                  発送状況は「インベントリ」から確認できます。
                </p>
                <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                  <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-300 text-left">
                    確定するを押した場合、キャンセル処理ができませんのでご注意ください。
                  </p>
                </div>
              </>
            ) : (
              <>
                <p className="text-foreground font-bold text-lg mb-2">
                  {itemCount}件のアイテムをポイントに変換しますか？
                </p>
                <div className="bg-primary/10 rounded-xl p-4 mt-4">
                  <p className="text-sm text-muted-foreground mb-1">獲得ポイント</p>
                  <p className="text-3xl font-black text-primary">
                    +{totalPoints.toLocaleString()}pt
                  </p>
                </div>
                <div className="flex items-center gap-2 mt-4 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                  <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
                  <p className="text-xs text-amber-700 dark:text-amber-300 text-left">
                    ポイント変換後は元に戻せません。
                    カードは削除され、ポイントが加算されます。
                  </p>
                </div>
              </>
            )}
          </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={onCancel}
                disabled={isProcessing}
              >
                キャンセル
              </Button>
              <Button
                className={`flex-1 ${
                  isShipping
                    ? "bg-blue-500 hover:bg-blue-600"
                    : "bg-amber-500 hover:bg-amber-600"
                } text-white`}
                onClick={onConfirm}
                disabled={isProcessing}
              >
                {isProcessing ? "処理中..." : "確定する"}
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
