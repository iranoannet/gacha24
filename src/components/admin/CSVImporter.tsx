import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileText, CheckCircle, Play, Pause, Square } from "lucide-react";
import { Progress } from "@/components/ui/progress";

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

interface CSVImporterProps {
  tenantId: string;
  functionName: string;
  title: string;
  description: string;
  formatHelp: React.ReactNode;
  placeholder: string;
  onSuccess?: () => void;
}

const BATCH_SIZE = 100;

export function CSVImporter({
  tenantId,
  functionName,
  title,
  description,
  formatHelp,
  placeholder,
  onSuccess,
}: CSVImporterProps) {
  const [csvData, setCsvData] = useState("");
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

  const parseCSVLines = (csv: string): { header: string | null; lines: string[]; withHeaders: boolean } => {
    const allLines = csv.trim().split("\n").filter(line => line.trim());
    const firstLine = allLines[0]?.toLowerCase() || "";
    const withHeaders = firstLine.includes("email") || firstLine.includes("mail") || 
                       firstLine.includes("メール") || firstLine.includes("user");
    
    if (withHeaders) {
      return { header: allLines[0], lines: allLines.slice(1), withHeaders: true };
    } else {
      return { header: null, lines: allLines, withHeaders: false };
    }
  };

  const handleBatchImport = async () => {
    if (!csvData.trim()) {
      toast.error("CSVデータを入力してください");
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
      const batchCsv = withHeaders && header ? [header, ...batchLines].join("\n") : batchLines.join("\n");

      try {
        const response = await supabase.functions.invoke(functionName, {
          body: { tenant_id: tenantId, csv_data: batchCsv },
        });

        if (response.error) {
          allErrors.push(`バッチ${batchIndex + 1}: ${response.error.message}`);
        } else if (response.data) {
          insertedTotal += response.data.inserted || 0;
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
      onSuccess?.();
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
  const previewLines = csvData.trim().split("\n").slice(0, 5);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
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
              placeholder={placeholder}
              value={csvData}
              onChange={(e) => setCsvData(e.target.value)}
              className="mt-1 h-48 font-mono text-xs"
            />
          </div>

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
            disabled={isLoading || !csvData.trim()}
            className="w-full"
          >
            {isLoading ? "インポート中..." : "インポート開始"}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-6">
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

        {csvData && batchProgress.status === "idle" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                プレビュー
              </CardTitle>
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
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>CSVフォーマット</CardTitle>
          </CardHeader>
          <CardContent>{formatHelp}</CardContent>
        </Card>
      </div>
    </div>
  );
}
