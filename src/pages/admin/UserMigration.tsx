import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { Upload, FileText, CheckCircle, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export default function UserMigration() {
  const { tenant, tenantSlug } = useTenant();
  const [csvData, setCsvData] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    total_records?: number;
    inserted?: number;
    skipped?: number;
    errors?: string[];
  } | null>(null);

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

  const handleImport = async () => {
    if (!csvData.trim()) {
      toast.error("CSVデータを入力してください");
      return;
    }

    if (!tenant?.id) {
      toast.error("テナント情報が取得できません");
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        toast.error("ログインが必要です");
        return;
      }

      const response = await supabase.functions.invoke("import-user-migrations", {
        body: {
          tenant_id: tenant.id,
          csv_data: csvData,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      setResult(response.data);
      
      if (response.data.success) {
        toast.success(`${response.data.inserted}件のユーザーデータをインポートしました`);
      } else {
        toast.error("インポートに失敗しました");
      }
    } catch (error) {
      console.error("Import error:", error);
      toast.error(error instanceof Error ? error.message : "インポートエラー");
    } finally {
      setIsLoading(false);
    }
  };

  const previewLines = csvData.trim().split("\n").slice(0, 6);

  return (
    <AdminLayout title="ユーザー移行">
      <div className="space-y-6">
        <p className="text-muted-foreground">
          旧システムからユーザーデータをインポートします
        </p>

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

              <Button
                onClick={handleImport}
                disabled={isLoading || !csvData.trim()}
                className="w-full"
              >
                {isLoading ? "インポート中..." : "インポート実行"}
              </Button>
            </CardContent>
          </Card>

          {/* Preview & Result Section */}
          <div className="space-y-6">
            {/* CSV Preview */}
            {csvData && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    プレビュー
                  </CardTitle>
                  <CardDescription>
                    {csvData.trim().split("\n").length - 1} 件のレコード
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

            {/* Result */}
            {result && (
              <Card className={result.success ? "border-primary" : "border-destructive"}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {result.success ? (
                      <CheckCircle className="h-5 w-5 text-primary" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-destructive" />
                    )}
                    インポート結果
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold">{result.total_records}</p>
                      <p className="text-xs text-muted-foreground">総件数</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-primary">{result.inserted}</p>
                      <p className="text-xs text-muted-foreground">成功</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-accent-foreground">{result.skipped}</p>
                      <p className="text-xs text-muted-foreground">スキップ</p>
                    </div>
                  </div>
                  
                  {result.inserted && result.total_records && (
                    <Progress 
                      value={(result.inserted / result.total_records) * 100} 
                      className="h-2"
                    />
                  )}

                  {result.errors && result.errors.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-destructive mb-2">エラー:</p>
                      <ul className="text-xs text-destructive space-y-1">
                        {result.errors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
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
      </div>
    </AdminLayout>
  );
}
