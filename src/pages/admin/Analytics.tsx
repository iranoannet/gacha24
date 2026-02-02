import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";
import { useTenant } from "@/hooks/useTenant";

const RARITY_COLORS = {
  S: "#F59E0B",
  A: "#A855F7",
  B: "#3B82F6",
  C: "#22C55E",
  D: "#6B7280",
};

export default function Analytics() {
  const { tenant } = useTenant();
  const tenantId = tenant?.id;

  // Daily analytics from legacy data
  const { data: dailyAnalytics } = useQuery({
    queryKey: ["admin-daily-analytics", tenantId],
    queryFn: async () => {
      let query = supabase
        .from("daily_analytics")
        .select("*")
        .order("date", { ascending: false })
        .limit(365);
      
      if (tenantId) {
        query = query.eq("tenant_id", tenantId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: transactions } = useQuery({
    queryKey: ["admin-analytics-transactions", tenantId],
    queryFn: async () => {
      let query = supabase
        .from("user_transactions")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (tenantId) {
        query = query.eq("tenant_id", tenantId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: gachas } = useQuery({
    queryKey: ["admin-analytics-gachas", tenantId],
    queryFn: async () => {
      let query = supabase.from("gacha_masters").select("*");
      if (tenantId) {
        query = query.eq("tenant_id", tenantId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: cards } = useQuery({
    queryKey: ["admin-analytics-cards", tenantId],
    queryFn: async () => {
      let query = supabase.from("cards").select("*");
      if (tenantId) {
        query = query.eq("tenant_id", tenantId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Calculate stats from daily_analytics (legacy data)
  const totalPayment = dailyAnalytics?.reduce((acc, d) => acc + (d.payment_amount || 0), 0) || 0;
  const totalProfit = dailyAnalytics?.reduce((acc, d) => acc + (d.profit || 0), 0) || 0;
  const totalPointsUsed = dailyAnalytics?.reduce((acc, d) => acc + (d.points_used || 0), 0) || 0;

  // Calculate stats from transactions (current system)
  const totalRevenue = transactions?.reduce((acc, t) => acc + t.total_spent_points, 0) || 0;
  const totalPlays = transactions?.reduce((acc, t) => acc + t.play_count, 0) || 0;
  const averagePlayValue = totalPlays > 0 ? Math.round(totalRevenue / totalPlays) : 0;

  // Gacha performance data
  const gachaPerformance = gachas?.map((gacha) => {
    const gachaTxs = transactions?.filter((t) => t.gacha_id === gacha.id) || [];
    return {
      name: gacha.title.slice(0, 15) + (gacha.title.length > 15 ? "..." : ""),
      revenue: gachaTxs.reduce((acc, t) => acc + t.total_spent_points, 0),
      plays: gachaTxs.reduce((acc, t) => acc + t.play_count, 0),
    };
  }).sort((a, b) => b.revenue - a.revenue).slice(0, 10) || [];

  // Rarity distribution
  const rarityDistribution = Object.entries(
    cards?.reduce((acc, card) => {
      acc[card.rarity] = (acc[card.rarity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {}
  ).map(([rarity, count]) => ({
    name: rarity,
    value: count,
    color: RARITY_COLORS[rarity as keyof typeof RARITY_COLORS] || "#6B7280",
  }));

  // Daily revenue from daily_analytics (last 30 days, sorted ascending for chart)
  const dailyRevenueData = dailyAnalytics
    ?.slice(0, 30)
    .reverse()
    .map((d) => ({
      date: d.date.slice(5), // MM-DD format
      売上: d.payment_amount || 0,
      粗利: d.profit || 0,
      ポイント利用: d.points_used || 0,
    })) || [];

  return (
    <AdminLayout title="売上分析">
      <div className="space-y-6">
        {/* Legacy data summary */}
        {dailyAnalytics && dailyAnalytics.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">総売上（レガシー）</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">¥{totalPayment.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">総粗利（レガシー）</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">¥{totalProfit.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">総ポイント利用（レガシー）</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalPointsUsed.toLocaleString()}pt</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Current system data */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">総売上（現行）</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalRevenue.toLocaleString()}pt</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">総プレイ回数</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalPlays.toLocaleString()}回</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">平均単価</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{averagePlayValue.toLocaleString()}pt</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Daily revenue chart from legacy data */}
          {dailyRevenueData.length > 0 && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>日別売上・粗利（レガシー過去30日間）</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyRevenueData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                        formatter={(value: number) => [`¥${value.toLocaleString()}`]}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="売上" stroke="#3B82F6" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="粗利" stroke="#10B981" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>レアリティ分布</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={rarityDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {rarityDistribution.map((entry, index) => (
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
            <CardTitle>ガチャ別パフォーマンス</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={gachaPerformance} layout="vertical">
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
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
