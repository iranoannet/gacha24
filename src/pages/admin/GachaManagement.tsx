import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Plus, Edit, Trash2, Package } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type GachaMaster = Database["public"]["Tables"]["gacha_masters"]["Row"];
type GachaStatus = Database["public"]["Enums"]["gacha_status"];
type CardRow = Database["public"]["Tables"]["cards"]["Row"];

export default function GachaManagement() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedGacha, setSelectedGacha] = useState<GachaMaster | null>(null);
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
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
    mutationFn: async (data: { formData: typeof formData; cardIds: string[] }) => {
      // 1. ガチャを作成
      const { data: gacha, error: gachaError } = await supabase
        .from("gacha_masters")
        .insert({
          ...data.formData,
          total_slots: data.cardIds.length,
          remaining_slots: data.cardIds.length,
        })
        .select()
        .single();
      if (gachaError) throw gachaError;

      // 2. 選択した商品をガチャに紐付け
      if (data.cardIds.length > 0) {
        const { error: updateError } = await supabase
          .from("cards")
          .update({ gacha_id: gacha.id })
          .in("id", data.cardIds);
        if (updateError) throw updateError;

        // 3. スロットを生成
        const slots = data.cardIds.map((cardId, index) => ({
          gacha_id: gacha.id,
          card_id: cardId,
          slot_number: index + 1,
        }));
        const { error: slotError } = await supabase.from("gacha_slots").insert(slots);
        if (slotError) throw slotError;
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
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      const { error } = await supabase.from("gacha_masters").update(data).eq("id", id);
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
      // 商品の紐付けを解除
      await supabase.from("cards").update({ gacha_id: null }).eq("gacha_id", id);
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
    setSelectedCards([]);
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
  };

  const toggleCard = (cardId: string) => {
    setSelectedCards((prev) =>
      prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId]
    );
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
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>新規ガチャ作成</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
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
                    <Input value={selectedCards.length} disabled />
                    <p className="text-xs text-muted-foreground mt-1">選択した商品数で自動設定</p>
                  </div>
                </div>
                <div>
                  <Label htmlFor="banner">バナー画像URL</Label>
                  <Input
                    id="banner"
                    value={formData.banner_url}
                    onChange={(e) => setFormData({ ...formData, banner_url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              </div>

              {/* 商品選択 */}
              <div className="space-y-4">
                <h3 className="font-semibold">商品を選択（{selectedCards.length}件選択中）</h3>
                {availableCards?.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    利用可能な商品がありません。先に商品マスタからインポートしてください。
                  </p>
                ) : (
                  <div className="border rounded-lg max-h-64 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">選択</TableHead>
                          <TableHead>商品名</TableHead>
                          <TableHead>ポイント</TableHead>
                          <TableHead>レアリティ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {availableCards?.map((card) => (
                          <TableRow key={card.id} className="cursor-pointer" onClick={() => toggleCard(card.id)}>
                            <TableCell>
                              <Checkbox
                                checked={selectedCards.includes(card.id)}
                                onCheckedChange={() => toggleCard(card.id)}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{card.name}</TableCell>
                            <TableCell>{card.conversion_points.toLocaleString()}pt</TableCell>
                            <TableCell>
                              <Badge variant="outline">{card.rarity}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              <Button
                className="w-full"
                onClick={() => createMutation.mutate({ formData, cardIds: selectedCards })}
                disabled={createMutation.isPending || !formData.title || selectedCards.length === 0}
              >
                {createMutation.isPending ? "作成中..." : `${selectedCards.length}件の商品でガチャを作成`}
              </Button>
            </div>
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
                              if (confirm("本当に削除しますか？関連する商品の紐付けも解除されます。")) {
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
                <Label htmlFor="edit-banner">バナー画像URL</Label>
                <Input
                  id="edit-banner"
                  value={formData.banner_url}
                  onChange={(e) => setFormData({ ...formData, banner_url: e.target.value })}
                />
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
                  updateMutation.mutate({ id: selectedGacha.id, data: formData })
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