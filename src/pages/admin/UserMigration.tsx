import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { Users, Clock, UserCheck, RefreshCw, ShoppingCart, Package, CheckCircle, TrendingUp } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CSVImporter } from "@/components/admin/CSVImporter";

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

export default function UserMigration() {
  const { tenant } = useTenant();
  const { tenantId: authTenantId, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState("users");
  
  // Use tenant from URL if available, otherwise use tenant from auth
  const effectiveTenantId = tenant?.id || authTenantId;

  // Fetch migration stats
  const { data: stats, refetch: refetchStats, isLoading: statsLoading } = useQuery({
    queryKey: ["migration-stats", effectiveTenantId],
    queryFn: async (): Promise<MigrationStats> => {
      if (!effectiveTenantId) return { total: 0, applied: 0, pending: 0 };

      const [totalResult, appliedResult] = await Promise.all([
        supabase
          .from("user_migrations")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", effectiveTenantId),
        supabase
          .from("user_migrations")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", effectiveTenantId)
          .eq("is_applied", true),
      ]);

      if (totalResult.error) throw totalResult.error;
      if (appliedResult.error) throw appliedResult.error;

      const total = totalResult.count || 0;
      const applied = appliedResult.count || 0;

      return { total, applied, pending: total - applied };
    },
    enabled: !!effectiveTenantId,
  });

  // Fetch transaction count
  const { data: transactionCount, refetch: refetchTransactions } = useQuery({
    queryKey: ["transaction-count", effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return 0;
      const { count, error } = await supabase
        .from("user_transactions")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", effectiveTenantId);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!effectiveTenantId,
  });

  // Fetch inventory count
  const { data: inventoryCount, refetch: refetchInventory } = useQuery({
    queryKey: ["inventory-count", effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return 0;
      const { count, error } = await supabase
        .from("inventory_actions")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", effectiveTenantId);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!effectiveTenantId,
  });

  // Fetch daily analytics count
  const { data: analyticsCount, refetch: refetchAnalytics } = useQuery({
    queryKey: ["analytics-count", effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return 0;
      const { count, error } = await supabase
        .from("daily_analytics")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", effectiveTenantId);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!effectiveTenantId,
  });

  // Fetch recent migration records
  const { data: recentRecords, refetch: refetchRecords } = useQuery({
    queryKey: ["migration-records", effectiveTenantId],
    queryFn: async (): Promise<MigrationRecord[]> => {
      if (!effectiveTenantId) return [];

      const { data, error } = await supabase
        .from("user_migrations")
        .select("id, email, display_name, points_balance, is_applied, created_at")
        .eq("tenant_id", effectiveTenantId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    },
    enabled: !!effectiveTenantId,
  });

  const handleRefresh = () => {
    refetchStats();
    refetchRecords();
    refetchTransactions();
    refetchInventory();
    refetchAnalytics();
    toast.success("データを更新しました");
  };

  if (authLoading) {
    return (
      <AdminLayout title="データ移行">
        <div className="text-center text-muted-foreground py-12">
          読み込み中...
        </div>
      </AdminLayout>
    );
  }

  if (!effectiveTenantId) {
    return (
      <AdminLayout title="データ移行">
        <div className="text-center text-muted-foreground py-12">
          テナントに所属していないか、テナント情報を取得できません。
          <br />
          <span className="text-sm">テナント固有のルート（例: /gachamo/admin/migration）からアクセスしてください。</span>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="データ移行">
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">ユーザー移行</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statsLoading ? "..." : stats?.total || 0}</div>
              <p className="text-xs text-muted-foreground">
                適用済み: {stats?.applied || 0} / 待機: {stats?.pending || 0}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">取引履歴</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{transactionCount || 0}</div>
              <p className="text-xs text-muted-foreground">インポート済み</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">発送/変換履歴</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{inventoryCount || 0}</div>
              <p className="text-xs text-muted-foreground">インポート済み</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">日別売上</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analyticsCount || 0}</div>
              <p className="text-xs text-muted-foreground">日分</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">移行進捗</CardTitle>
              <UserCheck className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              {stats && stats.total > 0 ? (
                <>
                  <div className="text-2xl font-bold text-primary">
                    {Math.round((stats.applied / stats.total) * 100)}%
                  </div>
                  <Progress value={(stats.applied / stats.total) * 100} className="h-2 mt-2" />
                </>
              ) : (
                <div className="text-2xl font-bold text-muted-foreground">-</div>
              )}
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="users">ユーザー</TabsTrigger>
              <TabsTrigger value="transactions">取引履歴</TabsTrigger>
              <TabsTrigger value="inventory">発送/変換</TabsTrigger>
              <TabsTrigger value="analytics">日別売上</TabsTrigger>
              <TabsTrigger value="status">ステータス</TabsTrigger>
            </TabsList>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              更新
            </Button>
          </div>

          <TabsContent value="users" className="space-y-6">
            <CSVImporter
              tenantId={effectiveTenantId}
              functionName="import-user-migrations"
              title="ユーザーCSVインポート"
              description="ユーザー情報とポイント残高をインポートします"
              placeholder={`email,points_balance,last_name,first_name,phone_number,postal_code
test@example.com,5000,山田,太郎,090-1234-5678,123-4567`}
              onSuccess={() => { refetchStats(); refetchRecords(); }}
              formatHelp={
                <ul className="text-xs space-y-1 text-muted-foreground">
                  <li><code className="bg-muted px-1">email</code> - メールアドレス（必須）</li>
                  <li><code className="bg-muted px-1">points_balance</code> - ポイント残高</li>
                  <li><code className="bg-muted px-1">last_name / first_name</code> - 姓・名</li>
                  <li><code className="bg-muted px-1">phone_number</code> - 電話番号</li>
                  <li><code className="bg-muted px-1">postal_code</code> - 郵便番号</li>
                  <li><code className="bg-muted px-1">prefecture / city</code> - 都道府県・市区町村</li>
                  <li><code className="bg-muted px-1">address_line1 / address_line2</code> - 住所</li>
                </ul>
              }
            />
          </TabsContent>

          <TabsContent value="transactions" className="space-y-6">
            <CSVImporter
              tenantId={effectiveTenantId}
              functionName="import-transactions"
              title="取引履歴CSVインポート"
              description="過去のガチャ購入履歴をインポートします（ユーザーが先に登録されている必要があります）"
              placeholder={`user_email,gacha_title,play_count,total_spent_points,created_at
test@example.com,新春ガチャ,3,1500,2024-01-15`}
              onSuccess={() => refetchTransactions()}
              formatHelp={
                <ul className="text-xs space-y-1 text-muted-foreground">
                  <li><code className="bg-muted px-1">user_email</code> - ユーザーメール（必須）</li>
                  <li><code className="bg-muted px-1">gacha_title</code> - ガチャ名</li>
                  <li><code className="bg-muted px-1">play_count</code> - プレイ回数</li>
                  <li><code className="bg-muted px-1">total_spent_points</code> - 消費ポイント</li>
                  <li><code className="bg-muted px-1">created_at</code> - 購入日時</li>
                </ul>
              }
            />
            <Card className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
              <CardContent className="pt-4">
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  ⚠️ 注意: 取引履歴のインポートには、ユーザーが先にシステムに登録されている必要があります。
                  ユーザーが見つからない場合はスキップされます。
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="inventory" className="space-y-6">
            <CSVImporter
              tenantId={effectiveTenantId}
              functionName="import-inventory"
              title="発送/変換履歴CSVインポート"
              description="未発送アイテムや変換履歴をインポートします"
              placeholder={`user_email,card_name,action_type,status,tracking_number,converted_points
test@example.com,レアカードA,shipping,pending,,
test@example.com,コモンカードB,conversion,completed,,50`}
              onSuccess={() => refetchInventory()}
              formatHelp={
                <ul className="text-xs space-y-1 text-muted-foreground">
                  <li><code className="bg-muted px-1">user_email</code> - ユーザーメール（必須）</li>
                  <li><code className="bg-muted px-1">card_name</code> - カード名</li>
                  <li><code className="bg-muted px-1">action_type</code> - shipping / conversion</li>
                  <li><code className="bg-muted px-1">status</code> - pending / processing / completed / shipped</li>
                  <li><code className="bg-muted px-1">tracking_number</code> - 追跡番号（発送の場合）</li>
                  <li><code className="bg-muted px-1">converted_points</code> - 変換ポイント</li>
                </ul>
              }
            />
            <Card className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
              <CardContent className="pt-4">
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  ⚠️ 注意: ユーザーとカードが先にシステムに登録されている必要があります。
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <CSVImporter
              tenantId={effectiveTenantId}
              functionName="import-daily-analytics"
              title="日別売上CSVインポート"
              description="過去の日別売上データをインポートします"
              placeholder={`id,date,payment,rieki,point,status,created,modified
1,20230215,97920,-15580,113500,0,2023-02-15 00:00:00,2023-02-15 00:00:00`}
              onSuccess={() => refetchAnalytics()}
              formatHelp={
                <ul className="text-xs space-y-1 text-muted-foreground">
                  <li><code className="bg-muted px-1">id</code> - レコードID</li>
                  <li><code className="bg-muted px-1">date</code> - 日付（YYYYMMDD形式）</li>
                  <li><code className="bg-muted px-1">payment</code> - 売上金額</li>
                  <li><code className="bg-muted px-1">rieki</code> - 利益</li>
                  <li><code className="bg-muted px-1">point</code> - 使用ポイント</li>
                  <li><code className="bg-muted px-1">status</code> - ステータス</li>
                </ul>
              }
            />
          </TabsContent>

          <TabsContent value="status">
            <Card>
              <CardHeader>
                <CardTitle>移行レコード一覧</CardTitle>
                <CardDescription>最新50件を表示</CardDescription>
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
