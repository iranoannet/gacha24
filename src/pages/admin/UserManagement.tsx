import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Users } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export default function UserManagement() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: profiles, isLoading } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: userRoles } = useQuery({
    queryKey: ["admin-user-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: transactions } = useQuery({
    queryKey: ["admin-all-transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_transactions")
        .select("user_id, total_spent_points, play_count");
      if (error) throw error;
      return data;
    },
  });

  const getUserStats = (userId: string) => {
    const userTxs = transactions?.filter((t) => t.user_id === userId) || [];
    return {
      totalPlays: userTxs.reduce((acc, t) => acc + t.play_count, 0),
      totalSpent: userTxs.reduce((acc, t) => acc + t.total_spent_points, 0),
    };
  };

  const getUserRole = (userId: string) => {
    return userRoles?.find((r) => r.user_id === userId)?.role || "user";
  };

  const filteredProfiles = profiles?.filter((p) => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      p.display_name?.toLowerCase().includes(search) ||
      p.user_id.toLowerCase().includes(search)
    );
  });

  return (
    <AdminLayout title="ユーザー管理">
      <div className="space-y-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="名前、ユーザーIDで検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              ユーザー一覧 ({filteredProfiles?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">読み込み中...</p>
            ) : filteredProfiles?.length === 0 ? (
              <p className="text-muted-foreground">ユーザーがいません</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>表示名</TableHead>
                    <TableHead>ユーザーID</TableHead>
                    <TableHead>ロール</TableHead>
                    <TableHead>ポイント残高</TableHead>
                    <TableHead>総プレイ数</TableHead>
                    <TableHead>総消費pt</TableHead>
                    <TableHead>登録日</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProfiles?.map((profile) => {
                    const stats = getUserStats(profile.user_id);
                    const role = getUserRole(profile.user_id);
                    return (
                      <TableRow key={profile.id}>
                        <TableCell className="font-medium">
                          {profile.display_name || "未設定"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {profile.user_id.slice(0, 8)}...
                        </TableCell>
                        <TableCell>
                          <Badge variant={role === "admin" ? "default" : "secondary"}>
                            {role}
                          </Badge>
                        </TableCell>
                        <TableCell>{profile.points_balance.toLocaleString()}pt</TableCell>
                        <TableCell>{stats.totalPlays}回</TableCell>
                        <TableCell>{stats.totalSpent.toLocaleString()}pt</TableCell>
                        <TableCell>
                          {new Date(profile.created_at).toLocaleDateString("ja-JP")}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
