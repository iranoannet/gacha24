import { useState, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SuperAdminLayout } from "@/components/super-admin/SuperAdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  HelpCircle, Trash2, File, Clock, XCircle, Loader2, Users, UserPlus, RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

type DataType = "users" | "transactions" | "inventory" | "daily-sales" | "shipping-history" | "point-conversions" | "pending-shipments" | "unknown";

const DATA_FORMATS: Record<Exclude<DataType, "unknown">, { label: string; functionName: string; description: string }> = {
  "users": {
    label: "ユーザー",
    functionName: "import-user-migrations",
    description: "ユーザー情報（email, points等）",
  },
  "transactions": {
    label: "取引履歴",
    functionName: "import-transactions",
    description: "購入履歴",
  },
  "inventory": {
    label: "発送/変換",
    functionName: "import-inventory",
    description: "pack_cards形式のガチャ結果",
  },
  "daily-sales": {
    label: "日別売上",
    functionName: "import-daily-analytics",
    description: "日別の売上・粗利データ",
  },
  "shipping-history": {
    label: "発送履歴",
    functionName: "import-shipping-history",
    description: "発送記録",
  },
  "point-conversions": {
    label: "ポイント還元",
    functionName: "import-point-conversions",
    description: "ポイント還元履歴（userpoint_trigger_histories）",
  },
  "pending-shipments": {
    label: "発送履歴（海外）",
    functionName: "import-pending-shipments",
    description: "発送履歴（oversea_waits: 発送済み/未発送両方含む）",
  },
};

function detectDataType(headers: string[], fileName?: string): DataType {
  const headerLower = headers.map(h => h.toLowerCase().replace(/"/g, "").trim());
  const headerStr = headerLower.join(",");
  const fileNameLower = fileName?.toLowerCase() || "";
  
  // First: Check filename for common patterns
  if (fileNameLower.includes("userpoint_trigger") || fileNameLower.includes("point_trigger")) {
    return "point-conversions";
  }
  if (fileNameLower.includes("oversea") || fileNameLower.includes("pending")) {
    return "pending-shipments";
  }
  if (fileNameLower.includes("user_histor") || fileNameLower.includes("histories")) {
    return "transactions";
  }
  if (fileNameLower.includes("pack_card") && !fileNameLower.includes("cache")) {
    return "inventory";
  }
  if (fileNameLower.includes("day_data") || fileNameLower.includes("daily")) {
    return "daily-sales";
  }
  if (fileNameLower.includes("sales_cost") || fileNameLower.includes("cost_management")) {
    return "daily-sales";
  }
  if (fileNameLower.includes("shipping") || fileNameLower.includes("wait")) {
    return "shipping-history";
  }
  if (fileNameLower.includes("user") && !fileNameLower.includes("histor")) {
    return "users";
  }
  
  // Second: Check headers
  // userpoint_trigger_histories: id, user_id, old_point, new_point, created, modified
  if (headerStr.includes("old_point") && headerStr.includes("new_point")) {
    return "point-conversions";
  }
  
  // day_datas: id,date,payment,profit,points_used,status
  if (headerStr.includes("payment") || headerStr.includes("profit") || headerStr.includes("rieki")) {
    return "daily-sales";
  }
  // sales_cost_managements: id, sales, cost, expenses, wait_arari, date, status
  if (headerStr.includes("sales") && headerStr.includes("cost") && headerStr.includes("expenses")) {
    return "daily-sales";
  }
  
  // users: email/mail + points/name/address
  if ((headerStr.includes("email") || headerStr.includes("mail")) && 
      (headerStr.includes("point") || headerStr.includes("name") || headerStr.includes("address"))) {
    return "users";
  }
  
  // transactions: user_histories format - typically has user_id, pack_id, created, etc.
  if (headerStr.includes("user_email") && headerStr.includes("spent")) {
    return "transactions";
  }
  
  // shipping: oversea_waits format - has shire_state, card_id (legacy user_id)
  if (headerStr.includes("shire") || headerStr.includes("tracking") || headerStr.includes("shipped")) {
    return "shipping-history";
  }
  
  // pack_cards/inventory: has pack_id, card_id, user_id, redemption_point
  if (headerStr.includes("pack_id") || headerStr.includes("redemption_point") ||
      (headerStr.includes("card_id") && headerStr.includes("user_id") && headerStr.includes("sale_price"))) {
    return "inventory";
  }
  
  // Fallback: check column count for positional CSVs
  const colCount = headers.length;
  if (colCount === 6 && headers[0]?.match(/^\d+$/)) return "daily-sales";
  if (colCount >= 15 && headers[0]?.match(/^\d+$/)) return "inventory";
  if (colCount === 9 && headers[0]?.match(/^\d+$/)) return "shipping-history";
  
  return "unknown";
}

interface FileQueueItem {
  id: string;
  file: File;
  content: string;
  detectedType: DataType;
  selectedType: DataType;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  result?: { inserted: number; skipped: number; failed: number; total: number };
  error?: string;
}

const BATCH_SIZE = 500; // Increased for faster processing

interface BulkProfileResult {
  total_remaining: number;
  processed: number;
  marked_applied: number;
  auth_users_created: number;
  profiles_created: number;
  skipped_existing: number;
  errors?: string[];
  error_count: number;
  has_more: boolean;
}

export default function DataMigration() {
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const [fileQueue, setFileQueue] = useState<FileQueueItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const controlRef = useRef<{ paused: boolean; stopped: boolean }>({ paused: false, stopped: false });
  const queryClient = useQueryClient();
  const reimportInputRef = useRef<HTMLInputElement>(null);
  const [reimportDataType, setReimportDataType] = useState<DataType | null>(null);
  
  // Bulk profile creation state
  const [isCreatingProfiles, setIsCreatingProfiles] = useState(false);
  const [profileCreationProgress, setProfileCreationProgress] = useState<{
    totalProcessed: number;
    totalCreated: number;
    totalSkipped: number;
    totalErrors: number;
    remaining: number;
    isComplete: boolean;
  } | null>(null);
  const profileCreationControlRef = useRef<{ stopped: boolean }>({ stopped: false });
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
        .limit(100);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedTenantId,
  });

  // Query for unapplied user_migrations count
  const { data: migrationStats, refetch: refetchMigrationStats } = useQuery({
    queryKey: ["migration-stats", selectedTenantId],
    queryFn: async () => {
      if (!selectedTenantId) return null;
      
      const [unappliedResult, appliedResult, profilesResult] = await Promise.all([
        supabase
          .from("user_migrations")
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", selectedTenantId)
          .eq("is_applied", false),
        supabase
          .from("user_migrations")
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", selectedTenantId)
          .eq("is_applied", true),
        supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", selectedTenantId),
      ]);
      
      return {
        unapplied: unappliedResult.count || 0,
        applied: appliedResult.count || 0,
        profiles: profilesResult.count || 0,
      };
    },
    enabled: !!selectedTenantId,
    refetchInterval: isCreatingProfiles ? 5000 : false,
  });

  const selectedTenant = tenants?.find(t => t.id === selectedTenantId);

  // Delete import history mutation (with associated data)
  const deleteHistoryMutation = useMutation({
    mutationFn: async (historyId: string) => {
      const { data, error } = await supabase.functions.invoke("delete-import-history", {
        body: { history_id: historyId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["import-history", selectedTenantId] });
      queryClient.invalidateQueries({ queryKey: ["migration-stats", selectedTenantId] });
      queryClient.invalidateQueries({ queryKey: ["profile-stats", selectedTenantId] });
      const details = data?.details?.join(", ") || "";
      toast.success(`削除完了: ${details}`);
    },
    onError: (error: Error) => {
      toast.error(`削除エラー: ${error.message}`);
    },
  });

  // Bulk profile creation function
  const startBulkProfileCreation = async () => {
    if (!selectedTenantId) {
      toast.error("テナントを選択してください");
      return;
    }

    setIsCreatingProfiles(true);
    profileCreationControlRef.current.stopped = false;
    setProfileCreationProgress({
      totalProcessed: 0,
      totalCreated: 0,
      totalSkipped: 0,
      totalErrors: 0,
      remaining: migrationStats?.unapplied || 0,
      isComplete: false,
    });

    let totalProcessed = 0;
    let totalCreated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    let hasMore = true;
    let batchCount = 0;

    while (hasMore && !profileCreationControlRef.current.stopped) {
      batchCount++;
      try {
        const { data, error } = await supabase.functions.invoke<BulkProfileResult>("bulk-create-profiles", {
          body: { tenant_id: selectedTenantId, limit: 100 },
        });

        if (error) {
          console.error("Batch error:", error);
          toast.error(`バッチ ${batchCount} エラー: ${error.message}`);
          break;
        }

        if (data) {
          totalProcessed += data.processed;
          totalCreated += data.profiles_created;
          totalSkipped += data.skipped_existing;
          totalErrors += data.error_count;
          hasMore = data.has_more;

          setProfileCreationProgress({
            totalProcessed,
            totalCreated,
            totalSkipped,
            totalErrors,
            remaining: data.total_remaining,
            isComplete: !data.has_more,
          });

          // Small delay between batches
          if (hasMore) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      } catch (err) {
        console.error("Unexpected error:", err);
        toast.error("予期せぬエラーが発生しました");
        break;
      }
    }

    setIsCreatingProfiles(false);
    refetchMigrationStats();
    
    if (profileCreationControlRef.current.stopped) {
      toast.info("プロファイル作成を中止しました");
    } else if (!hasMore) {
      toast.success(`完了: ${totalCreated}件のプロファイルを作成しました`);
    }
  };

  const stopBulkProfileCreation = () => {
    profileCreationControlRef.current.stopped = true;
  };

  const processFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    const newItems: FileQueueItem[] = [];
    
    for (const file of files) {
      const content = await file.text();
      const firstLine = content.trim().split("\n")[0] || "";
      const headers = firstLine.split(",").map(h => h.replace(/"/g, "").trim());
      const detectedType = detectDataType(headers, file.name);
      
      newItems.push({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        content,
        detectedType,
        selectedType: detectedType,
        status: "pending",
        progress: 0,
      });
    }
    
    setFileQueue(prev => [...prev, ...newItems]);
    toast.success(`${files.length}件のファイルを追加しました`);
  }, []);

  const handleFilesSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    await processFiles(files);
    e.target.value = "";
  }, [processFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isProcessing) setIsDragging(true);
  }, [isProcessing]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (isProcessing) return;
    
    const files = Array.from(e.dataTransfer.files).filter(
      f => f.name.endsWith('.csv') || f.name.endsWith('.txt')
    );
    
    if (files.length === 0) {
      toast.error("CSVまたはTXTファイルのみ対応しています");
      return;
    }
    
    await processFiles(files);
  }, [isProcessing, processFiles]);

  const updateFileType = useCallback((id: string, type: DataType) => {
    setFileQueue(prev => prev.map(f => f.id === id ? { ...f, selectedType: type } : f));
  }, []);

  const removeFile = useCallback((id: string) => {
    setFileQueue(prev => prev.filter(f => f.id !== id));
  }, []);

  const clearQueue = useCallback(() => {
    setFileQueue([]);
  }, []);

  // Re-import handler
  const handleReimport = useCallback((dataType: DataType) => {
    setReimportDataType(dataType);
    reimportInputRef.current?.click();
  }, []);

  const handleReimportFileSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !reimportDataType) return;

    const newItems: FileQueueItem[] = [];
    
    for (const file of files) {
      const content = await file.text();
      
      newItems.push({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        content,
        detectedType: reimportDataType,
        selectedType: reimportDataType,
        status: "pending",
        progress: 0,
      });
    }
    
    setFileQueue(prev => [...prev, ...newItems]);
    toast.success(`${files.length}件のファイルを「${DATA_FORMATS[reimportDataType]?.label}」形式で追加しました`);
    
    e.target.value = "";
    setReimportDataType(null);
  }, [reimportDataType]);

  const saveImportHistory = async (item: FileQueueItem) => {
    const { data: user } = await supabase.auth.getUser();
    await supabase.from("import_history").insert({
      tenant_id: selectedTenantId,
      file_name: item.file.name,
      data_type: item.selectedType,
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
    if (item.selectedType === "unknown") {
      return { ...item, status: "failed", error: "データ形式を選択してください" };
    }

    const format = DATA_FORMATS[item.selectedType];
    const lines = item.content.trim().split("\n").filter(line => line.trim());
    const header = lines[0];
    const dataLines = lines.slice(1);
    const totalRecords = dataLines.length;
    const totalBatches = Math.ceil(totalRecords / BATCH_SIZE);

    let inserted = 0, skipped = 0, failed = 0;

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
      setFileQueue(prev => prev.map(f => f.id === item.id ? { ...f, progress } : f));

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

    const pendingFiles = fileQueue.filter(f => f.status === "pending" && f.selectedType !== "unknown");
    if (pendingFiles.length === 0) {
      toast.info("処理するファイルがありません（データ形式を選択してください）");
      return;
    }

    setIsProcessing(true);
    controlRef.current = { paused: false, stopped: false };

    for (let i = 0; i < fileQueue.length; i++) {
      const item = fileQueue[i];
      if (item.status !== "pending" || item.selectedType === "unknown") continue;
      if (controlRef.current.stopped) break;

      setFileQueue(prev => prev.map((f, idx) => idx === i ? { ...f, status: "processing" } : f));
      const result = await processFile(item);
      setFileQueue(prev => prev.map((f, idx) => idx === i ? result : f));
      await saveImportHistory(result);
    }

    setIsProcessing(false);
    controlRef.current.stopped = false;
    toast.success("インポート完了");
  };

  const handlePause = () => { controlRef.current.paused = true; };
  const handleResume = () => { controlRef.current.paused = false; };
  const handleStop = () => { controlRef.current.stopped = true; controlRef.current.paused = false; };

  const pendingCount = fileQueue.filter(f => f.status === "pending" && f.selectedType !== "unknown").length;
  const unknownCount = fileQueue.filter(f => f.selectedType === "unknown").length;
  const processingFile = fileQueue.find(f => f.status === "processing");

  // Group history by data type
  const groupedHistory = (importHistory || []).reduce((acc, item) => {
    const type = item.data_type;
    if (!acc[type]) acc[type] = [];
    acc[type].push(item);
    return acc;
  }, {} as Record<string, typeof importHistory>);

  return (
    <SuperAdminLayout title="データ移行">
      <div className="space-y-6">
        {/* Tenant Selector */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              テナント選択
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
              <SelectTrigger className="max-w-md">
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
            {selectedTenant && (
              <p className="mt-2 text-sm text-muted-foreground">
                <strong>{selectedTenant.name}</strong> にデータをインポートします
              </p>
            )}
          </CardContent>
        </Card>

        {/* Bulk Profile Creation Card */}
        {selectedTenantId && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                一括プロファイル作成
              </CardTitle>
              <CardDescription>
                user_migrationsテーブルから認証ユーザーとプロファイルを一括作成します
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 rounded-lg border bg-muted/30">
                  <div className="text-xs text-muted-foreground">未適用移行</div>
                  <div className="text-2xl font-bold text-orange-500">
                    {migrationStats?.unapplied?.toLocaleString() || 0}
                  </div>
                </div>
                <div className="p-3 rounded-lg border bg-muted/30">
                  <div className="text-xs text-muted-foreground">適用済み</div>
                  <div className="text-2xl font-bold text-green-500">
                    {migrationStats?.applied?.toLocaleString() || 0}
                  </div>
                </div>
                <div className="p-3 rounded-lg border bg-muted/30">
                  <div className="text-xs text-muted-foreground">プロファイル数</div>
                  <div className="text-2xl font-bold">
                    {migrationStats?.profiles?.toLocaleString() || 0}
                  </div>
                </div>
                <div className="p-3 rounded-lg border bg-muted/30">
                  <div className="text-xs text-muted-foreground">作成率</div>
                  <div className="text-2xl font-bold">
                    {migrationStats && (migrationStats.unapplied + migrationStats.applied) > 0
                      ? Math.round((migrationStats.applied / (migrationStats.unapplied + migrationStats.applied)) * 100)
                      : 0}%
                  </div>
                </div>
              </div>

              {/* Progress */}
              {profileCreationProgress && (
                <div className="space-y-3 p-4 rounded-lg border bg-muted/20">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      {isCreatingProfiles && <Loader2 className="h-4 w-4 animate-spin" />}
                      {profileCreationProgress.isComplete ? "完了" : isCreatingProfiles ? "処理中..." : "中断"}
                    </span>
                    <span className="text-muted-foreground">
                      残り: {profileCreationProgress.remaining.toLocaleString()}件
                    </span>
                  </div>
                  <Progress 
                    value={migrationStats && (migrationStats.unapplied + migrationStats.applied) > 0
                      ? ((migrationStats.applied) / (migrationStats.unapplied + migrationStats.applied)) * 100
                      : 0} 
                    className="h-2"
                  />
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div className="text-center">
                      <div className="font-medium">{profileCreationProgress.totalProcessed.toLocaleString()}</div>
                      <div className="text-muted-foreground">処理済み</div>
                    </div>
                    <div className="text-center">
                      <div className="font-medium text-green-500">{profileCreationProgress.totalCreated.toLocaleString()}</div>
                      <div className="text-muted-foreground">作成</div>
                    </div>
                    <div className="text-center">
                      <div className="font-medium text-yellow-500">{profileCreationProgress.totalSkipped.toLocaleString()}</div>
                      <div className="text-muted-foreground">スキップ</div>
                    </div>
                    <div className="text-center">
                      <div className="font-medium text-red-500">{profileCreationProgress.totalErrors.toLocaleString()}</div>
                      <div className="text-muted-foreground">エラー</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {!isCreatingProfiles ? (
                  <Button 
                    onClick={startBulkProfileCreation}
                    disabled={!migrationStats?.unapplied || migrationStats.unapplied === 0}
                  >
                    <Users className="h-4 w-4 mr-2" />
                    一括プロファイル作成を開始
                  </Button>
                ) : (
                  <Button variant="destructive" onClick={stopBulkProfileCreation}>
                    <Square className="h-4 w-4 mr-2" />
                    中止
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  onClick={() => refetchMigrationStats()}
                  disabled={isCreatingProfiles}
                >
                  更新
                </Button>
              </div>

              {/* Info */}
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <strong>推奨順序:</strong> ユーザーCSVインポート → 一括プロファイル作成 → 取引履歴/発送履歴インポート
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        )}

        {selectedTenantId && (
          <Tabs defaultValue="import" className="space-y-4">
            <TabsList>
              <TabsTrigger value="import">インポート</TabsTrigger>
              <TabsTrigger value="history">履歴</TabsTrigger>
            </TabsList>

            <TabsContent value="import" className="space-y-4">
              {/* File Upload */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    ファイルアップロード
                  </CardTitle>
                  <CardDescription>
                    複数CSVを選択 → データ形式を確認/変更 → インポート開始
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div 
                    className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                      isDragging 
                        ? "border-primary bg-primary/5" 
                        : "border-muted-foreground/25 hover:border-muted-foreground/50"
                    } ${isProcessing ? "opacity-50 cursor-not-allowed" : ""}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <input
                      type="file"
                      accept=".csv,.txt"
                      multiple
                      onChange={handleFilesSelected}
                      className="hidden"
                      id="file-upload"
                      disabled={isProcessing}
                    />
                    <label htmlFor="file-upload" className={`flex flex-col items-center gap-2 ${isProcessing ? "cursor-not-allowed" : "cursor-pointer"}`}>
                      <Upload className={`h-8 w-8 ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
                      <span className="text-sm">
                        {isDragging 
                          ? "ここにドロップしてください" 
                          : "ドラッグ&ドロップ または クリックしてファイルを選択"}
                      </span>
                      <span className="text-xs text-muted-foreground">CSV/TXTファイル（複数可）</span>
                    </label>
                  </div>

                  {/* Controls */}
                  {fileQueue.length > 0 && (
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{fileQueue.length}件</Badge>
                        <Badge variant="secondary">{pendingCount}件待機</Badge>
                        {unknownCount > 0 && (
                          <Badge variant="destructive">{unknownCount}件要選択</Badge>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {!isProcessing ? (
                          <>
                            <Button variant="outline" size="sm" onClick={clearQueue}>
                              <Trash2 className="h-4 w-4 mr-1" />クリア
                            </Button>
                            <Button onClick={startProcessing} disabled={pendingCount === 0}>
                              <Play className="h-4 w-4 mr-1" />インポート開始
                            </Button>
                          </>
                        ) : (
                          <>
                            {controlRef.current.paused ? (
                              <Button variant="outline" size="sm" onClick={handleResume}>
                                <Play className="h-4 w-4 mr-1" />再開
                              </Button>
                            ) : (
                              <Button variant="outline" size="sm" onClick={handlePause}>
                                <Pause className="h-4 w-4 mr-1" />一時停止
                              </Button>
                            )}
                            <Button variant="destructive" size="sm" onClick={handleStop}>
                              <Square className="h-4 w-4 mr-1" />中止
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Processing indicator */}
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

              {/* File Queue Table */}
              {fileQueue.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">ファイル一覧</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[400px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>ファイル名</TableHead>
                            <TableHead className="w-[150px]">データ形式</TableHead>
                            <TableHead className="w-[100px]">状態</TableHead>
                            <TableHead className="w-[180px]">結果</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {fileQueue.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-mono text-xs">
                                <div className="flex items-center gap-2">
                                  <File className="h-4 w-4 text-muted-foreground shrink-0" />
                                  <span className="truncate max-w-[200px]">{item.file.name}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                {item.status === "pending" ? (
                                  <Select
                                    value={item.selectedType}
                                    onValueChange={(v) => updateFileType(item.id, v as DataType)}
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="unknown">-- 選択 --</SelectItem>
                                      {Object.entries(DATA_FORMATS).map(([key, fmt]) => (
                                        <SelectItem key={key} value={key}>{fmt.label}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <Badge variant="outline">
                                    {item.selectedType !== "unknown" 
                                      ? DATA_FORMATS[item.selectedType]?.label 
                                      : "不明"}
                                  </Badge>
                                )}
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
                                    ✓{item.result.inserted} / 
                                    ⊘{item.result.skipped} / 
                                    ✗{item.result.failed}
                                  </span>
                                )}
                                {item.error && (
                                  <span className="text-destructive">{item.error}</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {item.status === "pending" && (
                                  <Button variant="ghost" size="icon" onClick={() => removeFile(item.id)}>
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
              )}

              {/* Format Help */}
              {fileQueue.length === 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2">
                      <HelpCircle className="h-5 w-5" />
                      対応データ形式
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {Object.entries(DATA_FORMATS).map(([key, fmt]) => (
                        <div key={key} className="p-3 rounded-lg border text-sm">
                          <Badge variant="outline" className="mb-1">{fmt.label}</Badge>
                          <p className="text-muted-foreground text-xs">{fmt.description}</p>
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
              {/* Hidden input for re-import */}
              <input
                type="file"
                accept=".csv,.txt"
                multiple
                onChange={handleReimportFileSelected}
                className="hidden"
                ref={reimportInputRef}
              />
              {historyLoading ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  </CardContent>
                </Card>
              ) : Object.keys(groupedHistory).length > 0 ? (
                Object.entries(groupedHistory).map(([type, items]) => (
                  <Card key={type}>
                    <CardHeader className="py-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        {DATA_FORMATS[type as keyof typeof DATA_FORMATS]?.label || type}
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
                              <TableHead className="w-[100px]"></TableHead>
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
                                  ✓{item.records_inserted} / ⊘{item.records_skipped} / ✗{item.records_failed}
                                </TableCell>
                                <TableCell>
                                  {item.status === "completed" ? (
                                    <Badge variant="default"><CheckCircle className="h-3 w-3 mr-1" />完了</Badge>
                                  ) : (
                                    <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />失敗</Badge>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => handleReimport(type as DataType)}
                                    title="同じ形式で再インポート"
                                  >
                                    <RefreshCw className="h-4 w-4 text-muted-foreground hover:text-primary" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => deleteHistoryMutation.mutate(item.id)}
                                    disabled={deleteHistoryMutation.isPending}
                                  >
                                    <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                ))
              ) : (
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
