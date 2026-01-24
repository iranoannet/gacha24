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
import { Upload, Trash2, Package, Search, FileSpreadsheet, RefreshCw } from "lucide-react";
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
  const [isSpreadsheetOpen, setIsSpreadsheetOpen] = useState(false);
  const [spreadsheetUrl, setSpreadsheetUrl] = useState("");
  const [importCategory, setImportCategory] = useState<CardCategory | null>(null);
  const [deleteCategory, setDeleteCategory] = useState<CardCategory | null>(null);
  const [filterCategory, setFilterCategory] = useState<CardCategory | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  

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

  // ページネーション付きでカード取得（検索・フィルタ実行時のみ）
  const [isSearchTriggered, setIsSearchTriggered] = useState(false);
  
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
    enabled: isSearchTriggered, // 検索実行時のみ有効
  });

  const cards = cardsData?.cards || [];
  const totalCount = cardsData?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // 検索実行（Enterキーまたはボタン）
  const handleSearch = () => {
    setSearchQuery(searchInput);
    setCurrentPage(0);
    setIsSearchTriggered(true);
  };
  
  // カテゴリ変更時
  const handleCategoryChange = (value: CardCategory | "all") => {
    setFilterCategory(value);
    setCurrentPage(0);
    setIsSearchTriggered(true);
  };

  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);

  const importMutation = useMutation({
    mutationFn: async (data: { cardsData: Array<{ name: string; image_url: string; conversion_points: number; category: CardCategory }>; category: CardCategory }) => {
      toast.info("データを挿入中...");

      // バッチで挿入
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
      queryClient.invalidateQueries({ queryKey: ["card-counts"] });
      toast.success("商品マスタを追加しました");
      setImportCategory(null);
    },
    onError: (error) => {
      setImportProgress(null);
      toast.error("エラー: " + error.message);
    },
  });

  // カテゴリ一括削除（Edge Function使用）
  const bulkDeleteMutation = useMutation({
    mutationFn: async (category: CardCategory) => {
      const { data, error } = await supabase.functions.invoke("bulk-delete-cards", {
        body: { category },
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data.deletedCount;
    },
    onSuccess: (deletedCount) => {
      queryClient.invalidateQueries({ queryKey: ["master-cards"] });
      queryClient.invalidateQueries({ queryKey: ["card-counts"] });
      toast.success(`${deletedCount?.toLocaleString() || 0}件を削除しました`);
      setIsDeleteOpen(false);
      setDeleteCategory(null);
    },
    onError: (error) => {
      toast.error("エラー: " + error.message);
      setIsDeleteOpen(false);
      setDeleteCategory(null);
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
    const idIndex = headers.findIndex(h => h === 'id' || h === 'カードid' || h === 'カードID');
    const nameIndex = headers.findIndex(h => h === 'name' || h === '商品名' || h === '名前');
    const imageIndex = headers.findIndex(h => h === 'image_url' || h === '画像url' || h === '画像');
    const pointsIndex = headers.findIndex(h => h === 'points' || h === 'ポイント' || h === 'pt' || h === 'conversion_points');

    if (nameIndex === -1) {
      toast.error("「name」または「商品名」列が見つかりません");
      return;
    }

    // 画像URL自動生成用のベースURL（idがある場合に使用）
    const IMAGE_BASE_URL = "https://image.iranoan.com/card/";
    const IMAGE_SUFFIX = "_small.jpg?d=2026012501";

    const cardsData: Array<{ name: string; image_url: string; conversion_points: number; category: CardCategory }> = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      
      const name = values[nameIndex];
      if (!name) continue;

      // 画像URLの決定: id列があれば自動生成、なければimage_url列を使用
      let image_url = "";
      if (idIndex >= 0 && values[idIndex]) {
        // id列から画像URLを自動生成
        const cardId = values[idIndex].trim();
        image_url = `${IMAGE_BASE_URL}${cardId}${IMAGE_SUFFIX}`;
      } else if (imageIndex >= 0) {
        // 従来通りimage_url列を使用
        image_url = values[imageIndex] || "";
      }

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

  // スプレッドシートからインポート
  const handleSpreadsheetImport = async () => {
    if (!spreadsheetUrl) {
      toast.error("スプレッドシートのURLを入力してください");
      return;
    }

    if (!importCategory) {
      toast.error("カテゴリを選択してください");
      return;
    }

    toast.info("スプレッドシートを読み込み中...");

    try {
      // Google SheetsのURLをCSV出力形式に変換
      let csvUrl = spreadsheetUrl;
      
      // 公開URLのパターンを検出して変換
      if (spreadsheetUrl.includes("docs.google.com/spreadsheets")) {
        // /edit や /pubhtml などを /export?format=csv に変換
        const match = spreadsheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (match) {
          const sheetId = match[1];
          // gidパラメータがあれば取得
          const gidMatch = spreadsheetUrl.match(/gid=(\d+)/);
          const gid = gidMatch ? gidMatch[1] : "0";
          csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
        }
      }

      const response = await fetch(csvUrl);
      if (!response.ok) {
        throw new Error("スプレッドシートの取得に失敗しました。公開設定を確認してください。");
      }

      const text = await response.text();
      const lines = text.split("\n").filter((line) => line.trim());
      const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().replace(/^\ufeff/, ''));

      // Find column indices
      const idIndex = headers.findIndex(h => h === 'id' || h === 'カードid' || h === 'カードID');
      const nameIndex = headers.findIndex(h => h === 'name' || h === '商品名' || h === '名前');
      const imageIndex = headers.findIndex(h => h === 'image_url' || h === '画像url' || h === '画像');
      const pointsIndex = headers.findIndex(h => h === 'points' || h === 'ポイント' || h === 'pt' || h === 'conversion_points');

      if (nameIndex === -1) {
        toast.error("「name」または「商品名」列が見つかりません");
        return;
      }

      // 画像URL自動生成用のベースURL（idがある場合に使用）
      const IMAGE_BASE_URL = "https://image.iranoan.com/card/";
      const IMAGE_SUFFIX = "_small.jpg?d=2026012501";

      const cardsData: Array<{ name: string; image_url: string; conversion_points: number; category: CardCategory }> = [];

      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        
        const name = values[nameIndex];
        if (!name) continue;

        // 画像URLの決定: id列があれば自動生成、なければimage_url列を使用
        let image_url = "";
        if (idIndex >= 0 && values[idIndex]) {
          const cardId = values[idIndex].trim();
          image_url = `${IMAGE_BASE_URL}${cardId}${IMAGE_SUFFIX}`;
        } else if (imageIndex >= 0) {
          image_url = values[imageIndex] || "";
        }

        // カンマ区切りの数値に対応
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
      setIsSpreadsheetOpen(false);
      importMutation.mutate({ cardsData, category: importCategory });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "スプレッドシートの読み込みに失敗しました");
    }
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
                  <code>id, name, points</code>
                  <br />
                  <span className="text-xs">※ id列があれば画像URLは自動生成されます</span>
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

          {/* スプレッドシート連携ダイアログ */}
          <Dialog open={isSpreadsheetOpen} onOpenChange={(open) => { setIsSpreadsheetOpen(open); if (!open) { setImportCategory(null); setSpreadsheetUrl(""); } }}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <FileSpreadsheet className="w-4 h-4" />
                スプレッドシート連携
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Googleスプレッドシートから取得</DialogTitle>
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
                <div>
                  <Label>スプレッドシートURL</Label>
                  <Input
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    value={spreadsheetUrl}
                    onChange={(e) => setSpreadsheetUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    ※ スプレッドシートを「ウェブに公開」してください
                    <br />
                    （ファイル → 共有 → ウェブに公開）
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  必要な列: <code>id, name, points</code>
                  <br />
                  <span className="text-xs">※ id列から画像URLが自動生成されます</span>
                </p>
                <Button
                  className="w-full gap-2"
                  disabled={!importCategory || !spreadsheetUrl || importMutation.isPending}
                  onClick={handleSpreadsheetImport}
                >
                  <RefreshCw className={`w-4 h-4 ${importMutation.isPending ? 'animate-spin' : ''}`} />
                  データを取得
                </Button>
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
                onValueChange={handleCategoryChange}
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

            {/* 件数表示・検索プロンプト */}
            {!isSearchTriggered ? (
              <p className="text-muted-foreground mb-4">
                検索またはカテゴリを選択してデータを表示してください。
              </p>
            ) : (
              <>
                {/* 件数表示 */}
                <div className="flex justify-between items-center mb-4 text-sm text-muted-foreground">
                  <span>
                    {totalCount === 0 
                      ? "0件" 
                      : `${totalCount.toLocaleString()}件中 ${currentPage * PAGE_SIZE + 1}〜${Math.min((currentPage + 1) * PAGE_SIZE, totalCount)}件を表示`}
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
                    条件に一致する商品がありません。
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
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
