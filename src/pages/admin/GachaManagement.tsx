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
import { Plus, Edit, Trash2, Upload, X, ArrowRight, ArrowLeft } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type GachaMaster = Database["public"]["Tables"]["gacha_masters"]["Row"];
type GachaStatus = Database["public"]["Enums"]["gacha_status"];
type CardRow = Database["public"]["Tables"]["cards"]["Row"];

type PrizeTier = "S" | "A" | "B" | "miss";

interface SelectedCardItem {
  card: CardRow;
  quantity: number;
  prizeTier: PrizeTier;
}

export default function GachaManagement() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createStep, setCreateStep] = useState<"select" | "configure">("select");
  const [selectedGacha, setSelectedGacha] = useState<GachaMaster | null>(null);
  const [selectedItems, setSelectedItems] = useState<SelectedCardItem[]>([]);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    title: "",
    price_per_play: 500,
    total_slots: 100,
    banner_url: "",
    pop_image_url: "",
    status: "draft" as GachaStatus,
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

  const createMutation = useMutation({
    mutationFn: async (data: { formData: typeof formData; items: SelectedCardItem[]; bannerFile: File | null }) => {
      let bannerUrl = data.formData.banner_url;

      // バナー画像をアップロード
      if (data.bannerFile) {
        bannerUrl = await uploadBanner(data.bannerFile);
      }

      // 総口数を計算
      const totalSlots = data.items.reduce((sum, item) => sum + item.quantity, 0);

      // 1. ガチャを作成
      const { data: gacha, error: gachaError } = await supabase
        .from("gacha_masters")
        .insert({
          ...data.formData,
          banner_url: bannerUrl || null,
          total_slots: totalSlots,
          remaining_slots: totalSlots,
        })
        .select()
        .single();
      if (gachaError) throw gachaError;

      // 2. カードを複製してガチャに紐付け、スロットを生成
      let slotNumber = 1;
      const cardIdsToUpdate: string[] = [];

      for (const item of data.items) {
        // 同じカードを複数枚追加する場合、各枚数分のスロットを作成
        for (let i = 0; i < item.quantity; i++) {
          // 新しいカードレコードを作成（元のカードは商品マスタに残す）
          const { data: newCard, error: cardError } = await supabase
            .from("cards")
            .insert({
              name: item.card.name,
              image_url: item.card.image_url,
              conversion_points: item.card.conversion_points,
              gacha_id: gacha.id,
              prize_tier: item.prizeTier,
            })
            .select()
            .single();
          if (cardError) throw cardError;

          // スロットを生成
          const { error: slotError } = await supabase
            .from("gacha_slots")
            .insert({
              gacha_id: gacha.id,
              card_id: newCard.id,
              slot_number: slotNumber++,
            });
          if (slotError) throw slotError;
        }
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
    });
    setSelectedItems([]);
    setBannerFile(null);
    setBannerPreview(null);
    setCreateStep("select");
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
                {/* 選択済み商品サマリー */}
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">選択済み: {selectedItems.length}種類 / 合計{getTotalSlots()}枚</span>
                    <Button
                      onClick={() => setCreateStep("configure")}
                      disabled={selectedItems.length === 0}
                      className="gap-2"
                    >
                      次へ
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* 商品選択リスト */}
                <div className="space-y-4">
                  <h3 className="font-semibold">商品マスタから選択</h3>
                  {availableCards?.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      利用可能な商品がありません。先に商品マスタからインポートしてください。
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
                          {availableCards?.map((card) => {
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
      </div>
    </AdminLayout>
  );
}
