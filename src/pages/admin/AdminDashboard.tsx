import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Truck, CircleDollarSign, ShoppingCart } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function AdminDashboard() {
  const { tenant } = useTenant();

  const { data: stats } = useQuery({
    queryKey: ["admin-stats", tenant?.id],
    queryFn: async () => {
      // Build queries with tenant filter
      let gachasQuery = supabase.from("gacha_masters").select("id", { count: "exact" });
      let transactionsQuery = supabase.from("user_transactions").select("total_spent_points");
      let pendingShippingQuery = supabase.from("inventory_actions").select("id", { count: "exact" }).eq("status", "pending").eq("action_type", "shipping");

      // Apply tenant filter if tenant exists
      if (tenant?.id) {
        gachasQuery = gachasQuery.eq("tenant_id", tenant.id);
        transactionsQuery = transactionsQuery.eq("tenant_id", tenant.id);
        pendingShippingQuery = pendingShippingQuery.eq("tenant_id", tenant.id);
      }

      const [gachas, transactions, pendingShipping] = await Promise.all([
        gachasQuery,
        transactionsQuery,
        pendingShippingQuery,
      ]);

      const totalRevenue = transactions.data?.reduce((acc, t) => acc + (t.total_spent_points || 0), 0) || 0;

      return {
        totalGachas: gachas.count || 0,
        totalTransactions: transactions.data?.length || 0,
        pendingShipping: pendingShipping.count || 0,
        totalRevenue,
      };
    },
  });

  // 未発送リストを取得
  const { data: pendingShipments } = useQuery({
    queryKey: ["admin-pending-shipments", tenant?.id],
    queryFn: async () => {
      let query = supabase
        .from("inventory_actions")
        .select(`
          id,
          requested_at,
          user_id,
          card_id,
          cards:card_id (name, image_url)
        `)
        .eq("action_type", "shipping")
        .eq("status", "pending")
        .order("requested_at", { ascending: false })
        .limit(5);

      if (tenant?.id) {
        query = query.eq("tenant_id", tenant.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const statCards = [
    { title: "総ガチャ数", value: stats?.totalGachas || 0, icon: Package, color: "text-blue-500" },
    { title: "総取引数", value: stats?.totalTransactions || 0, icon: ShoppingCart, color: "text-green-500" },
    { title: "発送待ち", value: stats?.pendingShipping || 0, icon: Truck, color: "text-orange-500" },
    { title: "総売上 (pt)", value: stats?.totalRevenue?.toLocaleString() || 0, icon: CircleDollarSign, color: "text-primary" },
  ];

  return (
    <AdminLayout title={tenant ? `${tenant.name} ダッシュボード` : "ダッシュボード"}>
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">最近の取引</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">取引データがありません</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>発送待ちリスト</span>
                {(stats?.pendingShipping || 0) > 0 && (
                  <Badge variant="secondary">{stats?.pendingShipping}件</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pendingShipments && pendingShipments.length > 0 ? (
                <div className="space-y-3">
                  {pendingShipments.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg">
                      {item.cards?.image_url ? (
                        <img 
                          src={item.cards.image_url} 
                          alt={item.cards.name || ""} 
                          className="w-10 h-10 object-cover rounded"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-muted rounded flex items-center justify-center">
                          <Package className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {item.cards?.name || "不明なカード"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(item.requested_at).toLocaleDateString("ja-JP")}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-orange-500 border-orange-500">
                        未発送
                      </Badge>
                    </div>
                  ))}
                  {(stats?.pendingShipping || 0) > 5 && (
                    <Link to="/admin/shipping">
                      <Button variant="outline" size="sm" className="w-full mt-2">
                        すべて表示 ({stats?.pendingShipping}件)
                      </Button>
                    </Link>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">発送待ちの商品がありません</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
