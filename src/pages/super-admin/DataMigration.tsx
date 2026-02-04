import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { SuperAdminLayout } from "@/components/super-admin/SuperAdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Building2, AlertCircle, Upload, FileText, CheckCircle, Play, Pause, Square, HelpCircle } from "lucide-react";
import { toast } from "sonner";

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
    label: "ユーザーデータ",
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
    label: "発送/変換データ (pack_cards)",
    functionName: "import-inventory",
    description: "pack_id, card_id, user_id, status などを含むガチャ結果データ",
  },
  "daily-sales": {
    type: "daily-sales",
    label: "日別売上データ",
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
  
  // pack_cards format (inventory)
  if (headerSet.has("pack_id") || headerSet.has("card_id") && headerSet.has("user_id") && headerSet.has("status")) {
    return "inventory";
  }
  
  // Daily sales (day_datas)
  if (headerSet.has("payment") || headerSet.has("payment_amount") || 
      (headerSet.has("date") && (headerSet.has("profit") || headerSet.has("points_used")))) {
    return "daily-sales";
  }
  
  // User data
  if ((headerSet.has("email") || headerSet.has("mail")) && 
      (headerSet.has("points_balance") || headerSet.has("availablepoint") || headerSet.has("lastname"))) {
    return "users";
  }
  
  // Transactions
  if (headerSet.has("user_email") && headerSet.has("total_spent_points")) {
    return "transactions";
  }
  
  // Shipping history
  if (headerSet.has("tracking_number") || headerSet.has("shipped_at") || headerSet.has("shire_state")) {
    return "shipping-history";
  }
  
  return "unknown";
}

const BATCH_SIZE = 100;

interface BatchProgress {
  currentBatch: number;
  totalBatches: number;
  processedRecords: number;
  totalRecords: number;
  insertedTotal: number;
  skippedTotal: number;
  userNotFoundTotal: number;
  errors: string[];
  status: "idle" | "running" | "paused" | "completed" | "stopped";
}

export default function DataMigration() {
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const [csvData, setCsvData] = useState("");
  const [detectedType, setDetectedType] = useState<DataType>("unknown");
  const [isLoading, setIsLoading] = useState(false);
  const [batchProgress, setBatchProgress] = useState<BatchProgress>({
    currentBatch: 0,
    totalBatches: 0,
    processedRecords: 0,
    totalRecords: 0,
    insertedTotal: 0,
    skippedTotal: 0,
    userNotFoundTotal: 0,
    errors: [],
    status: "idle",
  });
  
  const controlRef = useRef<{ paused: boolean; stopped: boolean }>({ paused: false, stopped: false });

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

  const selectedTenant = tenants?.find(t => t.id === selectedTenantId);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvData(text);
      
      // Auto-detect format
      const firstLine = text.trim().split("\n")[0] || "";
      const headers = firstLine.split(",").map(h => h.replace(/"/g, "").trim());
      const detected = detectDataType(headers);
      setDetectedType(detected);
      
      toast.success(`${file.name} を読み込みました`);
    };
    reader.onerror = () => {
      toast.error("ファイルの読み込みに失敗しました");
    };
    reader.readAsText(file);
  };

  const handleTextChange = (text: string) => {
    setCsvData(text);
    
    if (text.trim()) {
      const firstLine = text.trim().split("\n")[0] || "";
      const headers = firstLine.split(",").map(h => h.replace(/"/g, "").trim());
      const detected = detectDataType(headers);
      setDetectedType(detected);
    } else {
      setDetectedType("unknown");
    }
  };

  const parseCSVLines = (csv: string): { header: string | null; lines: string[]; withHeaders: boolean } => {
    const allLines = csv.trim().split("\n").filter(line => line.trim());
    // Always assume first line is header for auto-detection
    return { header: allLines[0], lines: allLines.slice(1), withHeaders: true };
  };

  const handleBatchImport = async () => {
    if (!csvData.trim()) {
      toast.error("CSVデータを入力してください");
      return;
    }

    if (!selectedTenantId) {
      toast.error("テナントを選択してください");
      return;
    }

    if (detectedType === "unknown") {
      toast.error("データ形式を判別できませんでした。ヘッダー行を確認してください");
      return;
    }

    const format = DATA_FORMATS[detectedType];
    
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      toast.error("ログインが必要です");
      return;
    }

    const { header, lines } = parseCSVLines(csvData);
    const totalRecords = lines.length;
    const totalBatches = Math.ceil(totalRecords / BATCH_SIZE);

    controlRef.current = { paused: false, stopped: false };

    setBatchProgress({
      currentBatch: 0,
      totalBatches,
      processedRecords: 0,
      totalRecords,
      insertedTotal: 0,
      skippedTotal: 0,
      userNotFoundTotal: 0,
      errors: [],
      status: "running",
    });

    setIsLoading(true);
    let insertedTotal = 0;
    let skippedTotal = 0;
    let userNotFoundTotal = 0;
    const allErrors: string[] = [];

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      if (controlRef.current.stopped) {
        setBatchProgress(prev => ({ ...prev, status: "stopped" }));
        toast.info("インポートを中止しました");
        break;
      }

      while (controlRef.current.paused && !controlRef.current.stopped) {
        setBatchProgress(prev => ({ ...prev, status: "paused" }));
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      if (controlRef.current.stopped) {
        setBatchProgress(prev => ({ ...prev, status: "stopped" }));
        break;
      }

      setBatchProgress(prev => ({ ...prev, status: "running" }));

      const startIdx = batchIndex * BATCH_SIZE;
      const endIdx = Math.min(startIdx + BATCH_SIZE, totalRecords);
      const batchLines = lines.slice(startIdx, endIdx);
      const batchCsv = header ? [header, ...batchLines].join("\n") : batchLines.join("\n");

      try {
        const response = await supabase.functions.invoke(format.functionName, {
          body: { tenant_id: selectedTenantId, csv_data: batchCsv },
        });

        if (response.error) {
          allErrors.push(`バッチ${batchIndex + 1}: ${response.error.message}`);
        } else if (response.data) {
          insertedTotal += response.data.inserted || response.data.total_records || 0;
          skippedTotal += response.data.skipped || 0;
          userNotFoundTotal += response.data.user_not_found || 0;
          if (response.data.errors) {
            allErrors.push(...response.data.errors);
          }
        }
      } catch (error) {
        allErrors.push(`バッチ${batchIndex + 1}: ${error instanceof Error ? error.message : "エラー"}`);
      }

      setBatchProgress({
        currentBatch: batchIndex + 1,
        totalBatches,
        processedRecords: endIdx,
        totalRecords,
        insertedTotal,
        skippedTotal,
        userNotFoundTotal,
        errors: allErrors,
        status: batchIndex + 1 === totalBatches ? "completed" : "running",
      });

      if (batchIndex < totalBatches - 1) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    setIsLoading(false);
    
    if (!controlRef.current.stopped) {
      setBatchProgress(prev => ({ ...prev, status: "completed" }));
      toast.success(`インポート完了: ${insertedTotal}件成功`);
    }
  };

  const handlePause = () => {
    controlRef.current.paused = true;
    toast.info("一時停止しました");
  };

  const handleResume = () => {
    controlRef.current.paused = false;
    toast.info("再開しました");
  };

  const handleStop = () => {
    controlRef.current.stopped = true;
    controlRef.current.paused = false;
  };

  const { lines: dataLines } = csvData ? parseCSVLines(csvData) : { lines: [] };
  const estimatedBatches = Math.ceil(dataLines.length / BATCH_SIZE);

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
            <CardDescription>
              データをインポートするテナントを選択してください
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-w-md">
              <Label htmlFor="tenant-select">対象テナント</Label>
              <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
                <SelectTrigger id="tenant-select" className="mt-1">
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

            {selectedTenant && (
              <Alert className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>{selectedTenant.name}</strong> にデータをインポートします
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Unified CSV Importer */}
        {selectedTenantId && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  CSVインポート
                </CardTitle>
                <CardDescription>
                  CSVをアップロードすると、データ形式を自動検出します
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
                    placeholder="CSVデータを貼り付け..."
                    value={csvData}
                    onChange={(e) => handleTextChange(e.target.value)}
                    className="mt-1 h-48 font-mono text-xs"
                  />
                </div>

                {/* Detected Format */}
                {csvData && (
                  <div className="p-4 rounded-lg border bg-muted/50">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4" />
                      <span className="font-medium">検出されたデータ形式:</span>
                    </div>
                    {detectedType !== "unknown" ? (
                      <div className="space-y-2">
                        <Badge variant="default" className="text-sm">
                          {DATA_FORMATS[detectedType].label}
                        </Badge>
                        <p className="text-sm text-muted-foreground">
                          {DATA_FORMATS[detectedType].description}
                        </p>
                      </div>
                    ) : (
                      <div className="text-destructive text-sm">
                        データ形式を判別できませんでした。ヘッダー行を確認してください。
                      </div>
                    )}
                  </div>
                )}

                {dataLines.length > 0 && (
                  <div className="p-3 bg-muted rounded-lg text-sm">
                    <p><strong>{dataLines.length.toLocaleString()}</strong> 件のレコード</p>
                    <p className="text-muted-foreground">
                      {BATCH_SIZE}件ずつ <strong>{estimatedBatches}</strong> バッチで処理
                    </p>
                  </div>
                )}

                <Button
                  onClick={handleBatchImport}
                  disabled={isLoading || !csvData.trim() || !selectedTenantId || detectedType === "unknown"}
                  className="w-full"
                >
                  {isLoading ? "インポート中..." : "インポート開始"}
                </Button>
              </CardContent>
            </Card>

            <div className="space-y-6">
              {/* Progress Card */}
              {batchProgress.status !== "idle" && (
                <Card className={
                  batchProgress.status === "completed" ? "border-primary" :
                  batchProgress.status === "stopped" ? "border-destructive" : ""
                }>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        {batchProgress.status === "completed" && <CheckCircle className="h-5 w-5 text-primary" />}
                        {batchProgress.status === "stopped" && <Square className="h-5 w-5 text-destructive" />}
                        {batchProgress.status === "running" && <Play className="h-5 w-5 text-primary animate-pulse" />}
                        {batchProgress.status === "paused" && <Pause className="h-5 w-5" />}
                        進捗
                      </span>
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
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Progress 
                      value={(batchProgress.processedRecords / batchProgress.totalRecords) * 100} 
                      className="h-3"
                    />
                    
                    <div className="grid grid-cols-4 gap-2 text-center text-sm">
                      <div>
                        <p className="text-lg font-bold">{batchProgress.processedRecords.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">処理済み</p>
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
                        <p className="text-lg font-bold text-destructive">{batchProgress.userNotFoundTotal.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">ユーザー不明</p>
                      </div>
                    </div>

                    {batchProgress.errors.length > 0 && (
                      <div className="p-2 bg-destructive/10 rounded text-xs text-destructive max-h-24 overflow-y-auto">
                        {batchProgress.errors.slice(-5).map((err, i) => (
                          <p key={i}>{err}</p>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Format Help */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <HelpCircle className="h-5 w-5" />
                    対応データ形式
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="space-y-3">
                    {Object.values(DATA_FORMATS).map((format) => (
                      <div key={format.type} className="p-3 rounded-lg border">
                        <Badge variant="outline" className="mb-1">{format.label}</Badge>
                        <p className="text-muted-foreground text-xs">{format.description}</p>
                      </div>
                    ))}
                  </div>
                  
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      <strong>インポート順序:</strong> ユーザー → 取引履歴/発送変換 → 日別売上 の順で行ってください。
                      ユーザーのlegacy_user_idが先に登録されていないと、他のデータの紐付けができません。
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </div>
          </div>
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
