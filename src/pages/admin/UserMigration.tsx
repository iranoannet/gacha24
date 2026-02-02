import { useState, useRef } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { Upload, FileText, CheckCircle, AlertCircle, Users, Clock, UserCheck, RefreshCw, Pause, Play, Square } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface MigrationStats {
  total: number;
  applied: number;
  pending: number;
}

interface MigrationRecord {
  id: string;
  email: string;
  display_name: string | null;
  points_balance: number | null;
  is_applied: boolean | null;
  created_at: string | null;
}

interface BatchProgress {
  currentBatch: number;
  totalBatches: number;
  processedRecords: number;
  totalRecords: number;
  insertedTotal: number;
  skippedTotal: number;
  duplicatesRemovedTotal: number;
  invalidEmailsTotal: number;
  errors: string[];
  status: "idle" | "running" | "paused" | "completed" | "stopped";
}

const BATCH_SIZE = 100;

export default function UserMigration() {
  const { tenant } = useTenant();
  const [csvData, setCsvData] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [batchProgress, setBatchProgress] = useState<BatchProgress>({
    currentBatch: 0,
    totalBatches: 0,
    processedRecords: 0,
    totalRecords: 0,
    insertedTotal: 0,
    skippedTotal: 0,
    duplicatesRemovedTotal: 0,
    invalidEmailsTotal: 0,
    errors: [],
    status: "idle",
  });
  
  // Ref to control pause/stop
  const controlRef = useRef<{ paused: boolean; stopped: boolean }>({ paused: false, stopped: false });

  // Fetch migration stats
  const { data: stats, refetch: refetchStats, isLoading: statsLoading } = useQuery({
    queryKey: ["migration-stats", tenant?.id],
    queryFn: async (): Promise<MigrationStats> => {
      if (!tenant?.id) return { total: 0, applied: 0, pending: 0 };

      // Use count queries to avoid 1000 row limit
      const [totalResult, appliedResult] = await Promise.all([
        supabase
          .from("user_migrations")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenant.id),
        supabase
          .from("user_migrations")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenant.id)
          .eq("is_applied", true),
      ]);

      if (totalResult.error) throw totalResult.error;
      if (appliedResult.error) throw appliedResult.error;

      const total = totalResult.count || 0;
      const applied = appliedResult.count || 0;
      const pending = total - applied;

      return { total, applied, pending };
    },
    enabled: !!tenant?.id,
  });

  // Fetch recent migration records
  const { data: recentRecords, refetch: refetchRecords } = useQuery({
    queryKey: ["migration-records", tenant?.id],
    queryFn: async (): Promise<MigrationRecord[]> => {
      if (!tenant?.id) return [];

      const { data, error } = await supabase
        .from("user_migrations")
        .select("id, email, display_name, points_balance, is_applied, created_at")
        .eq("tenant_id", tenant.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    },
    enabled: !!tenant?.id,
  });

  const handleRefresh = () => {
    refetchStats();
    refetchRecords();
    toast.success("データを更新しました");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvData(text);
      toast.success(`${file.name} を読み込みました`);
    };
    reader.onerror = () => {
      toast.error("ファイルの読み込みに失敗しました");
    };
    reader.readAsText(file);
  };

  // Check if CSV has headers
  const hasHeaders = (csv: string): boolean => {
    const firstLine = csv.split("\n")[0]?.toLowerCase() || "";
    return firstLine.includes("email") || firstLine.includes("mail") || 
           firstLine.includes("メール") || firstLine.includes("ポイント");
  };

  // Parse CSV into lines (with or without header)
  const parseCSVLines = (csv: string): { header: string | null; lines: string[]; withHeaders: boolean } => {
    const allLines = csv.trim().split("\n").filter(line => line.trim());
    const withHeaders = hasHeaders(csv);
    
    if (withHeaders) {
      return { 
        header: allLines[0], 
        lines: allLines.slice(1), 
        withHeaders: true 
      };
    } else {
      // No headers - all lines are data
      return { 
        header: null, 
        lines: allLines, 
        withHeaders: false 
      };
    }
  };

  // Batch import with 100 records at a time
  const handleBatchImport = async () => {
    if (!csvData.trim()) {
      toast.error("CSVデータを入力してください");
      return;
    }

    if (!tenant?.id) {
      toast.error("テナント情報が取得できません");
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      toast.error("ログインが必要です");
      return;
    }

    const { header, lines, withHeaders } = parseCSVLines(csvData);
    const totalRecords = lines.length;
    const totalBatches = Math.ceil(totalRecords / BATCH_SIZE);

    // Reset control ref
    controlRef.current = { paused: false, stopped: false };

    setBatchProgress({
      currentBatch: 0,
      totalBatches,
      processedRecords: 0,
      totalRecords,
      insertedTotal: 0,
      skippedTotal: 0,
      duplicatesRemovedTotal: 0,
      invalidEmailsTotal: 0,
      errors: [],
      status: "running",
    });

    setIsLoading(true);
    let insertedTotal = 0;
    let skippedTotal = 0;
    let duplicatesRemovedTotal = 0;
    let invalidEmailsTotal = 0;
    const allErrors: string[] = [];

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      // Check if stopped
      if (controlRef.current.stopped) {
        setBatchProgress(prev => ({ ...prev, status: "stopped" }));
        toast.info("インポートを中止しました");
        break;
      }

      // Check if paused
      while (controlRef.current.paused && !controlRef.current.stopped) {
        setBatchProgress(prev => ({ ...prev, status: "paused" }));
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      if (controlRef.current.stopped) {
        setBatchProgress(prev => ({ ...prev, status: "stopped" }));
        toast.info("インポートを中止しました");
        break;
      }

      // Resume running status
      setBatchProgress(prev => ({ ...prev, status: "running" }));

      const startIdx = batchIndex * BATCH_SIZE;
      const endIdx = Math.min(startIdx + BATCH_SIZE, totalRecords);
      const batchLines = lines.slice(startIdx, endIdx);
      
      // If CSV has headers, prepend header to each batch; otherwise just send data lines
      const batchCsv = withHeaders && header ? [header, ...batchLines].join("\n") : batchLines.join("\n");

      try {
        const response = await supabase.functions.invoke("import-user-migrations", {
          body: {
            tenant_id: tenant.id,
            csv_data: batchCsv,
          },
        });

        if (response.error) {
          allErrors.push(`バッチ${batchIndex + 1}: ${response.error.message}`);
        } else if (response.data) {
          insertedTotal += response.data.inserted || 0;
          skippedTotal += response.data.skipped || 0;
          duplicatesRemovedTotal += response.data.duplicates_in_file || 0;
          invalidEmailsTotal += response.data.invalid_emails || 0;
          if (response.data.errors) {
            allErrors.push(...response.data.errors);
          }
        }
      } catch (error) {
        allErrors.push(`バッチ${batchIndex + 1}: ${error instanceof Error ? error.message : "エラー"}`);
      }

      // Update progress
      setBatchProgress({
        currentBatch: batchIndex + 1,
        totalBatches,
        processedRecords: endIdx,
        totalRecords,
        insertedTotal,
        skippedTotal,
        duplicatesRemovedTotal,
        invalidEmailsTotal,
        errors: allErrors,
        status: batchIndex + 1 === totalBatches ? "completed" : "running",
      });

      // Small delay between batches to avoid rate limiting
      if (batchIndex < totalBatches - 1) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    setIsLoading(false);
    
    if (!controlRef.current.stopped) {
      setBatchProgress(prev => ({ ...prev, status: "completed" }));
      toast.success(`インポート完了: ${insertedTotal}件成功, ${skippedTotal}件スキップ`);
    }

    // Refresh stats
    refetchStats();
    refetchRecords();
  };

  const handlePause = () => {
    controlRef.current.paused = true;
    toast.info("インポートを一時停止しました");
  };

  const handleResume = () => {
    controlRef.current.paused = false;
    toast.info("インポートを再開しました");
  };

  const handleStop = () => {
    controlRef.current.stopped = true;
    controlRef.current.paused = false;
    toast.info("インポートを停止中...");
  };

  const previewLines = csvData.trim().split("\n").slice(0, 6);
  const { lines: dataLines } = csvData ? parseCSVLines(csvData) : { lines: [] };
  const estimatedBatches = Math.ceil(dataLines.length / BATCH_SIZE);

  return (
    <AdminLayout title="ユーザー移行">
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">総インポート数</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statsLoading ? "..." : stats?.total || 0}</div>
              <p className="text-xs text-muted-foreground">移行データ登録済み</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">適用済み</CardTitle>
              <UserCheck className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{statsLoading ? "..." : stats?.applied || 0}</div>
              <p className="text-xs text-muted-foreground">ログイン完了ユーザー</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">待機中</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statsLoading ? "..." : stats?.pending || 0}</div>
              <p className="text-xs text-muted-foreground">未ログインユーザー</p>
            </CardContent>
          </Card>
        </div>

        {stats && stats.total > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>移行進捗</span>
              <span>{stats.applied} / {stats.total} ({Math.round((stats.applied / stats.total) * 100)}%)</span>
            </div>
            <Progress value={(stats.applied / stats.total) * 100} className="h-2" />
          </div>
        )}

        <Tabs defaultValue="import" className="space-y-4">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="import">CSVインポート</TabsTrigger>
              <TabsTrigger value="status">移行ステータス</TabsTrigger>
            </TabsList>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              更新
            </Button>
          </div>

          <TabsContent value="import" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Upload Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    CSVアップロード
                  </CardTitle>
                  <CardDescription>
                    CSVファイルをアップロードするか、直接データを貼り付けてください
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="csv-file">CSVファイル</Label>
                    <Input
                      id="csv-file"
                      type="file"
                      accept=".csv,.txt"
                      onChange={handleFileUpload}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="csv-data">CSVデータ</Label>
                    <Textarea
                      id="csv-data"
                      placeholder={`email,points_balance,last_name,first_name,phone_number,postal_code,prefecture,city,address_line1
test@example.com,5000,山田,太郎,090-1234-5678,123-4567,東京都,渋谷区,道玄坂1-2-3`}
                      value={csvData}
                      onChange={(e) => setCsvData(e.target.value)}
                      className="mt-1 h-48 font-mono text-xs"
                    />
                  </div>

                  {/* Batch info */}
                  {dataLines.length > 0 && (
                    <div className="p-3 bg-muted rounded-lg text-sm">
                      <p><strong>{dataLines.length.toLocaleString()}</strong> 件のレコード</p>
                      <p className="text-muted-foreground">
                        {BATCH_SIZE}件ずつ <strong>{estimatedBatches}</strong> バッチで処理します
                      </p>
                    </div>
                  )}

                  <Button
                    onClick={handleBatchImport}
                    disabled={isLoading || !csvData.trim()}
                    className="w-full"
                  >
                    {isLoading ? "インポート中..." : "バッチインポート開始"}
                  </Button>
                </CardContent>
              </Card>

              {/* Preview & Progress Section */}
              <div className="space-y-6">
                {/* Batch Progress */}
                {batchProgress.status !== "idle" && (
                  <Card className={
                    batchProgress.status === "completed" ? "border-primary" :
                    batchProgress.status === "stopped" ? "border-destructive" :
                    "border-accent"
                  }>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          {batchProgress.status === "completed" && <CheckCircle className="h-5 w-5 text-primary" />}
                          {batchProgress.status === "stopped" && <Square className="h-5 w-5 text-destructive" />}
                          {batchProgress.status === "running" && <Play className="h-5 w-5 text-primary animate-pulse" />}
                          {batchProgress.status === "paused" && <Pause className="h-5 w-5 text-accent-foreground" />}
                          バッチ進捗
                        </span>
                        {/* Control buttons */}
                        {(batchProgress.status === "running" || batchProgress.status === "paused") && (
                          <div className="flex gap-2">
                            {batchProgress.status === "running" ? (
                              <Button variant="outline" size="sm" onClick={handlePause}>
                                <Pause className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button variant="outline" size="sm" onClick={handleResume}>
                                <Play className="h-4 w-4" />
                              </Button>
                            )}
                            <Button variant="destructive" size="sm" onClick={handleStop}>
                              <Square className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </CardTitle>
                      <CardDescription>
                        バッチ {batchProgress.currentBatch} / {batchProgress.totalBatches}
                        {batchProgress.status === "paused" && " (一時停止中)"}
                        {batchProgress.status === "stopped" && " (停止)"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Progress 
                        value={(batchProgress.processedRecords / batchProgress.totalRecords) * 100} 
                        className="h-3"
                      />
                      
                      <div className="grid grid-cols-6 gap-2 text-center text-sm">
                        <div>
                          <p className="text-lg font-bold">{batchProgress.processedRecords.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">処理済み</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold">{batchProgress.totalRecords.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">総件数</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold text-primary">{batchProgress.insertedTotal.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">成功</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold text-muted-foreground">{batchProgress.skippedTotal.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">スキップ</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold text-amber-500">{batchProgress.duplicatesRemovedTotal.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">重複除去</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold text-destructive">{batchProgress.invalidEmailsTotal.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">無効メール</p>
                        </div>
                      </div>

                      {batchProgress.errors.length > 0 && (
                        <div className="mt-2 p-2 bg-destructive/10 rounded text-xs text-destructive max-h-24 overflow-y-auto">
                          {batchProgress.errors.slice(-5).map((err, i) => (
                            <p key={i}>{err}</p>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* CSV Preview */}
                {csvData && batchProgress.status === "idle" && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        プレビュー
                      </CardTitle>
                      <CardDescription>
                        {dataLines.length.toLocaleString()} 件のレコード
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <tbody>
                            {previewLines.map((line, i) => (
                              <tr key={i} className={i === 0 ? "font-bold bg-muted" : ""}>
                                {line.split(",").slice(0, 5).map((cell, j) => (
                                  <td key={j} className="px-2 py-1 border truncate max-w-[100px]">
                                    {cell}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {previewLines.length < csvData.trim().split("\n").length && (
                        <p className="text-xs text-muted-foreground mt-2">
                          ...他 {csvData.trim().split("\n").length - previewLines.length} 行
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Instructions */}
                <Card>
                  <CardHeader>
                    <CardTitle>CSVフォーマット</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-2">
                      以下のカラムに対応しています（日本語名も可）:
                    </p>
                    <ul className="text-xs space-y-1 text-muted-foreground">
                      <li><code className="bg-muted px-1">email</code> / メールアドレス（必須）</li>
                      <li><code className="bg-muted px-1">points_balance</code> / ポイント</li>
                      <li><code className="bg-muted px-1">last_name</code> / 姓</li>
                      <li><code className="bg-muted px-1">first_name</code> / 名</li>
                      <li><code className="bg-muted px-1">phone_number</code> / 電話番号</li>
                      <li><code className="bg-muted px-1">postal_code</code> / 郵便番号</li>
                      <li><code className="bg-muted px-1">prefecture</code> / 都道府県</li>
                      <li><code className="bg-muted px-1">city</code> / 市区町村</li>
                      <li><code className="bg-muted px-1">address_line1</code> / 住所1</li>
                      <li><code className="bg-muted px-1">address_line2</code> / 住所2</li>
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="status">
            <Card>
              <CardHeader>
                <CardTitle>移行レコード一覧</CardTitle>
                <CardDescription>
                  最新50件を表示しています
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>メールアドレス</TableHead>
                        <TableHead>表示名</TableHead>
                        <TableHead className="text-right">ポイント</TableHead>
                        <TableHead className="text-center">ステータス</TableHead>
                        <TableHead>登録日</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentRecords?.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell className="font-mono text-sm">{record.email}</TableCell>
                          <TableCell>{record.display_name || "-"}</TableCell>
                          <TableCell className="text-right">{record.points_balance?.toLocaleString() || 0}</TableCell>
                          <TableCell className="text-center">
                            {record.is_applied ? (
                              <span className="inline-flex items-center gap-1 text-xs text-primary">
                                <CheckCircle className="h-3 w-3" />
                                適用済み
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                待機中
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {record.created_at ? new Date(record.created_at).toLocaleDateString("ja-JP") : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!recentRecords || recentRecords.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            移行データがありません
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
