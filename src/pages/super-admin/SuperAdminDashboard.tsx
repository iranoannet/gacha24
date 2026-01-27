import { SuperAdminLayout } from "@/components/super-admin/SuperAdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, Package, CircleDollarSign } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function SuperAdminDashboard() {
  const { data: stats } = useQuery({
    queryKey: ["super-admin-stats"],
    queryFn: async () => {
      const [tenants, profiles, gachas, transactions] = await Promise.all([
        supabase.from("tenants").select("id", { count: "exact" }),
        supabase.from("profiles").select("id", { count: "exact" }),
        supabase.from("gacha_masters").select("id", { count: "exact" }),
        supabase.from("user_transactions").select("total_spent_points"),
      ]);

      const totalRevenue = transactions.data?.reduce((acc, t) => acc + (t.total_spent_points || 0), 0) || 0;

      return {
        totalTenants: tenants.count || 0,
        totalUsers: profiles.count || 0,
        totalGachas: gachas.count || 0,
        totalRevenue,
      };
    },
  });

  const { data: tenantsList } = useQuery({
    queryKey: ["super-admin-tenants-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  const statCards = [
    { title: "テナント数", value: stats?.totalTenants || 0, icon: Building2, color: "text-purple-500" },
    { title: "総ユーザー数", value: stats?.totalUsers || 0, icon: Users, color: "text-blue-500" },
    { title: "総ガチャ数", value: stats?.totalGachas || 0, icon: Package, color: "text-green-500" },
    { title: "全体売上 (pt)", value: stats?.totalRevenue?.toLocaleString() || 0, icon: CircleDollarSign, color: "text-primary" },
  ];

  return (
    <SuperAdminLayout title="スーパー管理ダッシュボード">
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">最近のテナント</CardTitle>
          </CardHeader>
          <CardContent>
            {tenantsList && tenantsList.length > 0 ? (
              <div className="space-y-2">
                {tenantsList.map((tenant) => (
                  <div key={tenant.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                        style={{ backgroundColor: tenant.primary_color || '#D4AF37' }}
                      >
                        {tenant.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium">{tenant.name}</p>
                        <p className="text-xs text-muted-foreground">{tenant.slug}</p>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${tenant.is_active ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                      {tenant.is_active ? '有効' : '無効'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">テナントがまだありません</p>
            )}
          </CardContent>
        </Card>
      </div>
    </SuperAdminLayout>
  );
}
