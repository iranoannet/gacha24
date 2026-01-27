import { SuperAdminLayout } from "@/components/super-admin/SuperAdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const TENANT_COLORS = ["#8B5CF6", "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#EC4899", "#6366F1"];

export default function GlobalAnalytics() {
  const { data: tenants } = useQuery({
    queryKey: ["global-analytics-tenants"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tenants").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: transactions } = useQuery({
    queryKey: ["global-analytics-transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_transactions")
        .select("tenant_id, total_spent_points, created_at");
      if (error) throw error;
      return data;
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ["global-analytics-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("tenant_id");
      if (error) throw error;
      return data;
    },
  });

  // Revenue by tenant
  const revenueByTenant = tenants?.map((tenant, index) => {
    const tenantTransactions = transactions?.filter((t) => t.tenant_id === tenant.id) || [];
    const revenue = tenantTransactions.reduce((acc, t) => acc + t.total_spent_points, 0);
    return {
      name: tenant.name.length > 10 ? tenant.name.slice(0, 10) + "..." : tenant.name,
      revenue,
      color: TENANT_COLORS[index % TENANT_COLORS.length],
    };
  }).sort((a, b) => b.revenue - a.revenue) || [];

  // Add "未割当" for transactions without tenant
  const unassignedRevenue = transactions?.filter((t) => !t.tenant_id).reduce((acc, t) => acc + t.total_spent_points, 0) || 0;
  if (unassignedRevenue > 0) {
    revenueByTenant.push({ name: "未割当", revenue: unassignedRevenue, color: "#6B7280" });
  }

  // Users by tenant for pie chart
  const usersByTenant = tenants?.map((tenant, index) => {
    const count = profiles?.filter((p) => p.tenant_id === tenant.id).length || 0;
    return {
      name: tenant.name,
      value: count,
      color: TENANT_COLORS[index % TENANT_COLORS.length],
    };
  }).filter((t) => t.value > 0) || [];

  const unassignedUsers = profiles?.filter((p) => !p.tenant_id).length || 0;
  if (unassignedUsers > 0) {
    usersByTenant.push({ name: "未割当", value: unassignedUsers, color: "#6B7280" });
  }

  // Daily revenue (last 7 days)
  const dailyRevenue = (() => {
    const days: Record<string, number> = {};
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const key = date.toISOString().split("T")[0];
      days[key] = 0;
    }

    transactions?.forEach((t) => {
      const date = t.created_at.split("T")[0];
      if (days[date] !== undefined) {
        days[date] += t.total_spent_points;
      }
    });

    return Object.entries(days).map(([date, revenue]) => ({
      date: date.slice(5),
      revenue,
    }));
  })();

  const totalRevenue = transactions?.reduce((acc, t) => acc + t.total_spent_points, 0) || 0;
  const totalUsers = profiles?.length || 0;
  const activeTenantsCount = tenants?.filter((t) => t.is_active).length || 0;

  return (
    <SuperAdminLayout title="全体分析">
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">全体売上</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalRevenue.toLocaleString()}pt</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">全ユーザー数</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalUsers.toLocaleString()}人</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">アクティブテナント</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeTenantsCount}社</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>日別売上（過去7日間）</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number) => [`${value.toLocaleString()}pt`, "売上"]}
                    />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>テナント別ユーザー分布</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={usersByTenant}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {usersByTenant.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>テナント別売上</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueByTenant} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis dataKey="name" type="category" width={120} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    formatter={(value: number) => [`${value.toLocaleString()}pt`, "売上"]}
                  />
                  <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                    {revenueByTenant.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </SuperAdminLayout>
  );
}
