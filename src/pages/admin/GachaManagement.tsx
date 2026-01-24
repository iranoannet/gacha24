import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, Upload, Edit, Trash2, Eye } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type GachaMaster = Database["public"]["Tables"]["gacha_masters"]["Row"];
type GachaStatus = Database["public"]["Enums"]["gacha_status"];

export default function GachaManagement() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCSVOpen, setIsCSVOpen] = useState(false);
  const [selectedGacha, setSelectedGacha] = useState<GachaMaster | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    price_per_play: 500,
    total_slots: 100,
    banner_url: "",
    pop_image_url: "",
    status: "draft" as GachaStatus,
  });

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

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("gacha_masters").insert({
        ...data,
        remaining_slots: data.total_slots,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-gachas"] });
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
      const { error } = await supabase.from("gacha_masters").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-gachas"] });
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

  const handleCSVImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const lines = text.split("\n").filter((line) => line.trim());
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());

    const cards: Array<{
      id: string;
      name: string;
      image_url: string;
      conversion_points: number;
    }> = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim());
      const card: Record<string, string> = {};
      headers.forEach((header, index) => {
        card[header] = values[index];
      });

      if (!card.id || !card.name) continue;

      cards.push({
        id: card.id,
        name: card.name,
        image_url: card.image_url || "",
        conversion_points: parseInt(card.points) || 0,
      });
    }

    if (cards.length === 0) {
      toast.error("有効なカードデータが見つかりませんでした");
      return;
    }

    toast.success(`${cards.length}種類のカードを読み込みました。ガチャを選択してスロットを生成してください。`);
    setIsCSVOpen(false);
    localStorage.setItem("imported_cards", JSON.stringify(cards));
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
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                新規作成
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>新規ガチャ作成</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
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
                    <Label htmlFor="slots">総口数</Label>
                    <Input
                      id="slots"
                      type="number"
                      value={formData.total_slots}
                      onChange={(e) => setFormData({ ...formData, total_slots: parseInt(e.target.value) })}
                    />
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
                <div>
                  <Label htmlFor="status">ステータス</Label>
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
                  onClick={() => createMutation.mutate(formData)}
                  disabled={createMutation.isPending || !formData.title}
                >
                  {createMutation.isPending ? "作成中..." : "作成"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isCSVOpen} onOpenChange={setIsCSVOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Upload className="w-4 h-4" />
                CSVインポート
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>カードCSVインポート</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  CSVファイルには以下の列が必要です：
                  <br />
                  <code>id, name, image_url, points</code>
                </p>
                <Input
                  type="file"
                  accept=".csv"
                  onChange={handleCSVImport}
                />
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
                              if (confirm("本当に削除しますか？")) {
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

        {/* Edit Dialog */}
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
              <div className="grid grid-cols-2 gap-4">
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
                  <Label htmlFor="edit-slots">総口数</Label>
                  <Input
                    id="edit-slots"
                    type="number"
                    value={formData.total_slots}
                    onChange={(e) => setFormData({ ...formData, total_slots: parseInt(e.target.value) })}
                  />
                </div>
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
