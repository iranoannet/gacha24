import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Upload, Trash2, Package } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function CardMaster() {
  const queryClient = useQueryClient();
  const [isCSVOpen, setIsCSVOpen] = useState(false);

  const { data: cards, isLoading } = useQuery({
    queryKey: ["master-cards"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cards")
        .select("*")
        .is("gacha_id", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const importMutation = useMutation({
    mutationFn: async (cardsData: Array<{ name: string; image_url: string; conversion_points: number }>) => {
      const { error } = await supabase.from("cards").insert(cardsData);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["master-cards"] });
      toast.success("商品マスタをインポートしました");
    },
    onError: (error) => {
      toast.error("エラー: " + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cards").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["master-cards"] });
      toast.success("商品を削除しました");
    },
    onError: (error) => {
      toast.error("エラー: " + error.message);
    },
  });

  const handleCSVImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const lines = text.split("\n").filter((line) => line.trim());
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());

    const cardsData: Array<{ name: string; image_url: string; conversion_points: number }> = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim());
      const card: Record<string, string> = {};
      headers.forEach((header, index) => {
        card[header] = values[index];
      });

      if (!card.name) continue;

      cardsData.push({
        name: card.name,
        image_url: card.image_url || "",
        conversion_points: parseInt(card.points) || 0,
      });
    }

    if (cardsData.length === 0) {
      toast.error("有効な商品データが見つかりませんでした");
      return;
    }

    setIsCSVOpen(false);
    importMutation.mutate(cardsData);
  };

  return (
    <AdminLayout title="商品マスタ">
      <div className="space-y-6">
        <div className="flex gap-2">
          <Dialog open={isCSVOpen} onOpenChange={setIsCSVOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Upload className="w-4 h-4" />
                CSVインポート
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>商品マスタCSVインポート</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  CSVファイルには以下の列が必要です：
                  <br />
                  <code>name, image_url, points</code>
                </p>
                <Input
                  type="file"
                  accept=".csv"
                  onChange={handleCSVImport}
                  disabled={importMutation.isPending}
                />
                {importMutation.isPending && (
                  <p className="text-sm text-muted-foreground">インポート中...</p>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              商品一覧
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">読み込み中...</p>
            ) : cards?.length === 0 ? (
              <p className="text-muted-foreground">商品がありません。CSVからインポートしてください。</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>画像</TableHead>
                    <TableHead>商品名</TableHead>
                    <TableHead>ポイント</TableHead>
                    <TableHead>レアリティ</TableHead>
                    <TableHead>登録日</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cards?.map((card) => (
                    <TableRow key={card.id}>
                      <TableCell>
                        {card.image_url ? (
                          <img
                            src={card.image_url}
                            alt={card.name}
                            className="w-12 h-12 object-cover rounded"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                            <Package className="w-6 h-6 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{card.name}</TableCell>
                      <TableCell>{card.conversion_points.toLocaleString()}pt</TableCell>
                      <TableCell>
                        <Badge variant="outline">{card.rarity}</Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(card.created_at).toLocaleDateString("ja-JP")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm("本当に削除しますか？")) {
                              deleteMutation.mutate(card.id);
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
