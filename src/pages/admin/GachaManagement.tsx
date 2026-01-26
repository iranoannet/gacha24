import { useState, useRef } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Edit, Trash2, Upload, X, ArrowRight, ArrowLeft, Search, Copy } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type GachaMaster = Database["public"]["Tables"]["gacha_masters"]["Row"];
type GachaStatus = Database["public"]["Enums"]["gacha_status"];
type CardRow = Database["public"]["Tables"]["cards"]["Row"];

type PrizeTier = "S" | "A" | "B" | "miss";
type CardCategory = "yugioh" | "pokemon" | "weiss" | "onepiece";

const CATEGORY_LABELS: Record<CardCategory, string> = {
  yugioh: "遊戯王",
  pokemon: "ポケモン",
  weiss: "ヴァイスシュバルツ",
  onepiece: "ワンピース",
};

interface SelectedCardItem {
  card: CardRow;
  quantity: number;
  prizeTier: PrizeTier;
}

export default function GachaManagement() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCopyOpen, setIsCopyOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addTargetGacha, setAddTargetGacha] = useState<GachaMaster | null>(null);
  const [createStep, setCreateStep] = useState<"select" | "configure">("select");
  const [selectedGacha, setSelectedGacha] = useState<GachaMaster | null>(null);
  const [selectedItems, setSelectedItems] = useState<SelectedCardItem[]>([]);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<CardCategory | null>(null);
  const [isCopying, setIsCopying] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const defaultNotice = `【最低保証5pt】
【注意事項】
当たりカード含め、初期傷など一部損傷箇所がある場合がございます。商品の返金・交換はできません。
上記、ご了承の上でご購入をお願い致します。`;

  const [formData, setFormData] = useState({
    title: "",
    price_per_play: 500,
    total_slots: 100,
    banner_url: "",
    pop_image_url: "",
    status: "draft" as GachaStatus,
    category: null as CardCategory | null,
    notice_text: defaultNotice,
    animation_type: "A" as "A" | "B", // A = スロット風, B = カードパック開封風
    fake_s_tier_chance: 15, // フェイク演出確率（0-100%）
  });

  // ガチャ一覧
  const { data: gachas, isLoading } = useQuery({
    queryKey: ["admin-gachas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gacha_masters")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // 商品マスタ（ガチャ未割当）
  const { data: availableCards } = useQuery({
    queryKey: ["available-cards"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cards")
        .select("*")
        .is("gacha_id", null)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // カテゴリと検索でフィルタリング
  const filteredCards = (availableCards || []).filter((card) => {
    // カテゴリフィルタ（選択されている場合のみ）
    if (selectedCategory && (card as any).category !== selectedCategory) {
      return false;
    }
    // 検索フィルタ
    if (searchQuery && !card.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  const createMutation = useMutation({
    mutationFn: async (data: { formData: typeof formData; items: SelectedCardItem[]; bannerFile: File | null }) => {
      let bannerUrl = data.formData.banner_url;

      // バナー画像をアップロード
      if (data.bannerFile) {
        bannerUrl = await uploadBanner(data.bannerFile);
      }

      // 総口数を計算
      const totalSlots = data.items.reduce((sum, item) => sum + item.quantity, 0);

      // 1. ガチャを作成（スロットは後でEdge Functionで一括生成）
      const { data: gacha, error: gachaError } = await supabase
        .from("gacha_masters")
        .insert({
          ...data.formData,
          banner_url: bannerUrl || null,
          total_slots: 0,
          remaining_slots: 0,
        })
        .select()
        .single();
      if (gachaError) throw gachaError;

      // 2. Edge Functionでスロットを一括生成（高速化）
      const { data: session } = await supabase.auth.getSession();
      const response = await supabase.functions.invoke("create-gacha-slots", {
        body: {
          gachaId: gacha.id,
          items: data.items.map((item) => ({
            cardId: item.card.id,
            name: item.card.name,
            imageUrl: item.card.image_url,
            conversionPoints: item.card.conversion_points,
            quantity: item.quantity,
            prizeTier: item.prizeTier,
            category: (item.card as any).category || null,
          })),
        },
      });

      if (response.error) {
        // ガチャを削除（ロールバック）
        await supabase.from("gacha_masters").delete().eq("id", gacha.id);
        throw new Error(response.error.message || "スロット作成に失敗しました");
      }

      return gacha;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-gachas"] });
      queryClient.invalidateQueries({ queryKey: ["available-cards"] });
      setIsCreateOpen(false);
      resetForm();
      toast.success("ガチャを作成しました");
    },
    onError: (error) => {
      toast.error("エラー: " + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data, bannerFile }: { id: string; data: Partial<typeof formData>; bannerFile: File | null }) => {
      let bannerUrl = data.banner_url;

      // バナー画像をアップロード
      if (bannerFile) {
        bannerUrl = await uploadBanner(bannerFile);
      }

      const { error } = await supabase.from("gacha_masters").update({
        ...data,
        banner_url: bannerUrl || null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-gachas"] });
      setSelectedGacha(null);
      resetForm();
      toast.success("ガチャを更新しました");
    },
    onError: (error) => {
      toast.error("エラー: " + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // スロットを削除
      await supabase.from("gacha_slots").delete().eq("gacha_id", id);
      // ガチャに紐付いたカードを削除（複製されたもの）
      await supabase.from("cards").delete().eq("gacha_id", id);
      // ガチャを削除
      const { error } = await supabase.from("gacha_masters").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-gachas"] });
      queryClient.invalidateQueries({ queryKey: ["available-cards"] });
      toast.success("ガチャを削除しました");
    },
    onError: (error) => {
      toast.error("エラー: " + error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      price_per_play: 500,
      total_slots: 100,
      banner_url: "",
      pop_image_url: "",
      status: "draft",
      category: null,
      notice_text: defaultNotice,
      animation_type: "A",
      fake_s_tier_chance: 15,
    });
    setSelectedItems([]);
    setBannerFile(null);
    setBannerPreview(null);
    setCreateStep("select");
    setSearchQuery("");
    setSelectedCategory(null);
  };

  // 下書きパックに商品を追加
  const handleOpenAddDialog = (gacha: GachaMaster) => {
    if (gacha.status !== "draft") {
      toast.error("下書き状態のパックのみ追加可能です");
      return;
    }
    setAddTargetGacha(gacha);
    setSelectedCategory((gacha as any).category || null);
    setSelectedItems([]);
    setSearchQuery("");
    setIsAddOpen(true);
  };

  const handleAddToGacha = async () => {
    if (!addTargetGacha || selectedItems.length === 0) return;
    
    setIsAdding(true);
    try {
      // Edge Functionでスロットを追加
      const response = await supabase.functions.invoke("create-gacha-slots", {
        body: {
          gachaId: addTargetGacha.id,
          items: selectedItems.map((item) => ({
            cardId: item.card.id,
            name: item.card.name,
            imageUrl: item.card.image_url,
            conversionPoints: item.card.conversion_points,
            quantity: item.quantity,
            prizeTier: item.prizeTier,
            category: (item.card as any).category || null,
          })),
          appendMode: true, // 追加モード
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "スロット追加に失敗しました");
      }

      queryClient.invalidateQueries({ queryKey: ["admin-gachas"] });
      queryClient.invalidateQueries({ queryKey: ["available-cards"] });
      setIsAddOpen(false);
      setAddTargetGacha(null);
      setSelectedItems([]);
      toast.success("商品を追加しました");
    } catch (error) {
      toast.error("エラー: " + (error as Error).message);
    } finally {
      setIsAdding(false);
    }
  };

  // 過去パックからコピー
  const handleCopyFromGacha = async (gachaId: string) => {
    setIsCopying(true);
    try {
      // ガチャ情報を取得
      const { data: gacha, error: gachaError } = await supabase
        .from("gacha_masters")
        .select("*")
        .eq("id", gachaId)
        .single();
      
      if (gachaError) throw gachaError;

      // そのガチャに紐付いたカード情報を取得（スロットから集計）
      const { data: slots, error: slotsError } = await supabase
        .from("gacha_slots")
        .select("card_id")
        .eq("gacha_id", gachaId);
      
      if (slotsError) throw slotsError;

      // card_idごとにカウント
      const cardCounts: Record<string, number> = {};
      slots?.forEach((slot) => {
        if (slot.card_id) {
          cardCounts[slot.card_id] = (cardCounts[slot.card_id] || 0) + 1;
        }
      });

      // カード情報を取得（ガチャに紐付いたカード）
      const cardIds = Object.keys(cardCounts);
      if (cardIds.length === 0) {
        toast.error("このパックには商品がありません");
        setIsCopying(false);
        return;
      }

      const { data: gachaCards, error: cardsError } = await supabase
        .from("cards")
        .select("*")
        .in("id", cardIds);
      
      if (cardsError) throw cardsError;

      // 商品マスタから同じ名前・カテゴリのカードを探して画像URLを取得
      const cardNames = [...new Set((gachaCards || []).map(c => c.name))];
      const gachaCategory = (gacha as any).category;
      
      let masterCards: any[] = [];
      if (cardNames.length > 0 && gachaCategory) {
        const { data: masters } = await supabase
          .from("cards")
          .select("*")
          .is("gacha_id", null)
          .eq("category", gachaCategory)
          .in("name", cardNames);
        masterCards = masters || [];
      }

      // 名前でマスターカードをマップ
      const masterCardMap: Record<string, any> = {};
      masterCards.forEach(card => {
        if (!masterCardMap[card.name]) {
          masterCardMap[card.name] = card;
        }
      });

      // SelectedCardItemの形式に変換（マスタがあればそちらを使用）
      const copiedItems: SelectedCardItem[] = (gachaCards || []).map((gachaCard) => {
        const masterCard = masterCardMap[gachaCard.name];
        const cardToUse = masterCard || gachaCard;
        return {
          card: {
            ...cardToUse,
            // マスタがあればそのimage_urlを使う、なければガチャカードのを使う
            image_url: masterCard?.image_url || gachaCard.image_url || "",
          },
          quantity: cardCounts[gachaCard.id] || 1,
          prizeTier: (gachaCard.prize_tier as PrizeTier) || "miss",
        };
      });

      // フォームにセット
      setFormData({
        title: gacha.title + "（コピー）",
        price_per_play: gacha.price_per_play,
        total_slots: 100,
        banner_url: gacha.banner_url || "",
        pop_image_url: gacha.pop_image_url || "",
        status: "draft",
        category: (gacha as any).category || null,
        notice_text: (gacha as any).notice_text || defaultNotice,
        animation_type: (gacha as any).animation_type || "A",
        fake_s_tier_chance: (gacha as any).fake_s_tier_chance ?? 15,
      });
      setSelectedCategory((gacha as any).category || null);
      setSelectedItems(copiedItems);
      setBannerPreview(gacha.banner_url || null);
      setCreateStep("configure");
      setIsCopyOpen(false);
      setIsCreateOpen(true);
      
      toast.success(`${gacha.title}の構成をコピーしました`);
    } catch (error) {
      toast.error("コピーに失敗しました: " + (error as Error).message);
    } finally {
      setIsCopying(false);
    }
  };

  const handleEdit = (gacha: GachaMaster) => {
    setSelectedGacha(gacha);
    setFormData({
      title: gacha.title,
      price_per_play: gacha.price_per_play,
      total_slots: gacha.total_slots,
      banner_url: gacha.banner_url || "",
      pop_image_url: gacha.pop_image_url || "",
      status: gacha.status,
      category: (gacha as any).category || null,
      notice_text: (gacha as any).notice_text || defaultNotice,
      animation_type: (gacha as any).animation_type || "A",
      fake_s_tier_chance: (gacha as any).fake_s_tier_chance ?? 15,
    });
    setBannerFile(null);
    setBannerPreview(gacha.banner_url || null);
  };

  const handleFileSelect = (file: File | null) => {
    if (file) {
      setBannerFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setBannerPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadBanner = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = fileName;

    const { error: uploadError } = await supabase.storage
      .from('gacha-banners')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from('gacha-banners')
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  const removeBannerPreview = () => {
    setBannerFile(null);
    setBannerPreview(null);
    setFormData({ ...formData, banner_url: "" });
  };

  const addCardToSelection = (card: CardRow) => {
    // 既に選択済みかチェック
    if (selectedItems.some(item => item.card.id === card.id)) {
      toast.error("この商品は既に選択されています");
      return;
    }
    setSelectedItems([...selectedItems, { card, quantity: 1, prizeTier: "miss" }]);
  };

  const removeCardFromSelection = (cardId: string) => {
    setSelectedItems(selectedItems.filter(item => item.card.id !== cardId));
  };

  const updateItemQuantity = (cardId: string, quantity: number) => {
    if (quantity < 1) quantity = 1;
    if (quantity > 9999) quantity = 9999;
    setSelectedItems(selectedItems.map(item =>
      item.card.id === cardId ? { ...item, quantity } : item
    ));
  };

  const updateItemPrizeTier = (cardId: string, prizeTier: PrizeTier) => {
    setSelectedItems(selectedItems.map(item =>
      item.card.id === cardId ? { ...item, prizeTier } : item
    ));
  };

  const getTotalSlots = () => selectedItems.reduce((sum, item) => sum + item.quantity, 0);

  const getPrizeTierLabel = (tier: PrizeTier) => {
    switch (tier) {
      case "S": return "S賞";
      case "A": return "A賞";
      case "B": return "B賞";
      case "miss": return "ハズレ";
    }
  };

  const getPrizeTierBadgeVariant = (tier: PrizeTier): "default" | "secondary" | "destructive" | "outline" => {
    switch (tier) {
      case "S": return "destructive";
      case "A": return "default";
      case "B": return "secondary";
      case "miss": return "outline";
    }
  };

  const getStatusBadge = (status: GachaStatus) => {
    const styles: Record<GachaStatus, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      draft: { variant: "secondary", label: "下書き" },
      active: { variant: "default", label: "公開中" },
      sold_out: { variant: "destructive", label: "完売" },
      archived: { variant: "outline", label: "アーカイブ" },
    };
    const style = styles[status];
    return <Badge variant={style.variant}>{style.label}</Badge>;
  };

  return (
    <AdminLayout title="ガチャ管理">
      <div className="space-y-6">
        <div className="flex gap-2">
          <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                新規作成
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                新規ガチャ作成 - {createStep === "select" ? "商品選択" : "枚数・賞設定"}
              </DialogTitle>
            </DialogHeader>
            
            {createStep === "select" ? (
              <div className="space-y-6">
                {/* カテゴリ選択 */}
                <div className="space-y-2">
                  <Label>カテゴリを選択（必須）</Label>
                  <Select
                    value={selectedCategory || ""}
                    onValueChange={(value: CardCategory) => {
                      setSelectedCategory(value);
                      setFormData({ ...formData, category: value });
                      setSelectedItems([]); // カテゴリ変更時は選択をリセット
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="カテゴリを選択してください" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yugioh">遊戯王</SelectItem>
                      <SelectItem value="pokemon">ポケモン</SelectItem>
                      <SelectItem value="weiss">ヴァイスシュバルツ</SelectItem>
                      <SelectItem value="onepiece">ワンピース</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* 選択済み商品サマリー */}
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">選択済み: {selectedItems.length}種類 / 合計{getTotalSlots()}枚</span>
                    <Button
                      onClick={() => setCreateStep("configure")}
                      disabled={selectedItems.length === 0 || !selectedCategory}
                      className="gap-2"
                    >
                      次へ
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* 検索窓 */}
                {selectedCategory && (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="商品名で検索..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                )}

                {/* 商品選択リスト */}
                <div className="space-y-4">
                  <h3 className="font-semibold">商品マスタから選択</h3>
                  {!selectedCategory ? (
                    <p className="text-sm text-muted-foreground">
                      まずカテゴリを選択してください。
                    </p>
                  ) : filteredCards.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {searchQuery ? "検索結果がありません。" : "このカテゴリに商品がありません。商品マスタからインポートしてください。"}
                    </p>
                  ) : (
                    <div className="border rounded-lg max-h-80 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>商品名</TableHead>
                            <TableHead className="w-24">ポイント</TableHead>
                            <TableHead className="w-24">操作</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredCards.map((card) => {
                            const isSelected = selectedItems.some(item => item.card.id === card.id);
                            return (
                              <TableRow key={card.id} className={isSelected ? "bg-muted/50" : ""}>
                                <TableCell className="font-medium">{card.name}</TableCell>
                                <TableCell>{card.conversion_points.toLocaleString()}pt</TableCell>
                                <TableCell>
                                  {isSelected ? (
                                    <Badge variant="secondary">選択済</Badge>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => addCardToSelection(card)}
                                    >
                                      <Plus className="w-4 h-4" />
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>

                {/* 選択済み商品一覧 */}
                {selectedItems.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="font-semibold">選択済み商品</h3>
                    <div className="border rounded-lg max-h-48 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>商品名</TableHead>
                            <TableHead className="w-24">操作</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedItems.map((item) => (
                            <TableRow key={item.card.id}>
                              <TableCell className="font-medium">{item.card.name}</TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => removeCardFromSelection(item.card.id)}
                                >
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                {/* 戻るボタン */}
                <Button variant="outline" onClick={() => setCreateStep("select")} className="gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  商品選択に戻る
                </Button>

                {/* 基本情報 */}
                <div className="space-y-4">
                  <h3 className="font-semibold">基本情報</h3>
                  <div>
                    <Label htmlFor="title">タイトル</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="ポケモンカード 151オリパ"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="price">1回の価格 (pt)</Label>
                      <Input
                        id="price"
                        type="number"
                        value={formData.price_per_play}
                        onChange={(e) => setFormData({ ...formData, price_per_play: parseInt(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label>総口数</Label>
                      <Input value={getTotalSlots()} disabled />
                    </div>
                  </div>
                  <div>
                    <Label>バナー画像</Label>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                    />
                    {bannerPreview ? (
                      <div className="relative mt-2">
                        <img
                          src={bannerPreview}
                          alt="バナープレビュー"
                          className="w-full h-32 object-cover rounded-lg border"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2 h-6 w-6"
                          onClick={removeBannerPreview}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full mt-2 gap-2"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="h-4 w-4" />
                        画像をアップロード
                      </Button>
                    )}
                  </div>
                  
                  {/* 演出タイプ選択 */}
                  <div>
                    <Label>演出タイプ</Label>
                    <Select
                      value={formData.animation_type}
                      onValueChange={(value: "A" | "B") => setFormData({ ...formData, animation_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A">A演出（スロットマシン風）</SelectItem>
                        <SelectItem value="B">B演出（カードパック開封風）</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formData.animation_type === "A" 
                        ? "従来のスロットマシン風の演出です" 
                        : "カードパックが破れて中からカードが飛び出す演出です"}
                    </p>
                  </div>
                  
                  {/* フェイク演出確率（B演出時のみ） */}
                  {formData.animation_type === "B" && (
                    <div>
                      <Label>フェイク演出確率: {formData.fake_s_tier_chance}%</Label>
                      <input
                        type="range"
                        min={0}
                        max={50}
                        value={formData.fake_s_tier_chance}
                        onChange={(e) => setFormData({ ...formData, fake_s_tier_chance: parseInt(e.target.value) })}
                        className="w-full mt-2"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        ハズレでもS賞風の演出が出る確率（ドキドキ演出）
                      </p>
                    </div>
                  )}
                </div>

                {/* 商品ごとの枚数・賞設定 */}
                <div className="space-y-4">
                  <h3 className="font-semibold">商品ごとの枚数・賞設定</h3>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>商品名</TableHead>
                          <TableHead className="w-28">ポイント</TableHead>
                          <TableHead className="w-32">枚数</TableHead>
                          <TableHead className="w-32">賞</TableHead>
                          <TableHead className="w-16">削除</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedItems.map((item) => (
                          <TableRow key={item.card.id}>
                            <TableCell className="font-medium text-sm">{item.card.name}</TableCell>
                            <TableCell>{item.card.conversion_points.toLocaleString()}pt</TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min={1}
                                max={9999}
                                value={item.quantity}
                                onChange={(e) => updateItemQuantity(item.card.id, parseInt(e.target.value) || 1)}
                                className="w-24"
                              />
                            </TableCell>
                            <TableCell>
                              <Select
                                value={item.prizeTier}
                                onValueChange={(value: PrizeTier) => updateItemPrizeTier(item.card.id, value)}
                              >
                                <SelectTrigger className="w-28">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="S">S賞</SelectItem>
                                  <SelectItem value="A">A賞</SelectItem>
                                  <SelectItem value="B">B賞</SelectItem>
                                  <SelectItem value="miss">ハズレ</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => removeCardFromSelection(item.card.id)}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <Button
                  className="w-full"
                  onClick={() => createMutation.mutate({ formData, items: selectedItems, bannerFile })}
                  disabled={createMutation.isPending || !formData.title || selectedItems.length === 0}
                >
                  {createMutation.isPending ? "作成中..." : `${getTotalSlots()}口のガチャを作成`}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* 過去パックからコピーダイアログ */}
        <Dialog open={isCopyOpen} onOpenChange={setIsCopyOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Copy className="w-4 h-4" />
              過去パックからコピー
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[70vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>過去パックからコピー</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                コピーしたいパックを選択してください。商品構成と設定がコピーされます。
              </p>
              {isLoading ? (
                <p className="text-muted-foreground">読み込み中...</p>
              ) : gachas?.length === 0 ? (
                <p className="text-muted-foreground">コピー可能なパックがありません</p>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>タイトル</TableHead>
                        <TableHead>価格</TableHead>
                        <TableHead>総口数</TableHead>
                        <TableHead>作成日</TableHead>
                        <TableHead className="w-24">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {gachas?.map((gacha) => (
                        <TableRow key={gacha.id}>
                          <TableCell className="font-medium">{gacha.title}</TableCell>
                          <TableCell>{gacha.price_per_play.toLocaleString()}pt</TableCell>
                          <TableCell>{gacha.total_slots}口</TableCell>
                          <TableCell>
                            {new Date(gacha.created_at).toLocaleDateString("ja-JP")}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1"
                              disabled={isCopying}
                              onClick={() => handleCopyFromGacha(gacha.id)}
                            >
                              <Copy className="w-3 h-3" />
                              コピー
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

        <Card>
          <CardHeader>
            <CardTitle>ガチャ一覧</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">読み込み中...</p>
            ) : gachas?.length === 0 ? (
              <p className="text-muted-foreground">ガチャがありません</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>タイトル</TableHead>
                    <TableHead>価格</TableHead>
                    <TableHead>残り/総口数</TableHead>
                    <TableHead>ステータス</TableHead>
                    <TableHead>作成日</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gachas?.map((gacha) => (
                    <TableRow key={gacha.id}>
                      <TableCell className="font-medium">{gacha.title}</TableCell>
                      <TableCell>{gacha.price_per_play.toLocaleString()}pt</TableCell>
                      <TableCell>
                        {gacha.remaining_slots}/{gacha.total_slots}
                      </TableCell>
                      <TableCell>{getStatusBadge(gacha.status)}</TableCell>
                      <TableCell>
                        {new Date(gacha.created_at).toLocaleDateString("ja-JP")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {gacha.status === "draft" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenAddDialog(gacha)}
                              title="商品を追加"
                            >
                              <Plus className="w-4 h-4 text-primary" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(gacha)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm("本当に削除しますか？関連する商品も削除されます。")) {
                                deleteMutation.mutate(gacha.id);
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* 編集ダイアログ */}
        <Dialog open={!!selectedGacha} onOpenChange={(open) => !open && setSelectedGacha(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>ガチャ編集</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-title">タイトル</Label>
                <Input
                  id="edit-title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-price">1回の価格 (pt)</Label>
                <Input
                  id="edit-price"
                  type="number"
                  value={formData.price_per_play}
                  onChange={(e) => setFormData({ ...formData, price_per_play: parseInt(e.target.value) })}
                />
              </div>
              <div>
                <Label>バナー画像</Label>
                <input
                  type="file"
                  ref={editFileInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                />
                {bannerPreview ? (
                  <div className="relative mt-2">
                    <img
                      src={bannerPreview}
                      alt="バナープレビュー"
                      className="w-full h-32 object-cover rounded-lg border"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-6 w-6"
                      onClick={removeBannerPreview}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full mt-2 gap-2"
                    onClick={() => editFileInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4" />
                    画像をアップロード
                  </Button>
                )}
              </div>
              
              {/* 演出タイプ選択 */}
              <div>
                <Label>演出タイプ</Label>
                <Select
                  value={formData.animation_type}
                  onValueChange={(value: "A" | "B") => setFormData({ ...formData, animation_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">A演出（スロットマシン風）</SelectItem>
                    <SelectItem value="B">B演出（カードパック開封風）</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  {formData.animation_type === "A" 
                    ? "従来のスロットマシン風の演出です" 
                    : "カードパックが破れて中からカードが飛び出す演出です"}
                </p>
              </div>
              
              {/* フェイク演出確率（B演出時のみ） */}
              {formData.animation_type === "B" && (
                <div>
                  <Label>フェイク演出確率: {formData.fake_s_tier_chance}%</Label>
                  <input
                    type="range"
                    min={0}
                    max={50}
                    value={formData.fake_s_tier_chance}
                    onChange={(e) => setFormData({ ...formData, fake_s_tier_chance: parseInt(e.target.value) })}
                    className="w-full mt-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    ハズレでもS賞風の演出が出る確率（ドキドキ演出）
                  </p>
                </div>
              )}
              <div>
                <Label htmlFor="edit-status">ステータス</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: GachaStatus) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">下書き</SelectItem>
                    <SelectItem value="active">公開中</SelectItem>
                    <SelectItem value="sold_out">完売</SelectItem>
                    <SelectItem value="archived">アーカイブ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-notice">注意書き</Label>
                <textarea
                  id="edit-notice"
                  value={formData.notice_text}
                  onChange={(e) => setFormData({ ...formData, notice_text: e.target.value })}
                  className="w-full min-h-[100px] p-2 text-sm border rounded-md bg-background"
                  placeholder="注意事項を入力..."
                />
              </div>
              <Button
                className="w-full"
                onClick={() =>
                  selectedGacha &&
                  updateMutation.mutate({ id: selectedGacha.id, data: formData, bannerFile })
                }
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? "更新中..." : "更新"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* 商品追加ダイアログ（下書きパック用） */}
        <Dialog open={isAddOpen} onOpenChange={(open) => { 
          setIsAddOpen(open); 
          if (!open) {
            setAddTargetGacha(null);
            setSelectedItems([]);
            setSearchQuery("");
          }
        }}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                商品追加: {addTargetGacha?.title}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <p className="text-sm text-muted-foreground">
                カテゴリ: {addTargetGacha?.category ? CATEGORY_LABELS[addTargetGacha.category as CardCategory] : "未設定"} 
                （現在: {addTargetGacha?.total_slots}口）
              </p>

              {/* 商品検索・選択 */}
              <div className="grid grid-cols-2 gap-4">
                {/* 左: 商品マスタ */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Search className="w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="商品名で検索..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                  <div className="border rounded-lg h-[300px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">画像</TableHead>
                          <TableHead>商品名</TableHead>
                          <TableHead className="w-16">追加</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredCards.filter(c => 
                          !selectedCategory || (c as any).category === selectedCategory
                        ).map((card) => (
                          <TableRow key={card.id}>
                            <TableCell className="p-1">
                              {card.image_url ? (
                                <img 
                                  src={card.image_url} 
                                  alt={card.name}
                                  className="w-10 h-10 object-cover rounded"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                              ) : (
                                <div className="w-10 h-10 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">
                                  No
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="font-medium text-sm truncate max-w-[140px]" title={card.name}>
                              {card.name}
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => addCardToSelection(card)}
                                disabled={selectedItems.some(item => item.card.id === card.id)}
                              >
                                <Plus className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* 右: 選択済み */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">選択済み商品</span>
                    <Badge variant="secondary">追加: {getTotalSlots()}口</Badge>
                  </div>
                  <div className="border rounded-lg h-[300px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">画像</TableHead>
                          <TableHead>商品名</TableHead>
                          <TableHead className="w-16">枚数</TableHead>
                          <TableHead className="w-20">賞</TableHead>
                          <TableHead className="w-10">削除</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedItems.map((item) => (
                          <TableRow key={item.card.id}>
                            <TableCell className="p-1">
                              {item.card.image_url ? (
                                <img 
                                  src={item.card.image_url} 
                                  alt={item.card.name}
                                  className="w-10 h-10 object-cover rounded"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                              ) : (
                                <div className="w-10 h-10 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">
                                  No
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="font-medium text-sm truncate max-w-[100px]" title={item.card.name}>
                              {item.card.name}
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min={1}
                                max={9999}
                                value={item.quantity}
                                onChange={(e) => updateItemQuantity(item.card.id, parseInt(e.target.value) || 1)}
                                className="w-14 h-8 text-sm"
                              />
                            </TableCell>
                            <TableCell>
                              <Select
                                value={item.prizeTier}
                                onValueChange={(value: PrizeTier) => updateItemPrizeTier(item.card.id, value)}
                              >
                                <SelectTrigger className="w-16 h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="S">S賞</SelectItem>
                                  <SelectItem value="A">A賞</SelectItem>
                                  <SelectItem value="B">B賞</SelectItem>
                                  <SelectItem value="miss">ハズレ</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => removeCardFromSelection(item.card.id)}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>

              <Button
                className="w-full"
                onClick={handleAddToGacha}
                disabled={isAdding || selectedItems.length === 0}
              >
                {isAdding ? "追加中..." : `${getTotalSlots()}口を追加`}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
