import { useState } from "react";
import { useNavigate } from "react-router-dom";
import MainLayout from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Truck, Check, Coins, Loader2, AlertCircle, Clock } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
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
import { ActionConfirmDialog } from "@/components/gacha/ActionConfirmDialog";
import DarkThemeInventory from "./DarkThemeInventory";

// Tenants that use dark theme
const DARK_THEME_TENANTS = ["get24", "get"];

type InventoryAction = Database["public"]["Tables"]["inventory_actions"]["Row"];

const prizeTierStyles: Record<string, { bg: string; label: string }> = {
  S: { bg: "bg-gradient-to-r from-yellow-400 to-orange-500", label: "S賞" },
  A: { bg: "bg-gradient-to-r from-rose-400 to-red-500", label: "A賞" },
  B: { bg: "bg-gradient-to-r from-blue-400 to-purple-500", label: "B賞" },
  miss: { bg: "bg-muted", label: "ハズレ" },
};

// 選択期限表示コンポーネント
const DeadlineDisplay = ({ deadline }: { deadline: string }) => {
  const deadlineDate = new Date(deadline);
  const now = new Date();
  const diffMs = deadlineDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays <= 0) {
    return (
      <p className="text-xs text-destructive mt-1 flex items-center gap-1">
        <Clock className="h-3 w-3" />
        期限切れ（自動ポイント変換待ち）
      </p>
    );
  }
  
  if (diffDays <= 3) {
    return (
      <p className="text-xs text-destructive mt-1 flex items-center gap-1">
        <Clock className="h-3 w-3" />
        期限まで残り{diffDays}日
      </p>
    );
  }
  
  if (diffDays <= 7) {
    return (
      <p className="text-xs text-amber-500 mt-1 flex items-center gap-1">
        <Clock className="h-3 w-3" />
        期限まで残り{diffDays}日
      </p>
    );
  }
  
  return (
    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
      <Clock className="h-3 w-3" />
      期限: {deadlineDate.toLocaleDateString("ja-JP")}
    </p>
  );
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
  selectionDeadline: string | null;
}

const Inventory = () => {
  const { tenantSlug } = useTenant();
  
  // Check if this tenant uses dark theme
  const useDarkTheme = tenantSlug && DARK_THEME_TENANTS.includes(tenantSlug);
  
  if (useDarkTheme) {
    return <DarkThemeInventory />;
  }
  
  return <LightThemeInventory />;
};

const LightThemeInventory = () => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showAddressDialog, setShowAddressDialog] = useState(false);
  const [isBulkConverting, setIsBulkConverting] = useState(false);
  
  // 確認ダイアログ用のstate
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    actionType: "shipping" | "conversion";
    item?: InventoryItem;
    isBulk?: boolean;
  }>({ isOpen: false, actionType: "shipping" });

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
  // テナントでフィルタリング
  const { data: unselectedItems, isLoading: isLoadingUnselected, error: unselectedError } = useQuery({
    queryKey: ["inventory-unselected", user?.id, tenant?.id],
    queryFn: async () => {
      if (!user) {
        console.log("[Inventory] No user, returning empty");
        return [];
      }

      console.log("[Inventory] ====== START FETCH ======");
      console.log("[Inventory] User ID:", user.id);
      console.log("[Inventory] Tenant ID:", tenant?.id);

      // まず現在のテナントのガチャを取得
      let gachaQuery = supabase
        .from("gacha_masters")
        .select("id, title");
      
      if (tenant?.id) {
        gachaQuery = gachaQuery.eq("tenant_id", tenant.id);
      } else {
        gachaQuery = gachaQuery.is("tenant_id", null);
      }
      
      const { data: tenantGachas, error: gachaError } = await gachaQuery;
      if (gachaError) throw gachaError;
      
      // ガチャマップと有効なガチャIDを作成
      const gachaMap = new Map(tenantGachas?.map(g => [g.id, g.title]) || []);
      const validGachaIds = [...gachaMap.keys()];
      
      if (validGachaIds.length === 0) return [];

      // 当選したスロットを取得（テナントのガチャでフィルタ）
      const { data: slots, error: slotsError } = await supabase
        .from("gacha_slots")
        .select("id, card_id, gacha_id, selection_deadline")
        .eq("user_id", user.id)
        .eq("is_drawn", true)
        .in("gacha_id", validGachaIds);

      console.log("[Inventory] Slots query result:");
      console.log("[Inventory] - Error:", slotsError);
      console.log("[Inventory] - Count:", slots?.length ?? 0);

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
          selectionDeadline: (slot as any).selection_deadline || null,
        } as InventoryItem;
      });

      return unselected;
    },
    enabled: !!user,
  });

  // 発送待ちのアイテムを取得（テナントでフィルタ）
  const { data: pendingItems, isLoading: isLoadingPending } = useQuery({
    queryKey: ["inventory-pending", user?.id, tenant?.id],
    queryFn: async () => {
      if (!user) return [];

      // テナントフィルタ付きでクエリ
      let query = supabase
        .from("inventory_actions")
        .select("*, slot_id")
        .eq("user_id", user.id)
        .eq("action_type", "shipping")
        .in("status", ["pending", "processing"])
        .order("requested_at", { ascending: false });
      
      if (tenant?.id) {
        query = query.eq("tenant_id", tenant.id);
      } else {
        query = query.is("tenant_id", null);
      }

      const { data, error } = await query;

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

  // 発送済みのアイテムを取得（テナントでフィルタ）
  const { data: shippedItems, isLoading: isLoadingShipped } = useQuery({
    queryKey: ["inventory-shipped", user?.id, tenant?.id],
    queryFn: async () => {
      if (!user) return [];

      // テナントフィルタ付きでクエリ
      let query = supabase
        .from("inventory_actions")
        .select("*, slot_id")
        .eq("user_id", user.id)
        .eq("action_type", "shipping")
        .eq("status", "shipped")
        .order("processed_at", { ascending: false });
      
      if (tenant?.id) {
        query = query.eq("tenant_id", tenant.id);
      } else {
        query = query.is("tenant_id", null);
      }

      const { data, error } = await query;

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
    setConfirmDialog({ isOpen: true, actionType: "shipping", item });
  };

  // ポイント変換のハンドラ（確認ダイアログ付き）
  const handleConvertToPoints = (item: InventoryItem) => {
    setConfirmDialog({ isOpen: true, actionType: "conversion", item });
  };

  // 一括ポイント変換のハンドラ（確認ダイアログ付き）
  const handleBulkConvertClick = () => {
    setConfirmDialog({ isOpen: true, actionType: "conversion", isBulk: true });
  };

  // 確認ダイアログの確定処理
  const handleConfirmAction = async () => {
    if (confirmDialog.isBulk) {
      setConfirmDialog({ isOpen: false, actionType: "conversion" });
      await handleBulkConvert();
    } else if (confirmDialog.item) {
      if (confirmDialog.actionType === "shipping") {
        requestShippingMutation.mutate(confirmDialog.item);
      } else {
        convertToPointsMutation.mutate(confirmDialog.item);
      }
      setConfirmDialog({ isOpen: false, actionType: "shipping" });
    }
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
          <p className="text-xs text-amber-500 mt-1">発送準備中</p>
        )}
        {item.status === "shipped" && item.processedAt && (
          <p className="text-xs text-emerald-500 mt-1">
            発送済み ({new Date(item.processedAt).toLocaleDateString("ja-JP")})
          </p>
        )}
        {/* 選択期限の表示（未選択アイテムのみ） */}
        {showActions && item.selectionDeadline && (
          <DeadlineDisplay deadline={item.selectionDeadline} />
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
            onClick={() => handleConvertToPoints(item)}
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

  return (
    <MainLayout>
      <div className="container px-4 py-6">
        <h1 className="text-xl font-bold mb-4">獲得商品</h1>

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
                      onClick={handleBulkConvertClick}
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

        {/* アクション確認ダイアログ */}
        <ActionConfirmDialog
          isOpen={confirmDialog.isOpen}
          onConfirm={handleConfirmAction}
          onCancel={() => setConfirmDialog({ isOpen: false, actionType: "shipping" })}
          actionType={confirmDialog.actionType}
          itemCount={confirmDialog.isBulk ? (unselectedItems?.length || 0) : 1}
          totalPoints={
            confirmDialog.isBulk
              ? totalConversionPoints
              : confirmDialog.item?.conversionPoints || 0
          }
          isProcessing={
            confirmDialog.actionType === "shipping"
              ? requestShippingMutation.isPending
              : confirmDialog.isBulk
                ? isBulkConverting
                : convertToPointsMutation.isPending
          }
        />
      </div>
    </MainLayout>
  );
};

export default Inventory;