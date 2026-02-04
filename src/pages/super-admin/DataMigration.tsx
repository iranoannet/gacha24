import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SuperAdminLayout } from "@/components/super-admin/SuperAdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CSVImporter } from "@/components/admin/CSVImporter";
import { supabase } from "@/integrations/supabase/client";
import { Building2, AlertCircle } from "lucide-react";

export default function DataMigration() {
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");

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

        {/* Import Tabs */}
        {selectedTenantId ? (
          <Tabs defaultValue="users" className="space-y-4">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="users">ユーザー</TabsTrigger>
              <TabsTrigger value="transactions">取引履歴</TabsTrigger>
              <TabsTrigger value="inventory">発送/変換</TabsTrigger>
              <TabsTrigger value="daily-sales">日別売上</TabsTrigger>
              <TabsTrigger value="shipping-history">発送履歴</TabsTrigger>
            </TabsList>

            <TabsContent value="users">
              <CSVImporter
                tenantId={selectedTenantId}
                functionName="import-user-migrations"
                title="ユーザーデータインポート"
                description="旧システムのユーザーデータをインポートします"
                placeholder="email,display_name,points_balance,legacy_user_id..."
                formatHelp={
                  <div className="text-sm space-y-2">
                    <p><strong>必須列:</strong> email</p>
                    <p><strong>オプション:</strong> display_name, last_name, first_name, points_balance, phone_number, postal_code, prefecture, city, address_line1, address_line2, legacy_user_id</p>
                    <p className="text-muted-foreground">※ legacy_user_idは取引履歴との紐付けに必要です</p>
                  </div>
                }
              />
            </TabsContent>

            <TabsContent value="transactions">
              <CSVImporter
                tenantId={selectedTenantId}
                functionName="import-transactions"
                title="取引履歴インポート"
                description="旧システムの取引履歴をインポートします"
                placeholder="user_email,gacha_title,play_count,total_spent_points,created_at..."
                formatHelp={
                  <div className="text-sm space-y-2">
                    <p><strong>必須列:</strong> user_email, total_spent_points</p>
                    <p><strong>オプション:</strong> gacha_title, play_count, created_at, status</p>
                  </div>
                }
              />
            </TabsContent>

            <TabsContent value="inventory">
              <CSVImporter
                tenantId={selectedTenantId}
                functionName="import-inventory"
                title="発送/変換データインポート"
                description="pack_cards.csv形式のデータをインポートします"
                placeholder="id,pack_id,card_id,user_id,num,price,sale_price,stock_sale_price,redemption_point,show_list,hit_count,order,attention_mode,action_type,status,created,modified"
                formatHelp={
                  <div className="text-sm space-y-2">
                    <p><strong>pack_cards形式:</strong></p>
                    <ul className="list-disc list-inside text-muted-foreground">
                      <li>user_id &gt; 0 のレコードのみ処理</li>
                      <li>status=1 → 発送, status=0 → ポイント還元</li>
                      <li>user_migrationsのlegacy_user_idで紐付け</li>
                    </ul>
                    <p className="text-destructive">※ 先にユーザーデータをインポートしてください</p>
                  </div>
                }
              />
            </TabsContent>

            <TabsContent value="daily-sales">
              <CSVImporter
                tenantId={selectedTenantId}
                functionName="import-daily-analytics"
                title="日別売上インポート"
                description="日別の売上・粗利データをインポートします"
                placeholder="id,date(YYYYMMDD),payment_amount,profit,points_used,status"
                formatHelp={
                  <div className="text-sm space-y-2">
                    <p><strong>列の説明:</strong></p>
                    <ul className="list-disc list-inside text-muted-foreground">
                      <li>date: YYYYMMDD形式（例: 20250202）</li>
                      <li>payment_amount: 売上</li>
                      <li>profit: 粗利</li>
                      <li>points_used: 利用ポイント</li>
                    </ul>
                  </div>
                }
              />
            </TabsContent>

            <TabsContent value="shipping-history">
              <CSVImporter
                tenantId={selectedTenantId}
                functionName="import-shipping-history"
                title="発送履歴インポート"
                description="発送履歴データをインポートします"
                placeholder="user_email,card_name,tracking_number,status,shipped_at..."
                formatHelp={
                  <div className="text-sm space-y-2">
                    <p><strong>必須列:</strong> user_email</p>
                    <p><strong>オプション:</strong> card_name, tracking_number, status, shipped_at</p>
                  </div>
                }
              />
            </TabsContent>
          </Tabs>
        ) : (
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
