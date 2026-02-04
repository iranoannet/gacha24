import { useState, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SuperAdminLayout } from "@/components/super-admin/SuperAdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { 
  Building2, AlertCircle, Upload, FileText, CheckCircle, Play, Pause, Square, 
  HelpCircle, Trash2, File, Clock, XCircle, Loader2
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

type DataType = "users" | "transactions" | "inventory" | "daily-sales" | "shipping-history" | "unknown";

interface DetectedFormat {
  type: DataType;
  label: string;
  functionName: string;
  description: string;
}

const DATA_FORMATS: Record<Exclude<DataType, "unknown">, DetectedFormat> = {
  "users": {
    type: "users",
    label: "ユーザー",
    functionName: "import-user-migrations",
    description: "email, points_balance, display_name などを含むユーザー情報",
  },
  "transactions": {
    type: "transactions",
    label: "取引履歴",
    functionName: "import-transactions",
    description: "user_email, total_spent_points などを含む購入履歴",
  },
  "inventory": {
    type: "inventory",
    label: "発送/変換",
    functionName: "import-inventory",
    description: "pack_id, card_id, user_id, status などを含むガチャ結果データ",
  },
  "daily-sales": {
    type: "daily-sales",
    label: "日別売上",
    functionName: "import-daily-analytics",
    description: "date, payment_amount, profit などを含む売上集計データ",
  },
  "shipping-history": {
    type: "shipping-history",
    label: "発送履歴",
    functionName: "import-shipping-history",
    description: "tracking_number, shipped_at などを含む発送記録",
  },
};

function detectDataType(headers: string[]): DataType {
  const headerSet = new Set(headers.map(h => h.toLowerCase().trim()));
  
  if (headerSet.has("pack_id") || (headerSet.has("card_id") && headerSet.has("user_id") && headerSet.has("status"))) {
    return "inventory";
  }
  
  if (headerSet.has("payment") || headerSet.has("payment_amount") || 
      (headerSet.has("date") && (headerSet.has("profit") || headerSet.has("points_used")))) {
    return "daily-sales";
  }
  
  if ((headerSet.has("email") || headerSet.has("mail")) && 
      (headerSet.has("points_balance") || headerSet.has("availablepoint") || headerSet.has("lastname"))) {
    return "users";
  }
  
  if (headerSet.has("user_email") && headerSet.has("total_spent_points")) {
    return "transactions";
  }
  
  if (headerSet.has("tracking_number") || headerSet.has("shipped_at") || headerSet.has("shire_state")) {
    return "shipping-history";
  }
  
  return "unknown";
}

interface FileQueueItem {
  id: string;
  file: File;
  content: string;
  detectedType: DataType;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  result?: {
    inserted: number;
    skipped: number;
    failed: number;
    total: number;
  };
  error?: string;
}

const BATCH_SIZE = 100;

export default function DataMigration() {
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const [fileQueue, setFileQueue] = useState<FileQueueItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const controlRef = useRef<{ paused: boolean; stopped: boolean }>({ paused: false, stopped: false });
  const queryClient = useQueryClient();

  const { data: tenants, isLoading: tenantsLoading } = useQuery({
    queryKey: ["all-tenants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("id, name, slug")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: importHistory, isLoading: historyLoading } = useQuery({
    queryKey: ["import-history", selectedTenantId],
    queryFn: async () => {
      if (!selectedTenantId) return [];
      const { data, error } = await supabase
        .from("import_history")
        .select("*")
        .eq("tenant_id", selectedTenantId)
        .order("imported_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedTenantId,
  });

  const selectedTenant = tenants?.find(t => t.id === selectedTenantId);

  const handleFilesSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newItems: FileQueueItem[] = [];
    
    for (const file of files) {
      const content = await file.text();
      const firstLine = content.trim().split("\n")[0] || "";
      const headers = firstLine.split(",").map(h => h.replace(/"/g, "").trim());
      const detectedType = detectDataType(headers);
      
      newItems.push({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        content,
        detectedType,
        status: "pending",
        progress: 0,
      });
    }
    
    setFileQueue(prev => [...prev, ...newItems]);
    toast.success(`${files.length}件のファイルを追加しました`);
    
    // Reset input
    e.target.value = "";
  }, []);

  const removeFile = useCallback((id: string) => {
    setFileQueue(prev => prev.filter(f => f.id !== id));
  }, []);

  const clearQueue = useCallback(() => {
    setFileQueue([]);
  }, []);

  const saveImportHistory = async (item: FileQueueItem) => {
    const { data: user } = await supabase.auth.getUser();
    
    await supabase.from("import_history").insert({
      tenant_id: selectedTenantId,
      file_name: item.file.name,
      data_type: item.detectedType,
      records_processed: item.result?.total || 0,
      records_inserted: item.result?.inserted || 0,
      records_skipped: item.result?.skipped || 0,
      records_failed: item.result?.failed || 0,
      status: item.status,
      imported_by: user.user?.id,
      error_summary: item.error,
    });
    
    queryClient.invalidateQueries({ queryKey: ["import-history", selectedTenantId] });
  };

  const processFile = async (item: FileQueueItem): Promise<FileQueueItem> => {
    if (item.detectedType === "unknown") {
      return { ...item, status: "failed", error: "データ形式を判別できません" };
    }

    const format = DATA_FORMATS[item.detectedType];
    const lines = item.content.trim().split("\n").filter(line => line.trim());
    const header = lines[0];
    const dataLines = lines.slice(1);
    const totalRecords = dataLines.length;
    const totalBatches = Math.ceil(totalRecords / BATCH_SIZE);

    let inserted = 0;
    let skipped = 0;
    let failed = 0;

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      if (controlRef.current.stopped) break;
      
      while (controlRef.current.paused && !controlRef.current.stopped) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      if (controlRef.current.stopped) break;

      const startIdx = batchIndex * BATCH_SIZE;
      const endIdx = Math.min(startIdx + BATCH_SIZE, totalRecords);
      const batchLines = dataLines.slice(startIdx, endIdx);
      const batchCsv = [header, ...batchLines].join("\n");

      try {
        const response = await supabase.functions.invoke(format.functionName, {
          body: { tenant_id: selectedTenantId, csv_data: batchCsv },
        });

        if (response.error) {
          failed += batchLines.length;
        } else if (response.data) {
          inserted += response.data.inserted || response.data.total_records || 0;
          skipped += response.data.skipped || 0;
          failed += response.data.user_not_found || 0;
        }
      } catch {
        failed += batchLines.length;
      }

      const progress = Math.round(((batchIndex + 1) / totalBatches) * 100);
      setFileQueue(prev => prev.map(f => 
        f.id === item.id ? { ...f, progress } : f
      ));

      if (batchIndex < totalBatches - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    return {
      ...item,
      status: controlRef.current.stopped ? "pending" : "completed",
      progress: 100,
      result: { inserted, skipped, failed, total: totalRecords },
    };
  };

  const startProcessing = async () => {
    if (!selectedTenantId) {
      toast.error("テナントを選択してください");
      return;
    }

    const pendingFiles = fileQueue.filter(f => f.status === "pending");
    if (pendingFiles.length === 0) {
      toast.info("処理するファイルがありません");
      return;
    }

    setIsProcessing(true);
    controlRef.current = { paused: false, stopped: false };

    for (let i = 0; i < fileQueue.length; i++) {
      const item = fileQueue[i];
      if (item.status !== "pending") continue;
      if (controlRef.current.stopped) break;

      setCurrentFileIndex(i);
      setFileQueue(prev => prev.map((f, idx) => 
        idx === i ? { ...f, status: "processing" } : f
      ));

      const result = await processFile(item);
      
      setFileQueue(prev => prev.map((f, idx) => 
        idx === i ? result : f
      ));

      // Save to history
      await saveImportHistory(result);
    }

    setIsProcessing(false);
    controlRef.current.stopped = false;
    toast.success("インポート完了");
  };

  const handlePause = () => {
    controlRef.current.paused = true;
  };

  const handleResume = () => {
    controlRef.current.paused = false;
  };

  const handleStop = () => {
    controlRef.current.stopped = true;
    controlRef.current.paused = false;
  };

  // Group queue by data type
  const groupedQueue = fileQueue.reduce((acc, item) => {
    const type = item.detectedType;
    if (!acc[type]) acc[type] = [];
    acc[type].push(item);
    return acc;
  }, {} as Record<DataType, FileQueueItem[]>);

  // Group history by data type
  const groupedHistory = (importHistory || []).reduce((acc, item) => {
    const type = item.data_type as DataType;
    if (!acc[type]) acc[type] = [];
    acc[type].push(item);
    return acc;
  }, {} as Record<string, typeof importHistory>);

  const pendingCount = fileQueue.filter(f => f.status === "pending").length;
  const processingFile = fileQueue.find(f => f.status === "processing");

  return (
    <SuperAdminLayout title="データ移行">
      <div className="space-y-6">
        {/* Tenant Selector */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              テナント選択
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-w-md">
              <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
                <SelectTrigger>
                  <SelectValue placeholder="テナントを選択..." />
                </SelectTrigger>
                <SelectContent>
                  {tenantsLoading ? (
                    <SelectItem value="loading" disabled>読み込み中...</SelectItem>
                  ) : (
                    tenants?.map((tenant) => (
                      <SelectItem key={tenant.id} value={tenant.id}>
                        {tenant.name} ({tenant.slug})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {selectedTenantId && (
          <Tabs defaultValue="import" className="space-y-4">
            <TabsList>
              <TabsTrigger value="import">インポート</TabsTrigger>
              <TabsTrigger value="history">履歴</TabsTrigger>
            </TabsList>

            <TabsContent value="import" className="space-y-6">
              {/* File Upload Area */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    ファイルアップロード
                  </CardTitle>
                  <CardDescription>
                    複数のCSVファイルを選択できます。データ形式は自動検出されます。
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="border-2 border-dashed rounded-lg p-8 text-center">
                    <input
                      type="file"
                      accept=".csv,.txt"
                      multiple
                      onChange={handleFilesSelected}
                      className="hidden"
                      id="file-upload"
                      disabled={isProcessing}
                    />
                    <label 
                      htmlFor="file-upload" 
                      className="cursor-pointer flex flex-col items-center gap-2"
                    >
                      <Upload className="h-10 w-10 text-muted-foreground" />
                      <span className="font-medium">クリックしてファイルを選択</span>
                      <span className="text-sm text-muted-foreground">
                        複数ファイル選択可能（CSV, TXT）
                      </span>
                    </label>
                  </div>

                  {/* Controls */}
                  {fileQueue.length > 0 && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {fileQueue.length}件のファイル
                        </Badge>
                        <Badge variant="secondary">
                          {pendingCount}件が待機中
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        {!isProcessing ? (
                          <>
                            <Button variant="outline" size="sm" onClick={clearQueue}>
                              <Trash2 className="h-4 w-4 mr-1" />
                              クリア
                            </Button>
                            <Button onClick={startProcessing} disabled={pendingCount === 0}>
                              <Play className="h-4 w-4 mr-1" />
                              インポート開始
                            </Button>
                          </>
                        ) : (
                          <>
                            {controlRef.current.paused ? (
                              <Button variant="outline" size="sm" onClick={handleResume}>
                                <Play className="h-4 w-4 mr-1" />
                                再開
                              </Button>
                            ) : (
                              <Button variant="outline" size="sm" onClick={handlePause}>
                                <Pause className="h-4 w-4 mr-1" />
                                一時停止
                              </Button>
                            )}
                            <Button variant="destructive" size="sm" onClick={handleStop}>
                              <Square className="h-4 w-4 mr-1" />
                              中止
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Current Processing */}
                  {processingFile && (
                    <Alert>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <AlertDescription>
                        <strong>{processingFile.file.name}</strong> を処理中... ({processingFile.progress}%)
                        <Progress value={processingFile.progress} className="mt-2 h-2" />
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>

              {/* Queue by Data Type */}
              {Object.entries(groupedQueue).map(([type, items]) => (
                <Card key={type}>
                  <CardHeader className="py-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      {type !== "unknown" ? DATA_FORMATS[type as Exclude<DataType, "unknown">]?.label : "不明"}
                      <Badge variant="outline">{items.length}件</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ScrollArea className="h-[200px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>ファイル名</TableHead>
                            <TableHead className="w-[100px]">状態</TableHead>
                            <TableHead className="w-[150px]">結果</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-mono text-xs">
                                <div className="flex items-center gap-2">
                                  <File className="h-4 w-4 text-muted-foreground" />
                                  {item.file.name}
                                </div>
                              </TableCell>
                              <TableCell>
                                {item.status === "pending" && (
                                  <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />待機</Badge>
                                )}
                                {item.status === "processing" && (
                                  <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" />処理中</Badge>
                                )}
                                {item.status === "completed" && (
                                  <Badge variant="default"><CheckCircle className="h-3 w-3 mr-1" />完了</Badge>
                                )}
                                {item.status === "failed" && (
                                  <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />失敗</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-xs">
                                {item.result && (
                                  <span>
                                    成功: {item.result.inserted} / 
                                    スキップ: {item.result.skipped} / 
                                    失敗: {item.result.failed}
                                  </span>
                                )}
                                {item.error && (
                                  <span className="text-destructive">{item.error}</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {item.status === "pending" && (
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={() => removeFile(item.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </CardContent>
                </Card>
              ))}

              {/* Format Help */}
              {fileQueue.length === 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <HelpCircle className="h-5 w-5" />
                      対応データ形式
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                      {Object.values(DATA_FORMATS).map((format) => (
                        <div key={format.type} className="p-3 rounded-lg border text-sm">
                          <Badge variant="outline" className="mb-1">{format.label}</Badge>
                          <p className="text-muted-foreground text-xs">{format.description}</p>
                        </div>
                      ))}
                    </div>
                    
                    <Alert className="mt-4">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        <strong>推奨順序:</strong> ユーザー → 取引履歴/発送変換 → 日別売上
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              {historyLoading ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  </CardContent>
                </Card>
              ) : (
                Object.entries(groupedHistory).map(([type, items]) => (
                  <Card key={type}>
                    <CardHeader className="py-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        {DATA_FORMATS[type as Exclude<DataType, "unknown">]?.label || type}
                        <Badge variant="outline">{items?.length || 0}件</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <ScrollArea className="h-[200px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>ファイル名</TableHead>
                              <TableHead>日時</TableHead>
                              <TableHead>結果</TableHead>
                              <TableHead>状態</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {items?.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell className="font-mono text-xs">{item.file_name}</TableCell>
                                <TableCell className="text-xs">
                                  {format(new Date(item.imported_at), "MM/dd HH:mm", { locale: ja })}
                                </TableCell>
                                <TableCell className="text-xs">
                                  成功: {item.records_inserted} / 
                                  スキップ: {item.records_skipped} / 
                                  失敗: {item.records_failed}
                                </TableCell>
                                <TableCell>
                                  {item.status === "completed" ? (
                                    <Badge variant="default"><CheckCircle className="h-3 w-3 mr-1" />完了</Badge>
                                  ) : (
                                    <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />失敗</Badge>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                ))
              )}
              
              {!historyLoading && Object.keys(groupedHistory).length === 0 && (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    インポート履歴がありません
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        )}

        {!selectedTenantId && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              テナントを選択してデータをインポートしてください
            </CardContent>
          </Card>
        )}
      </div>
    </SuperAdminLayout>
  );
}
