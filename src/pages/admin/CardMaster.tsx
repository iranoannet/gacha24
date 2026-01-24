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

const PAGE_SIZE = 100;

export default function CardMaster() {
  const queryClient = useQueryClient();
  const [isCSVOpen, setIsCSVOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [importCategory, setImportCategory] = useState<CardCategory | null>(null);
  const [deleteCategory, setDeleteCategory] = useState<CardCategory | null>(null);
  const [filterCategory, setFilterCategory] = useState<CardCategory | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const [deleteProgress, setDeleteProgress] = useState<{ current: number } | null>(null);

  // カテゴリ別の件数を取得
  const { data: categoryCounts } = useQuery({
    queryKey: ["card-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cards")
        .select("category")
        .is("gacha_id", null);
      if (error) throw error;
      
      const counts: Record<string, number> = { all: 0 };
      data?.forEach((card: any) => {
        const cat = card.category || "uncategorized";
        counts[cat] = (counts[cat] || 0) + 1;
        counts.all++;
      });
      return counts;
    },
  });

  // ページネーション付きでカード取得
  const { data: cardsData, isLoading, isFetching } = useQuery({
    queryKey: ["master-cards", filterCategory, searchQuery, currentPage],
    queryFn: async () => {
      let query = supabase
        .from("cards")
        .select("*", { count: "exact" })
        .is("gacha_id", null);
      
      // カテゴリフィルタ
      if (filterCategory !== "all") {
        query = query.eq("category", filterCategory);
      }
      
      // 検索フィルタ（サーバーサイド）
      if (searchQuery) {
        query = query.ilike("name", `%${searchQuery}%`);
      }
      
      // ページネーション
      const from = currentPage * PAGE_SIZE;
      query = query
        .order("created_at", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);
      
      const { data, error, count } = await query;
      if (error) throw error;
      return { cards: data, totalCount: count || 0 };
    },
    placeholderData: (prev) => prev,
  });

  const cards = cardsData?.cards || [];
  const totalCount = cardsData?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // 検索実行（Enterキーまたはボタン）
  const handleSearch = () => {
    setSearchQuery(searchInput);
    setCurrentPage(0);
  };

  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);

  const importMutation = useMutation({
    mutationFn: async (data: { cardsData: Array<{ name: string; image_url: string; conversion_points: number; category: CardCategory }>; category: CardCategory }) => {
      // 1. 同じカテゴリの既存データをバッチ削除（タイムアウト回避）
      toast.info("既存データを削除中...");
      
      const DELETE_BATCH_SIZE = 100; // URLが長くなりすぎないように小さく
      let deletedCount = 0;
      let hasMore = true;
      
      while (hasMore) {
        // IDのみ取得して削除（効率的）
        const { data: toDelete, error: fetchError } = await supabase
          .from("cards")
          .select("id")
          .eq("category", data.category)
          .is("gacha_id", null)
          .limit(DELETE_BATCH_SIZE);
        
        if (fetchError) throw fetchError;
        
        if (!toDelete || toDelete.length === 0) {
          hasMore = false;
          break;
        }
        
        const idsToDelete = toDelete.map(c => c.id);
        const { error: deleteError } = await supabase
          .from("cards")
          .delete()
          .in("id", idsToDelete);
        
        if (deleteError) throw deleteError;
        
        deletedCount += toDelete.length;
        toast.info(`${deletedCount}件削除完了...`);
        
        if (toDelete.length < DELETE_BATCH_SIZE) {
          hasMore = false;
        }
      }
      
      toast.info(`既存データ ${deletedCount}件を削除しました。新規データを挿入中...`);

      // 2. 新規データをバッチで挿入
      const BATCH_SIZE = 500;
      
      for (let i = 0; i < data.cardsData.length; i += BATCH_SIZE) {
        const batch = data.cardsData.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from("cards").insert(batch);
        if (error) throw error;
        
        setImportProgress({ 
          current: Math.min(i + BATCH_SIZE, data.cardsData.length), 
          total: data.cardsData.length 
        });
      }
      
      setImportProgress(null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["master-cards"] });
      toast.success("商品マスタを更新しました");
      setImportCategory(null);
    },
    onError: (error) => {
      setImportProgress(null);
      toast.error("エラー: " + error.message);
    },
  });

  // カテゴリ一括削除
  const bulkDeleteMutation = useMutation({
    mutationFn: async (category: CardCategory) => {
      const DELETE_BATCH_SIZE = 100;
      let deletedCount = 0;
      let hasMore = true;
      
      while (hasMore) {
        const { data: toDelete, error: fetchError } = await supabase
          .from("cards")
          .select("id")
          .eq("category", category)
          .is("gacha_id", null)
          .limit(DELETE_BATCH_SIZE);
        
        if (fetchError) throw fetchError;
        
        if (!toDelete || toDelete.length === 0) {
          hasMore = false;
          break;
        }
        
        const idsToDelete = toDelete.map(c => c.id);
        const { error: deleteError } = await supabase
          .from("cards")
          .delete()
          .in("id", idsToDelete);
        
        if (deleteError) throw deleteError;
        
        deletedCount += toDelete.length;
        setDeleteProgress({ current: deletedCount });
        
        if (toDelete.length < DELETE_BATCH_SIZE) {
          hasMore = false;
        }
      }
      
      setDeleteProgress(null);
      return deletedCount;
    },
    onSuccess: (deletedCount) => {
      queryClient.invalidateQueries({ queryKey: ["master-cards"] });
      queryClient.invalidateQueries({ queryKey: ["card-counts"] });
      toast.success(`${deletedCount.toLocaleString()}件を削除しました`);
      setIsDeleteOpen(false);
      setDeleteCategory(null);
    },
    onError: (error) => {
      setDeleteProgress(null);
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
      queryClient.invalidateQueries({ queryKey: ["card-counts"] });
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
      // カンマ区切りの数値に対応（例: 110,200 → 110200）
      const pointsStr = pointsIndex >= 0 ? (values[pointsIndex] || "").replace(/,/g, '') : "0";
      const points = parseInt(pointsStr) || 0;

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

    toast.info(`${cardsData.length.toLocaleString()}件の商品を読み込みました。既存データを置き換えます...`);
    setIsCSVOpen(false);
    importMutation.mutate({ cardsData, category: importCategory });
  };

  return (
    <AdminLayout title="商品マスタ">
      <div className="space-y-6">
        <div className="flex gap-2 flex-wrap">
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
                <p className="text-sm text-muted-foreground">
                  ※ 同じカテゴリの既存データは全て置き換えられます
                </p>
              </div>
            </DialogContent>
          </Dialog>

          {/* カテゴリ一括削除ダイアログ */}
          <Dialog open={isDeleteOpen} onOpenChange={(open) => { setIsDeleteOpen(open); if (!open) setDeleteCategory(null); }}>
            <DialogTrigger asChild>
              <Button variant="destructive" className="gap-2">
                <Trash2 className="w-4 h-4" />
                カテゴリ一括削除
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>カテゴリ一括削除</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>削除するカテゴリを選択</Label>
                  <Select
                    value={deleteCategory || ""}
                    onValueChange={(value: CardCategory) => setDeleteCategory(value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="カテゴリを選択" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yugioh">遊戯王 ({categoryCounts?.yugioh?.toLocaleString() || 0}件)</SelectItem>
                      <SelectItem value="pokemon">ポケモン ({categoryCounts?.pokemon?.toLocaleString() || 0}件)</SelectItem>
                      <SelectItem value="weiss">ヴァイスシュバルツ ({categoryCounts?.weiss?.toLocaleString() || 0}件)</SelectItem>
                      <SelectItem value="onepiece">ワンピース ({categoryCounts?.onepiece?.toLocaleString() || 0}件)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {deleteCategory && (
                  <p className="text-sm text-destructive font-medium">
                    ⚠️ {CATEGORY_LABELS[deleteCategory]}の商品マスタ {categoryCounts?.[deleteCategory]?.toLocaleString() || 0}件を全て削除します。この操作は取り消せません。
                  </p>
                )}
                {deleteProgress && (
                  <p className="text-sm text-muted-foreground">
                    削除中... {deleteProgress.current.toLocaleString()}件完了
                  </p>
                )}
                <Button
                  variant="destructive"
                  className="w-full"
                  disabled={!deleteCategory || bulkDeleteMutation.isPending}
                  onClick={() => deleteCategory && bulkDeleteMutation.mutate(deleteCategory)}
                >
                  {bulkDeleteMutation.isPending ? "削除中..." : "削除を実行"}
                </Button>
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
            <div className="flex gap-4 mb-4 flex-wrap">
              <div className="flex-1 min-w-64">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="商品名で検索... (Enterで検索)"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                      className="pl-10"
                    />
                  </div>
                  <Button onClick={handleSearch} variant="secondary">検索</Button>
                </div>
              </div>
              <Select
                value={filterCategory}
                onValueChange={(value: CardCategory | "all") => {
                  setFilterCategory(value);
                  setCurrentPage(0);
                }}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべて ({categoryCounts?.all?.toLocaleString() || 0})</SelectItem>
                  <SelectItem value="yugioh">遊戯王 ({categoryCounts?.yugioh?.toLocaleString() || 0})</SelectItem>
                  <SelectItem value="pokemon">ポケモン ({categoryCounts?.pokemon?.toLocaleString() || 0})</SelectItem>
                  <SelectItem value="weiss">ヴァイス ({categoryCounts?.weiss?.toLocaleString() || 0})</SelectItem>
                  <SelectItem value="onepiece">ワンピ ({categoryCounts?.onepiece?.toLocaleString() || 0})</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 件数表示 */}
            <div className="flex justify-between items-center mb-4 text-sm text-muted-foreground">
              <span>
                {totalCount.toLocaleString()}件中 {currentPage * PAGE_SIZE + 1}〜{Math.min((currentPage + 1) * PAGE_SIZE, totalCount)}件を表示
                {isFetching && " (読み込み中...)"}
              </span>
              {totalPages > 1 && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 0}
                    onClick={() => setCurrentPage(currentPage - 1)}
                  >
                    前へ
                  </Button>
                  <span className="py-1 px-2">{currentPage + 1} / {totalPages}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages - 1}
                    onClick={() => setCurrentPage(currentPage + 1)}
                  >
                    次へ
                  </Button>
                </div>
              )}
            </div>

            {isLoading ? (
              <p className="text-muted-foreground">読み込み中...</p>
            ) : cards.length === 0 ? (
              <p className="text-muted-foreground">
                {totalCount === 0 
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
                  {cards.map((card) => (
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
