import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const RARITY_COLORS = {
  S: "#F59E0B",
  A: "#A855F7",
  B: "#3B82F6",
  C: "#22C55E",
  D: "#6B7280",
};

export default function Analytics() {
  const { data: transactions } = useQuery({
    queryKey: ["admin-analytics-transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_transactions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: gachas } = useQuery({
    queryKey: ["admin-analytics-gachas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("gacha_masters").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: cards } = useQuery({
    queryKey: ["admin-analytics-cards"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cards").select("*");
      if (error) throw error;
      return data;
    },
  });

  // Calculate stats
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
      date: date.slice(5), // MM-DD format
      revenue,
    }));
  })();

  return (
    <AdminLayout title="売上分析">
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">総売上</CardTitle>
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
