import { useState } from "react";
import { useNavigate } from "react-router-dom";
import MainLayout from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Truck, Check, Coins, Loader2, AlertCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type InventoryAction = Database["public"]["Tables"]["inventory_actions"]["Row"];

const prizeTierStyles: Record<string, { bg: string; label: string }> = {
  S: { bg: "bg-gradient-to-r from-yellow-400 to-orange-500", label: "S賞" },
  A: { bg: "bg-gradient-to-r from-rose-400 to-red-500", label: "A賞" },
  B: { bg: "bg-gradient-to-r from-blue-400 to-purple-500", label: "B賞" },
  miss: { bg: "bg-muted", label: "ハズレ" },
};

interface InventoryItem {
  id: string;
  slotId: string;
  cardId: string;
  cardName: string;
  cardImageUrl: string | null;
  prizeTier: string;
  conversionPoints: number;
  gachaTitle: string;
  actionType: "shipping" | "conversion" | null;
  status: string | null;
  trackingNumber: string | null;
  requestedAt: string | null;
  processedAt: string | null;
}

const Inventory = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showAddressDialog, setShowAddressDialog] = useState(false);
  const [isBulkConverting, setIsBulkConverting] = useState(false);

  // ユーザーの住所情報を取得
  const { data: userProfile } = useQuery({
    queryKey: ["user-address-check", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("postal_code, prefecture, city, address_line1, last_name, first_name, phone_number")
        .eq("user_id", user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const hasCompleteAddress = userProfile?.postal_code && userProfile?.prefecture && 
    userProfile?.city && userProfile?.address_line1 && 
    userProfile?.last_name && userProfile?.first_name && userProfile?.phone_number;

  // ユーザーの当選スロット（inventory_actionに登録されていないもの = 未選択）を取得
  const { data: unselectedItems, isLoading: isLoadingUnselected, error: unselectedError } = useQuery({
    queryKey: ["inventory-unselected", user?.id],
    queryFn: async () => {
      if (!user) {
        console.log("[Inventory] No user, returning empty");
        return [];
      }

      console.log("[Inventory] ====== START FETCH ======");
      console.log("[Inventory] User ID:", user.id);
      console.log("[Inventory] User Email:", user.email);
      console.log("[Inventory] User Agent:", navigator.userAgent);
      console.log("[Inventory] Is Mobile:", /iPhone|iPad|iPod|Android/i.test(navigator.userAgent));

      // 当選したスロットを取得（JOINを使わずシンプルに）
      const { data: slots, error: slotsError } = await supabase
        .from("gacha_slots")
        .select("id, card_id, gacha_id")
        .eq("user_id", user.id)
        .eq("is_drawn", true);

      console.log("[Inventory] Slots query result:");
      console.log("[Inventory] - Error:", slotsError);
      console.log("[Inventory] - Count:", slots?.length ?? 0);
      console.log("[Inventory] - Data:", JSON.stringify(slots?.slice(0, 3)));

      if (slotsError) {
        console.error("[Inventory] Slots error:", slotsError);
        throw slotsError;
      }
      if (!slots || slots.length === 0) return [];

      // すでにアクション登録済みのスロットIDを取得
      const { data: actions, error: actionsError } = await supabase
        .from("inventory_actions")
        .select("slot_id")
        .eq("user_id", user.id);

      if (actionsError) throw actionsError;

      const actionSlotIds = new Set(actions?.map(a => a.slot_id) || []);

      // 未選択のスロットをフィルタリング
      const unselectedSlots = slots.filter(slot => !actionSlotIds.has(slot.id));
      
      if (unselectedSlots.length === 0) return [];

      // カード情報をcards_publicビューから取得
      const cardIds = [...new Set(unselectedSlots.map(s => s.card_id).filter(Boolean))] as string[];
      const { data: cardsData, error: cardsError } = await supabase
        .from("cards_public")
        .select("id, name, image_url, prize_tier, conversion_points")
        .in("id", cardIds);

      if (cardsError) throw cardsError;

      const cardsMap = new Map(cardsData?.map(c => [c.id, c]) || []);

      // ガチャタイトルを取得
      const gachaIds = [...new Set(unselectedSlots.map(s => s.gacha_id).filter(Boolean))];
      const { data: gachasData } = await supabase
        .from("gacha_masters")
        .select("id, title")
        .in("id", gachaIds);

      const gachaMap = new Map(gachasData?.map(g => [g.id, g.title]) || []);

      // 未選択のアイテムをマッピング
      const unselected = unselectedSlots.map(slot => {
        const card = cardsMap.get(slot.card_id);
        return {
          id: slot.id,
          slotId: slot.id,
          cardId: card?.id || slot.card_id || "",
          cardName: card?.name || "不明",
          cardImageUrl: card?.image_url || null,
          prizeTier: card?.prize_tier || "miss",
          conversionPoints: card?.conversion_points || 0,
          gachaTitle: gachaMap.get(slot.gacha_id) || "不明",
          actionType: null,
          status: null,
          trackingNumber: null,
          requestedAt: null,
          processedAt: null,
        } as InventoryItem;
      });

      return unselected;
    },
    enabled: !!user,
  });

  // 発送待ちのアイテムを取得
  const { data: pendingItems, isLoading: isLoadingPending } = useQuery({
    queryKey: ["inventory-pending", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("inventory_actions")
        .select("*, slot_id")
        .eq("user_id", user.id)
        .eq("action_type", "shipping")
        .in("status", ["pending", "processing"])
        .order("requested_at", { ascending: false });

      if (error) throw error;
      if (!data || data.length === 0) return [];

      // スロットからガチャIDを取得
      const slotIds = [...new Set(data.map(a => a.slot_id).filter(Boolean))] as string[];
      const { data: slotsData } = await supabase
        .from("gacha_slots")
        .select("id, gacha_id")
        .in("id", slotIds);

      const slotToGachaMap = new Map(slotsData?.map(s => [s.id, s.gacha_id]) || []);

      // ガチャタイトルを取得
      const gachaIds = [...new Set(slotsData?.map(s => s.gacha_id).filter(Boolean) || [])];
      const { data: gachasData } = await supabase
        .from("gacha_masters")
        .select("id, title")
        .in("id", gachaIds);

      const gachaMap = new Map(gachasData?.map(g => [g.id, g.title]) || []);

      // カード情報をcards_publicビューから取得
      const cardIds = [...new Set(data.map(a => a.card_id).filter(Boolean))] as string[];
      const { data: cardsData, error: cardsError } = await supabase
        .from("cards_public")
        .select("id, name, image_url, prize_tier, conversion_points")
        .in("id", cardIds);

      if (cardsError) throw cardsError;

      const cardsMap = new Map(cardsData?.map(c => [c.id, c]) || []);

      return data.map(item => {
        const card = cardsMap.get(item.card_id);
        const gachaId = slotToGachaMap.get(item.slot_id);
        return {
          id: item.id,
          slotId: item.slot_id || "",
          cardId: card?.id || item.card_id || "",
          cardName: card?.name || "不明",
          cardImageUrl: card?.image_url || null,
          prizeTier: card?.prize_tier || "miss",
          conversionPoints: card?.conversion_points || 0,
          gachaTitle: gachaId ? gachaMap.get(gachaId) || "不明" : "不明",
          actionType: item.action_type as "shipping",
          status: item.status,
          trackingNumber: item.tracking_number,
          requestedAt: item.requested_at,
          processedAt: item.processed_at,
        } as InventoryItem;
      });
    },
    enabled: !!user,
  });

  // 発送済みのアイテムを取得
  const { data: shippedItems, isLoading: isLoadingShipped } = useQuery({
    queryKey: ["inventory-shipped", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("inventory_actions")
        .select("*, slot_id")
        .eq("user_id", user.id)
        .eq("action_type", "shipping")
        .eq("status", "shipped")
        .order("processed_at", { ascending: false });

      if (error) throw error;
      if (!data || data.length === 0) return [];

      // スロットからガチャIDを取得
      const slotIds = [...new Set(data.map(a => a.slot_id).filter(Boolean))] as string[];
      const { data: slotsData } = await supabase
        .from("gacha_slots")
        .select("id, gacha_id")
        .in("id", slotIds);

      const slotToGachaMap = new Map(slotsData?.map(s => [s.id, s.gacha_id]) || []);

      // ガチャタイトルを取得
      const gachaIds = [...new Set(slotsData?.map(s => s.gacha_id).filter(Boolean) || [])];
      const { data: gachasData } = await supabase
        .from("gacha_masters")
        .select("id, title")
        .in("id", gachaIds);

      const gachaMap = new Map(gachasData?.map(g => [g.id, g.title]) || []);

      // カード情報をcards_publicビューから取得
      const cardIds = [...new Set(data.map(a => a.card_id).filter(Boolean))] as string[];
      const { data: cardsData, error: cardsError } = await supabase
        .from("cards_public")
        .select("id, name, image_url, prize_tier, conversion_points")
        .in("id", cardIds);

      if (cardsError) throw cardsError;

      const cardsMap = new Map(cardsData?.map(c => [c.id, c]) || []);

      return data.map(item => {
        const card = cardsMap.get(item.card_id);
        const gachaId = slotToGachaMap.get(item.slot_id);
        return {
          id: item.id,
          slotId: item.slot_id || "",
          cardId: card?.id || item.card_id || "",
          cardName: card?.name || "不明",
          cardImageUrl: card?.image_url || null,
          prizeTier: card?.prize_tier || "miss",
          conversionPoints: card?.conversion_points || 0,
          gachaTitle: gachaId ? gachaMap.get(gachaId) || "不明" : "不明",
          actionType: item.action_type as "shipping",
          status: item.status,
          trackingNumber: item.tracking_number,
          requestedAt: item.requested_at,
          processedAt: item.processed_at,
        } as InventoryItem;
      });
    },
    enabled: !!user,
  });

  // 発送依頼ミューテーション
  const requestShippingMutation = useMutation({
    mutationFn: async (item: InventoryItem) => {
      const { error } = await supabase
        .from("inventory_actions")
        .insert({
          user_id: user!.id,
          slot_id: item.slotId,
          card_id: item.cardId,
          action_type: "shipping",
          status: "pending",
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-unselected"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-pending"] });
      toast.success("発送依頼を受付しました");
    },
    onError: (error) => {
      toast.error("エラー: " + error.message);
    },
  });

  // 発送依頼のハンドラ（住所チェック付き）
  const handleRequestShipping = (item: InventoryItem) => {
    if (!hasCompleteAddress) {
      setShowAddressDialog(true);
      return;
    }
    requestShippingMutation.mutate(item);
  };

  // ポイント変換ミューテーション
  const convertToPointsMutation = useMutation({
    mutationFn: async (item: InventoryItem) => {
      // アクション登録
      const { error: actionError } = await supabase
        .from("inventory_actions")
        .insert({
          user_id: user!.id,
          slot_id: item.slotId,
          card_id: item.cardId,
          action_type: "conversion",
          status: "completed",
          converted_points: item.conversionPoints,
          processed_at: new Date().toISOString(),
        });
      if (actionError) throw actionError;

      // ポイント追加
      const { data: profile, error: fetchError } = await supabase
        .from("profiles")
        .select("points_balance")
        .eq("user_id", user!.id)
        .single();
      if (fetchError) throw fetchError;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ points_balance: (profile?.points_balance || 0) + item.conversionPoints })
        .eq("user_id", user!.id);
      if (updateError) throw updateError;

      return item.conversionPoints;
    },
    onSuccess: (points) => {
      queryClient.invalidateQueries({ queryKey: ["inventory-unselected"] });
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      queryClient.invalidateQueries({ queryKey: ["user-profile-header"] });
      toast.success(`${points.toLocaleString()}ptを獲得しました`);
    },
    onError: (error) => {
      toast.error("エラー: " + error.message);
    },
  });

  // 一括ポイント変換（Edge Function使用で高速化）
  const handleBulkConvert = async () => {
    if (!unselectedItems || unselectedItems.length === 0) return;
    
    setIsBulkConverting(true);
    try {
      // Edge Functionに一括処理を依頼
      const items = unselectedItems.map(item => ({
        slotId: item.slotId,
        cardId: item.cardId,
        conversionPoints: item.conversionPoints,
      }));

      const { data, error } = await supabase.functions.invoke("bulk-convert-points", {
        body: { items },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      queryClient.invalidateQueries({ queryKey: ["inventory-unselected"] });
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      queryClient.invalidateQueries({ queryKey: ["user-profile-header"] });
      toast.success(`${data.convertedCount}件を一括変換！ ${data.totalPoints.toLocaleString()}ptを獲得しました`);
    } catch (error: any) {
      toast.error("エラー: " + error.message);
    } finally {
      setIsBulkConverting(false);
    }
  };

  // 一括ポイント合計を計算
  const totalConversionPoints = unselectedItems?.reduce((sum, item) => sum + item.conversionPoints, 0) || 0;

  const renderItemCard = (item: InventoryItem, showActions: boolean = false) => (
    <div
      key={item.id}
      className="bg-card border border-border rounded-lg p-3 flex items-center gap-3"
    >
      {/* カード画像 */}
      <div className="w-16 h-20 rounded overflow-hidden flex-shrink-0">
        {item.cardImageUrl ? (
          <img src={item.cardImageUrl} alt={item.cardName} className="w-full h-full object-cover" />
        ) : (
          <div className={`w-full h-full ${prizeTierStyles[item.prizeTier]?.bg || "bg-muted"} flex items-center justify-center`}>
            <Package className="h-6 w-6 text-white/70" />
          </div>
        )}
      </div>

      {/* 情報 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 mb-1">
          <Badge className={`${prizeTierStyles[item.prizeTier]?.bg} text-white text-[10px] px-1.5 py-0`}>
            {prizeTierStyles[item.prizeTier]?.label}
          </Badge>
        </div>
        <p className="text-sm font-medium truncate">{item.cardName}</p>
        <p className="text-xs text-muted-foreground truncate">{item.gachaTitle}</p>
        {item.trackingNumber && (
          <p className="text-xs text-primary mt-1">追跡: {item.trackingNumber}</p>
        )}
        {item.status === "pending" && (
          <p className="text-xs text-orange-500 mt-1">発送準備中</p>
        )}
        {item.status === "shipped" && item.processedAt && (
          <p className="text-xs text-green-500 mt-1">
            発送済み ({new Date(item.processedAt).toLocaleDateString("ja-JP")})
          </p>
        )}
      </div>

      {/* アクションボタン */}
      {showActions && (
        <div className="flex flex-col gap-1">
          <Button
            size="sm"
            variant="default"
            className="h-8 text-xs"
            onClick={() => handleRequestShipping(item)}
            disabled={requestShippingMutation.isPending}
          >
            <Truck className="h-3 w-3 mr-1" />
            発送
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={() => convertToPointsMutation.mutate(item)}
            disabled={convertToPointsMutation.isPending}
          >
            <Coins className="h-3 w-3 mr-1" />
            {item.conversionPoints}pt
          </Button>
        </div>
      )}
    </div>
  );

  const isLoading = isLoadingUnselected || isLoadingPending || isLoadingShipped;

  if (!user) {
    return (
      <MainLayout>
        <div className="container px-4 py-6">
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Package className="h-16 w-16 mb-4 opacity-30" />
            <p className="text-sm">ログインしてください</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  // デバッグ情報
  const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const debugInfo = {
    userId: user?.id?.substring(0, 8) + "...",
    email: user?.email,
    isMobile,
    unselectedCount: unselectedItems?.length ?? "loading",
    unselectedError: unselectedError?.message,
    pendingCount: pendingItems?.length ?? "loading",
    shippedCount: shippedItems?.length ?? "loading",
  };

  return (
    <MainLayout>
      <div className="container px-4 py-6">
        <h1 className="text-xl font-bold mb-4">獲得商品</h1>

        {/* デバッグ表示（後で削除） */}
        <div className="bg-yellow-500/20 border border-yellow-500 rounded-lg p-3 mb-4 text-xs">
          <p className="font-bold text-yellow-700 mb-1">🔧 デバッグ情報（開発用）</p>
          <p>ユーザーID: {debugInfo.userId}</p>
          <p>メール: {debugInfo.email}</p>
          <p>モバイル: {debugInfo.isMobile ? "はい" : "いいえ"}</p>
          <p>未選択件数: {debugInfo.unselectedCount}</p>
          {debugInfo.unselectedError && (
            <p className="text-red-500">エラー: {debugInfo.unselectedError}</p>
          )}
          <p>発送待ち: {debugInfo.pendingCount}</p>
          <p>発送済み: {debugInfo.shippedCount}</p>
        </div>

        <Tabs defaultValue="unselected" className="w-full">
          <TabsList className="w-full grid grid-cols-3 bg-muted">
            <TabsTrigger value="unselected" className="text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              未選択
              {(unselectedItems?.length || 0) > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 justify-center">
                  {unselectedItems?.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="pending" className="text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              発送待ち
              {(pendingItems?.length || 0) > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 justify-center">
                  {pendingItems?.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="shipped" className="text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              発送済み
            </TabsTrigger>
          </TabsList>

          <TabsContent value="unselected" className="mt-6">
            {isLoadingUnselected ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (unselectedItems?.length || 0) === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Package className="h-16 w-16 mb-4 opacity-30" />
                <p className="text-sm">未選択の獲得商品がありません</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* 一括ポイント変換ボタン */}
                <div className="bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">一括ポイント変換</p>
                      <p className="text-xs text-muted-foreground">
                        {unselectedItems.length}件 → 合計 {totalConversionPoints.toLocaleString()}pt
                      </p>
                    </div>
                    <Button
                      onClick={handleBulkConvert}
                      disabled={isBulkConverting}
                      className="bg-gradient-to-r from-primary to-secondary"
                    >
                      {isBulkConverting ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Coins className="h-4 w-4 mr-2" />
                      )}
                      全てポイント化
                    </Button>
                  </div>
                </div>

                {/* アイテム一覧 */}
                <div className="space-y-3">
                  {unselectedItems?.map(item => renderItemCard(item, true))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="pending" className="mt-6">
            {isLoadingPending ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (pendingItems?.length || 0) === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Truck className="h-16 w-16 mb-4 opacity-30" />
                <p className="text-sm">発送待ちの商品がありません</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingItems?.map(item => renderItemCard(item, false))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="shipped" className="mt-6">
            {isLoadingShipped ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (shippedItems?.length || 0) === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Check className="h-16 w-16 mb-4 opacity-30" />
                <p className="text-sm">発送済みの商品がありません</p>
              </div>
            ) : (
              <div className="space-y-3">
                {shippedItems?.map(item => renderItemCard(item, false))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* 住所未登録ダイアログ */}
        <AlertDialog open={showAddressDialog} onOpenChange={setShowAddressDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                配送先住所が未登録です
              </AlertDialogTitle>
              <AlertDialogDescription>
                発送依頼を行うには、お届け先住所の登録が必要です。
                マイページから住所を登録してください。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>キャンセル</AlertDialogCancel>
              <AlertDialogAction onClick={() => navigate("/mypage/address")}>
                住所を登録する
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
};

export default Inventory;