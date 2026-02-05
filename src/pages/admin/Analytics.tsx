import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const [viewMode, setViewMode] = useState<"daily" | "monthly">("daily");

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
  const totalCost = dailyAnalytics?.reduce((acc, d) => acc + (d.cost || 0), 0) || 0;
  const avgProfitMargin = dailyAnalytics && dailyAnalytics.length > 0
    ? (dailyAnalytics.reduce((acc, d) => acc + (d.gross_profit_margin || 0), 0) / dailyAnalytics.length).toFixed(1)
    : "0";

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

  // Process data based on view mode
  const processedChartData = (() => {
    if (!dailyAnalytics || dailyAnalytics.length === 0) return [];

    // Helper to filter outliers (values beyond 3 standard deviations)
    const filterOutliers = (data: typeof dailyAnalytics) => {
      const profits = data.map(d => d.profit || 0).filter(v => v !== 0);
      if (profits.length === 0) return data;
      
      const mean = profits.reduce((a, b) => a + b, 0) / profits.length;
      const stdDev = Math.sqrt(profits.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / profits.length);
      const threshold = stdDev * 3;
      
      return data.map(d => {
        const profit = d.profit || 0;
        // Cap extreme outliers
        if (Math.abs(profit - mean) > threshold) {
          return { ...d, profit: profit > mean ? mean + threshold : mean - threshold };
        }
        return d;
      });
    };

    if (viewMode === "daily") {
      // Daily view - last 30 days
      const filtered = filterOutliers(dailyAnalytics.slice(0, 30));
      return filtered
        .reverse()
        .map((d) => ({
          date: d.date.slice(5), // MM-DD format
          売上: d.payment_amount || 0,
          粗利: d.profit || 0,
          コスト: d.cost || 0,
          利益率: d.gross_profit_margin || 0,
        }));
    } else {
      // Monthly view - aggregate by month
      const monthlyMap = new Map<string, { payment: number; profit: number; cost: number; marginSum: number; count: number }>();
      
      const filtered = filterOutliers(dailyAnalytics);
      filtered.forEach((d) => {
        const monthKey = d.date.slice(0, 7); // YYYY-MM
        const existing = monthlyMap.get(monthKey) || { payment: 0, profit: 0, cost: 0, marginSum: 0, count: 0 };
        monthlyMap.set(monthKey, {
          payment: existing.payment + (d.payment_amount || 0),
          profit: existing.profit + (d.profit || 0),
          cost: existing.cost + (d.cost || 0),
          marginSum: existing.marginSum + (d.gross_profit_margin || 0),
          count: existing.count + 1,
        });
      });

      return Array.from(monthlyMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-12) // Last 12 months
        .map(([month, data]) => ({
          date: month.slice(2), // YY-MM format
          売上: data.payment,
          粗利: data.profit,
          コスト: data.cost,
          利益率: data.count > 0 ? Math.round(data.marginSum / data.count * 10) / 10 : 0,
        }));
    }
  })();

  // Chart data for revenue/profit/cost (left Y axis)
  const revenueChartData = processedChartData.map((d) => ({
    date: d.date,
    売上: d.売上,
    粗利: d.粗利,
    コスト: d.コスト,
  }));

  // Chart data for profit margin (right Y axis - percentage)
  const marginChartData = processedChartData.map((d) => ({
    date: d.date,
    利益率: d.利益率,
  }));

  return (
    <AdminLayout title="売上分析">
      <div className="space-y-6">
        {/* Legacy data summary */}
        {dailyAnalytics && dailyAnalytics.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
                <CardTitle className="text-sm text-muted-foreground">総コスト（レガシー）</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">¥{totalCost.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">平均利益率</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{avgProfitMargin}%</div>
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

        {/* Daily/Monthly data boxes */}
        {dailyAnalytics && dailyAnalytics.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  {viewMode === "daily" ? "日別" : "月別"}データ（レガシー）
                </CardTitle>
                <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "daily" | "monthly")}>
                  <TabsList>
                    <TabsTrigger value="daily">日別</TabsTrigger>
                    <TabsTrigger value="monthly">月別</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {processedChartData.map((item, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="text-sm font-medium text-muted-foreground mb-3">
                      {viewMode === "daily" ? item.date : `${item.date}月`}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">売上</p>
                        <p className="text-lg font-bold">¥{item.売上.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">粗利</p>
                        <p className={`text-lg font-bold ${item.粗利 < 0 ? "text-red-500" : ""}`}>
                          ¥{item.粗利.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">コスト</p>
                        <p className="text-lg font-bold">¥{item.コスト.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">利益率</p>
                        <p className="text-lg font-bold">{item.利益率.toFixed(1)}%</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {processedChartData.length > 0 && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>
                  {viewMode === "daily" ? "日別" : "月別"}推移グラフ
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={revenueChartData}>
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
                      <Line type="monotone" dataKey="コスト" stroke="#F59E0B" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                {/* Profit margin chart */}
                <div className="mt-6">
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">利益率推移</h4>
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={marginChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} unit="%" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                          formatter={(value: number) => [`${value.toFixed(1)}%`, "利益率"]}
                        />
                        <Line type="monotone" dataKey="利益率" stroke="#EF4444" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
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
