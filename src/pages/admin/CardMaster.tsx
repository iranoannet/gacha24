import { useState } from "react";
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
import { Upload, Trash2, Package, Search } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type CardCategory = "yugioh" | "pokemon" | "weiss" | "onepiece";

const CATEGORY_LABELS: Record<CardCategory, string> = {
  yugioh: "遊戯王",
  pokemon: "ポケモン",
  weiss: "ヴァイスシュバルツ",
  onepiece: "ワンピース",
};

export default function CardMaster() {
  const queryClient = useQueryClient();
  const [isCSVOpen, setIsCSVOpen] = useState(false);
  const [importCategory, setImportCategory] = useState<CardCategory | null>(null);
  const [filterCategory, setFilterCategory] = useState<CardCategory | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");

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

  // フィルタリング
  const filteredCards = (cards || []).filter((card) => {
    if (filterCategory !== "all" && (card as any).category !== filterCategory) {
      return false;
    }
    if (searchQuery && !card.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);

  const importMutation = useMutation({
    mutationFn: async (cardsData: Array<{ name: string; image_url: string; conversion_points: number; category: CardCategory }>) => {
      // バッチサイズ（Supabaseの制限を考慮）
      const BATCH_SIZE = 500;
      const totalBatches = Math.ceil(cardsData.length / BATCH_SIZE);
      
      for (let i = 0; i < cardsData.length; i += BATCH_SIZE) {
        const batch = cardsData.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from("cards").insert(batch);
        if (error) throw error;
        
        // 進捗更新
        setImportProgress({ 
          current: Math.min(i + BATCH_SIZE, cardsData.length), 
          total: cardsData.length 
        });
      }
      
      setImportProgress(null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["master-cards"] });
      toast.success("商品マスタをインポートしました");
      setImportCategory(null);
    },
    onError: (error) => {
      setImportProgress(null);
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

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const handleCSVImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!importCategory) {
      toast.error("カテゴリを選択してください");
      return;
    }

    toast.info("CSVファイルを読み込み中...");

    const text = await file.text();
    const lines = text.split("\n").filter((line) => line.trim());
    const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().replace(/^\ufeff/, ''));

    // Find column indices
    const nameIndex = headers.findIndex(h => h === 'name' || h === '商品名' || h === '名前');
    const imageIndex = headers.findIndex(h => h === 'image_url' || h === '画像url' || h === '画像');
    const pointsIndex = headers.findIndex(h => h === 'points' || h === 'ポイント' || h === 'pt' || h === 'conversion_points');

    if (nameIndex === -1) {
      toast.error("「name」または「商品名」列が見つかりません");
      return;
    }

    const cardsData: Array<{ name: string; image_url: string; conversion_points: number; category: CardCategory }> = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      
      const name = values[nameIndex];
      if (!name) continue;

      const image_url = imageIndex >= 0 ? values[imageIndex] || "" : "";
      const points = pointsIndex >= 0 ? parseInt(values[pointsIndex]) || 0 : 0;

      cardsData.push({
        name,
        image_url,
        conversion_points: points,
        category: importCategory,
      });
    }

    if (cardsData.length === 0) {
      toast.error("有効な商品データが見つかりませんでした");
      return;
    }

    toast.success(`${cardsData.length.toLocaleString()}件の商品を読み込みました。インポートを開始します...`);
    setIsCSVOpen(false);
    importMutation.mutate(cardsData);
  };

  return (
    <AdminLayout title="商品マスタ">
      <div className="space-y-6">
        <div className="flex gap-2">
          <Dialog open={isCSVOpen} onOpenChange={(open) => { setIsCSVOpen(open); if (!open) setImportCategory(null); }}>
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
                <div>
                  <Label>カテゴリを選択（必須）</Label>
                  <Select
                    value={importCategory || ""}
                    onValueChange={(value: CardCategory) => setImportCategory(value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="カテゴリを選択" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yugioh">遊戯王</SelectItem>
                      <SelectItem value="pokemon">ポケモン</SelectItem>
                      <SelectItem value="weiss">ヴァイスシュバルツ</SelectItem>
                      <SelectItem value="onepiece">ワンピース</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-sm text-muted-foreground">
                  CSVファイルには以下の列が必要です：
                  <br />
                  <code>name, image_url, points</code>
                </p>
                <Input
                  type="file"
                  accept=".csv"
                  onChange={handleCSVImport}
                  disabled={importMutation.isPending || !importCategory}
                />
                {!importCategory && (
                  <p className="text-sm text-destructive">カテゴリを選択してからファイルを選択してください</p>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* インポート進捗表示 */}
        {importMutation.isPending && importProgress && (
          <Card className="border-primary">
            <CardContent className="py-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <p className="font-medium">インポート中...</p>
                  <p className="text-sm text-muted-foreground">
                    {importProgress.current.toLocaleString()} / {importProgress.total.toLocaleString()} 件完了
                  </p>
                </div>
                <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              商品一覧
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* フィルター */}
            <div className="flex gap-4 mb-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="商品名で検索..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select
                value={filterCategory}
                onValueChange={(value: CardCategory | "all") => setFilterCategory(value)}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべてのカテゴリ</SelectItem>
                  <SelectItem value="yugioh">遊戯王</SelectItem>
                  <SelectItem value="pokemon">ポケモン</SelectItem>
                  <SelectItem value="weiss">ヴァイスシュバルツ</SelectItem>
                  <SelectItem value="onepiece">ワンピース</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <p className="text-muted-foreground">読み込み中...</p>
            ) : filteredCards.length === 0 ? (
              <p className="text-muted-foreground">
                {cards?.length === 0 
                  ? "商品がありません。CSVからインポートしてください。" 
                  : "条件に一致する商品がありません。"}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>画像</TableHead>
                    <TableHead>商品名</TableHead>
                    <TableHead>カテゴリ</TableHead>
                    <TableHead>ポイント</TableHead>
                    <TableHead>登録日</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCards.map((card) => (
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
                      <TableCell>
                        {(card as any).category ? (
                          <Badge variant="outline">{CATEGORY_LABELS[(card as any).category as CardCategory]}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">未設定</span>
                        )}
                      </TableCell>
                      <TableCell>{card.conversion_points.toLocaleString()}pt</TableCell>
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
