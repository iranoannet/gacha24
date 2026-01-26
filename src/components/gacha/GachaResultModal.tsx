import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Package, Coins, Sparkles, Truck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ActionConfirmDialog } from "./ActionConfirmDialog";

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

type ActionType = "shipping" | "conversion" | null;

export function GachaResultModal({ isOpen, onClose, drawnCards, totalCost, newBalance }: GachaResultModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [revealedCount, setRevealedCount] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [step, setStep] = useState<"reveal" | "select">("reveal");
  const [selections, setSelections] = useState<Map<string, ActionType>>(new Map());
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<"shipping" | "conversion" | null>(null);

  // 全カードが選択対象（ハズレも含む）
  const actionableCards = drawnCards;

  useEffect(() => {
    if (isOpen && drawnCards.length > 0) {
      setRevealedCount(0);
      setShowAll(false);
      setStep("reveal");
      setSelections(new Map());
      
      // 1枚ずつ表示するアニメーション
      // カード枚数に関わらず一定のテンポで表示（10連と同じ速度）
      const revealInterval = 300; // 常に300ms間隔で表示
      
      const interval = setInterval(() => {
        setRevealedCount((prev) => {
          if (prev >= drawnCards.length) {
            clearInterval(interval);
            return prev;
          }
          return prev + 1;
        });
      }, revealInterval);

      return () => clearInterval(interval);
    }
  }, [isOpen, drawnCards.length]);

  const handleSkip = () => {
    setRevealedCount(drawnCards.length);
    setShowAll(true);
  };

  const handleProceedToSelect = () => {
    if (actionableCards.length === 0) {
      // ハズレのみの場合は直接閉じる
      onClose();
    } else {
      setStep("select");
    }
  };

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
      if (!user) throw new Error("ログインが必要です");

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
              user_id: user.id,
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
              user_id: user.id,
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
          .eq("user_id", user.id)
          .single();
        
        if (fetchError) throw fetchError;

        const { error: updateError } = await supabase
          .from("profiles")
          .update({ points_balance: (profile?.points_balance || 0) + totalConversionPoints })
          .eq("user_id", user.id);
        
        if (updateError) throw updateError;
      }

      return { shippingCount: shippingItems.length, conversionCount: conversionItems.length, totalConversionPoints };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      queryClient.invalidateQueries({ queryKey: ["user-profile-header"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-unselected"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-pending"] });
      
      const messages: string[] = [];
      if (result.shippingCount > 0) {
        messages.push(`${result.shippingCount}件の発送依頼を受付`);
      }
      if (result.conversionCount > 0) {
        messages.push(`${result.totalConversionPoints.toLocaleString()}pt獲得`);
      }
      if (messages.length > 0) {
        toast.success(messages.join("、"));
      }
      onClose();
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
    
    // 選択されたアクションの種類を判定
    const hasShipping = summary.shipping > 0;
    const hasConversion = summary.conversion > 0;
    
    // 両方ある場合は順番に確認
    if (hasShipping && hasConversion) {
      // まず発送を確認
      setPendingAction("shipping");
      setShowConfirmDialog(true);
    } else if (hasShipping) {
      setPendingAction("shipping");
      setShowConfirmDialog(true);
    } else if (hasConversion) {
      setPendingAction("conversion");
      setShowConfirmDialog(true);
    }
  };

  const handleConfirmAction = async () => {
    setShowConfirmDialog(false);
    setIsProcessing(true);
    await processActionsMutation.mutateAsync();
    setIsProcessing(false);
  };

  const handleCancelConfirm = () => {
    setShowConfirmDialog(false);
    setPendingAction(null);
  };

  const handleSkipSelection = () => {
    // 選択せずに閉じる（後でインベントリから選択可能）
    // インベントリキャッシュを無効化して、新しいアイテムが表示されるようにする
    queryClient.invalidateQueries({ queryKey: ["inventory-unselected"] });
    onClose();
  };

  // 賞別にグループ化
  const groupedCards = drawnCards.reduce((acc, card) => {
    const tier = card.prizeTier;
    if (!acc[tier]) acc[tier] = [];
    acc[tier].push(card);
    return acc;
  }, {} as Record<string, DrawnCard[]>);

  const tierOrder = ["S", "A", "B", "miss"];

  // 選択サマリー
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

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={(e) => e.target === e.currentTarget && revealedCount >= drawnCards.length && step === "reveal" && actionableCards.length === 0 && onClose()}
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
              <h2 className="text-lg font-bold text-foreground">
                {step === "reveal" ? "ガチャ結果" : "アイテムを選択"}
              </h2>
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {step === "reveal" ? (
              // 結果表示ステップ
              <>
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
                          <Badge
                            className={`absolute top-2 left-2 z-10 ${prizeTierStyles[card.prizeTier]?.bg} ${prizeTierStyles[card.prizeTier]?.text} font-black text-sm px-3 py-1`}
                          >
                            {prizeTierStyles[card.prizeTier]?.label}
                          </Badge>

                          {card.imageUrl ? (
                            <img src={card.imageUrl} alt={card.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className={`w-full h-full bg-gradient-to-br ${prizeTierStyles[card.prizeTier]?.color} flex items-center justify-center`}>
                              <Package className="h-16 w-16 text-white/50" />
                            </div>
                          )}

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

                    <Button variant="ghost" onClick={handleSkip} className="mt-4 text-muted-foreground">
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
                                  <img src={card.imageUrl} alt={card.name} className="w-full h-full object-cover" />
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
              </>
            ) : (
              // 選択ステップ
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground text-center">
                  発送またはポイント変換を選択してください
                </p>

                {/* 一括選択ボタン */}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => selectAllForAction("shipping")} className="flex-1">
                    <Truck className="h-4 w-4 mr-1" />
                    すべて発送
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => selectAllForAction("conversion")} className="flex-1">
                    <Coins className="h-4 w-4 mr-1" />
                    すべて変換
                  </Button>
                </div>

                {/* アイテムリスト */}
                <div className="space-y-2 max-h-[250px] overflow-y-auto">
                  {actionableCards.map((card) => {
                    const currentAction = selections.get(card.slotId);
                    return (
                      <motion.div
                        key={card.slotId}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
                      >
                        <div className="w-10 h-14 rounded overflow-hidden flex-shrink-0">
                          {card.imageUrl ? (
                            <img src={card.imageUrl} alt={card.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className={`w-full h-full bg-gradient-to-br ${prizeTierStyles[card.prizeTier]?.color} flex items-center justify-center`}>
                              <Package className="h-3 w-3 text-white/70" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <Badge className={`${prizeTierStyles[card.prizeTier]?.bg} text-white text-[10px] px-1.5 py-0 mb-1`}>
                            {prizeTierStyles[card.prizeTier]?.label}
                          </Badge>
                          <p className="text-sm font-medium truncate">{card.name}</p>
                          <p className="text-xs text-muted-foreground">
                            変換: {card.conversionPoints.toLocaleString()}pt
                          </p>
                        </div>

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
              </div>
            )}
          </div>

          {/* Footer */}
          {step === "reveal" && revealedCount >= drawnCards.length && (
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
              {actionableCards.length > 0 ? (
                <Button onClick={handleProceedToSelect} className="w-full btn-gacha">
                  アイテムを選択する
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button onClick={onClose} className="w-full btn-gacha">
                  閉じる
                </Button>
              )}
            </motion.div>
          )}

          {step === "select" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 border-t border-border bg-muted/30 space-y-2"
            >
              <Button
                className="w-full btn-gacha"
                onClick={handleSubmit}
                disabled={isProcessing || selections.size === 0}
              >
                {isProcessing ? "処理中..." : "選択を確定"}
              </Button>
              <Button
                variant="ghost"
                className="w-full text-muted-foreground"
                onClick={handleSkipSelection}
              >
                後で選択する
              </Button>
            </motion.div>
          )}
        </motion.div>

        {/* Confirm Dialog */}
        <ActionConfirmDialog
          isOpen={showConfirmDialog}
          onConfirm={handleConfirmAction}
          onCancel={handleCancelConfirm}
          actionType={pendingAction || "shipping"}
          itemCount={pendingAction === "shipping" ? summary.shipping : summary.conversion}
          totalPoints={summary.conversionPoints}
          isProcessing={isProcessing}
        />
      </motion.div>
    </AnimatePresence>
  );
}