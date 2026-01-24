import { useState } from "react";
import { motion } from "framer-motion";
import { Package, Coins, Truck, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface DrawnCard {
  slotId: string;
  cardId: string;
  name: string;
  imageUrl: string | null;
  prizeTier: string;
  conversionPoints: number;
}

interface ItemActionSelectorProps {
  cards: DrawnCard[];
  userId: string;
  onComplete: () => void;
}

const prizeTierStyles: Record<string, { bg: string; label: string }> = {
  S: { bg: "bg-gradient-to-r from-yellow-400 to-orange-500", label: "S賞" },
  A: { bg: "bg-gradient-to-r from-rose-400 to-red-500", label: "A賞" },
  B: { bg: "bg-gradient-to-r from-blue-400 to-purple-500", label: "B賞" },
  miss: { bg: "bg-muted", label: "ハズレ" },
};

type ActionType = "shipping" | "conversion" | null;

interface CardSelection {
  slotId: string;
  action: ActionType;
}

export function ItemActionSelector({ cards, userId, onComplete }: ItemActionSelectorProps) {
  const queryClient = useQueryClient();
  const [selections, setSelections] = useState<Map<string, ActionType>>(new Map());
  const [isProcessing, setIsProcessing] = useState(false);

  // ハズレ以外のカードをフィルタリング
  const actionableCards = cards.filter(card => card.prizeTier !== "miss");

  const updateSelection = (slotId: string, action: ActionType) => {
    setSelections(prev => {
      const next = new Map(prev);
      if (prev.get(slotId) === action) {
        next.delete(slotId);
      } else {
        next.set(slotId, action);
      }
      return next;
    });
  };

  const selectAllForAction = (action: ActionType) => {
    const newSelections = new Map<string, ActionType>();
    actionableCards.forEach(card => {
      newSelections.set(card.slotId, action);
    });
    setSelections(newSelections);
  };

  const processActionsMutation = useMutation({
    mutationFn: async () => {
      const shippingItems: { slotId: string; cardId: string }[] = [];
      const conversionItems: { slotId: string; cardId: string; points: number }[] = [];
      let totalConversionPoints = 0;

      selections.forEach((action, slotId) => {
        const card = actionableCards.find(c => c.slotId === slotId);
        if (!card) return;
        
        if (action === "shipping") {
          shippingItems.push({ slotId, cardId: card.cardId });
        } else if (action === "conversion") {
          conversionItems.push({ slotId, cardId: card.cardId, points: card.conversionPoints });
          totalConversionPoints += card.conversionPoints;
        }
      });

      // 発送依頼を登録
      if (shippingItems.length > 0) {
        const { error: shippingError } = await supabase
          .from("inventory_actions")
          .insert(
            shippingItems.map(item => ({
              user_id: userId,
              slot_id: item.slotId,
              card_id: item.cardId,
              action_type: "shipping" as const,
              status: "pending" as const,
            }))
          );
        if (shippingError) throw shippingError;
      }

      // ポイント変換を登録
      if (conversionItems.length > 0) {
        const { error: conversionError } = await supabase
          .from("inventory_actions")
          .insert(
            conversionItems.map(item => ({
              user_id: userId,
              slot_id: item.slotId,
              card_id: item.cardId,
              action_type: "conversion" as const,
              status: "completed" as const,
              converted_points: item.points,
              processed_at: new Date().toISOString(),
            }))
          );
        if (conversionError) throw conversionError;

        // ポイントを追加
        const { data: profile, error: fetchError } = await supabase
          .from("profiles")
          .select("points_balance")
          .eq("user_id", userId)
          .single();
        
        if (fetchError) throw fetchError;

        const { error: updateError } = await supabase
          .from("profiles")
          .update({ points_balance: (profile?.points_balance || 0) + totalConversionPoints })
          .eq("user_id", userId);
        
        if (updateError) throw updateError;
      }

      return { shippingCount: shippingItems.length, conversionCount: conversionItems.length, totalConversionPoints };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      queryClient.invalidateQueries({ queryKey: ["user-profile-header"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      
      const messages: string[] = [];
      if (result.shippingCount > 0) {
        messages.push(`${result.shippingCount}件の発送依頼を受付しました`);
      }
      if (result.conversionCount > 0) {
        messages.push(`${result.totalConversionPoints.toLocaleString()}ptを獲得しました`);
      }
      if (messages.length > 0) {
        toast.success(messages.join("、"));
      }
      onComplete();
    },
    onError: (error) => {
      toast.error("エラーが発生しました: " + error.message);
    },
  });

  const handleSubmit = async () => {
    if (selections.size === 0) {
      toast.info("アイテムを選択してください");
      return;
    }
    setIsProcessing(true);
    await processActionsMutation.mutateAsync();
    setIsProcessing(false);
  };

  // 選択のサマリーを計算
  const summary = {
    shipping: 0,
    conversion: 0,
    conversionPoints: 0,
  };

  selections.forEach((action, slotId) => {
    if (action === "shipping") {
      summary.shipping++;
    } else if (action === "conversion") {
      const card = actionableCards.find(c => c.slotId === slotId);
      if (card) {
        summary.conversion++;
        summary.conversionPoints += card.conversionPoints;
      }
    }
  });

  if (actionableCards.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        <p>発送可能なアイテムはありません</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 一括選択ボタン */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => selectAllForAction("shipping")}
          className="flex-1"
        >
          <Truck className="h-4 w-4 mr-1" />
          すべて発送
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => selectAllForAction("conversion")}
          className="flex-1"
        >
          <Coins className="h-4 w-4 mr-1" />
          すべて変換
        </Button>
      </div>

      {/* アイテムリスト */}
      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {actionableCards.map((card) => {
          const currentAction = selections.get(card.slotId);
          return (
            <motion.div
              key={card.slotId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
            >
              {/* カード画像 */}
              <div className="w-12 h-16 rounded overflow-hidden flex-shrink-0">
                {card.imageUrl ? (
                  <img src={card.imageUrl} alt={card.name} className="w-full h-full object-cover" />
                ) : (
                  <div className={`w-full h-full ${prizeTierStyles[card.prizeTier]?.bg || "bg-muted"} flex items-center justify-center`}>
                    <Package className="h-4 w-4 text-white/70" />
                  </div>
                )}
              </div>

              {/* カード情報 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 mb-1">
                  <Badge className={`${prizeTierStyles[card.prizeTier]?.bg} text-white text-[10px] px-1.5 py-0`}>
                    {prizeTierStyles[card.prizeTier]?.label}
                  </Badge>
                </div>
                <p className="text-sm font-medium truncate">{card.name}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Coins className="h-3 w-3" />
                  変換: {card.conversionPoints.toLocaleString()}pt
                </p>
              </div>

              {/* アクション選択 */}
              <div className="flex gap-1">
                <Button
                  variant={currentAction === "shipping" ? "default" : "outline"}
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => updateSelection(card.slotId, "shipping")}
                >
                  <Truck className="h-4 w-4" />
                </Button>
                <Button
                  variant={currentAction === "conversion" ? "default" : "outline"}
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => updateSelection(card.slotId, "conversion")}
                >
                  <Coins className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* サマリー */}
      {selections.size > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="bg-primary/10 rounded-lg p-3 space-y-1"
        >
          {summary.shipping > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1">
                <Truck className="h-4 w-4" />
                発送依頼
              </span>
              <span className="font-bold">{summary.shipping}件</span>
            </div>
          )}
          {summary.conversion > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1">
                <Coins className="h-4 w-4" />
                ポイント変換
              </span>
              <span className="font-bold text-primary">+{summary.conversionPoints.toLocaleString()}pt</span>
            </div>
          )}
        </motion.div>
      )}

      {/* 確定ボタン */}
      <Button
        className="w-full btn-gacha"
        onClick={handleSubmit}
        disabled={isProcessing || selections.size === 0}
      >
        {isProcessing ? (
          "処理中..."
        ) : (
          <>
            選択を確定
            <ArrowRight className="h-4 w-4 ml-1" />
          </>
        )}
      </Button>
    </div>
  );
}