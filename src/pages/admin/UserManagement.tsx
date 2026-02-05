import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Search, Users, MessageSquare, Plus, Minus, Send, Clock, UserCheck, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";

interface ProfileWithEmail {
  id: string;
  user_id: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  points_balance: number;
  created_at: string;
  last_login_at: string | null;
  email: string | null;
  tenant_id: string | null;
}

type SortColumn = "points" | "totalPaid" | "monthlyPaid" | "lastLogin";
type SortDirection = "asc" | "desc";

interface MigrationUser {
  id: string;
  email: string;
  display_name: string | null;
  points_balance: number | null;
  is_applied: boolean | null;
  created_at: string | null;
  phone_number: string | null;
  last_name: string | null;
  first_name: string | null;
}

const ITEMS_PER_PAGE = 50;

export default function UserManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<ProfileWithEmail | null>(null);
  const [pointAdjustment, setPointAdjustment] = useState(0);
  const [newNote, setNewNote] = useState("");
  const [activeTab, setActiveTab] = useState("active");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const queryClient = useQueryClient();
  const { user: adminUser } = useAuth();
  const { tenant } = useTenant();

  const { data: profiles, isLoading } = useQuery({
    queryKey: ["admin-profiles-v2", tenant?.id],
    queryFn: async () => {
      const batchSize = 1000;
      let allData: ProfileWithEmail[] = [];
      let hasMore = true;
      let offset = 0;

      while (hasMore) {
        let query = supabase
          .from("profiles")
          .select("*")
          .order("created_at", { ascending: false })
          .range(offset, offset + batchSize - 1);
        
        if (tenant?.id) {
          query = query.eq("tenant_id", tenant.id);
        }
        
        const { data, error } = await query;
        if (error) throw error;

        if (data && data.length > 0) {
          allData = [...allData, ...(data as ProfileWithEmail[])];
          offset += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      return allData;
    },
  });

  // Fetch pending migration count (accurate)
  const { data: pendingMigrationCount } = useQuery({
    queryKey: ["admin-pending-migrations-count", tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return 0;
      
      const { count, error } = await supabase
        .from("user_migrations")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenant.id)
        .eq("is_applied", false);
      
      if (error) throw error;
      return count || 0;
    },
    enabled: !!tenant?.id,
  });

  // Fetch pending migration users (limited for display)
  const { data: pendingMigrations, isLoading: migrationsLoading } = useQuery({
    queryKey: ["admin-pending-migrations", tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      
      const { data, error } = await supabase
        .from("user_migrations")
        .select("id, email, display_name, points_balance, is_applied, created_at, phone_number, last_name, first_name")
        .eq("tenant_id", tenant.id)
        .eq("is_applied", false)
        .order("created_at", { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data as MigrationUser[];
    },
    enabled: !!tenant?.id,
  });

  const { data: userRoles } = useQuery({
    queryKey: ["admin-user-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: payments } = useQuery({
    queryKey: ["admin-all-payments", tenant?.id],
    queryFn: async () => {
      const batchSize = 1000;
      let allData: any[] = [];
      let hasMore = true;
      let offset = 0;

      while (hasMore) {
        let query = supabase
          .from("payments")
          .select("user_id, amount, created_at")
          .range(offset, offset + batchSize - 1);
        
        if (tenant?.id) {
          query = query.eq("tenant_id", tenant.id);
        }
        
        const { data, error } = await query;
        if (error) throw error;

        if (data && data.length > 0) {
          allData = [...allData, ...data];
          offset += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      return allData;
    },
  });

  const { data: transactions } = useQuery({
    queryKey: ["admin-all-transactions", tenant?.id],
    queryFn: async () => {
      const batchSize = 1000;
      let allData: any[] = [];
      let hasMore = true;
      let offset = 0;

      while (hasMore) {
        let query = supabase
          .from("user_transactions")
          .select("user_id, total_spent_points, play_count")
          .range(offset, offset + batchSize - 1);
        
        if (tenant?.id) {
          query = query.eq("tenant_id", tenant.id);
        }
        
        const { data, error } = await query;
        if (error) throw error;

        if (data && data.length > 0) {
          allData = [...allData, ...data];
          offset += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      return allData;
    },
  });

  const { data: userNotes } = useQuery({
    queryKey: ["admin-user-notes", selectedUser?.user_id],
    queryFn: async () => {
      if (!selectedUser) return [];
      const { data, error } = await supabase
        .from("admin_user_notes")
        .select("*")
        .eq("user_id", selectedUser.user_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedUser,
  });

  const adjustPointsMutation = useMutation({
    mutationFn: async ({ profileId, adjustment }: { profileId: string; adjustment: number }) => {
      const profile = profiles?.find(p => p.id === profileId);
      if (!profile) throw new Error("Profile not found");
      
      const newBalance = Math.max(0, profile.points_balance + adjustment);
      // Use profile ID to update the specific tenant profile
      const { error } = await supabase
        .from("profiles")
        .update({ points_balance: newBalance })
        .eq("id", profileId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-profiles-v2", tenant?.id] });
      toast.success("ポイントを更新しました");
      setPointAdjustment(0);
    },
    onError: () => {
      toast.error("ポイント更新に失敗しました");
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: async ({ userId, note }: { userId: string; note: string }) => {
      const { error } = await supabase.from("admin_user_notes").insert({
        user_id: userId,
        admin_id: adminUser?.id || "",
        note,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-user-notes"] });
      toast.success("メモを追加しました");
      setNewNote("");
    },
    onError: () => {
      toast.error("メモ追加に失敗しました");
    },
  });

  const getUserStats = (userId: string) => {
    const userTxs = transactions?.filter((t) => t.user_id === userId) || [];
    const userPayments = payments?.filter((p) => p.user_id === userId) || [];
    
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyPayments = userPayments.filter(
      (p) => new Date(p.created_at) >= monthStart
    );

    return {
      totalPlays: userTxs.reduce((acc, t) => acc + t.play_count, 0),
      totalSpent: userTxs.reduce((acc, t) => acc + t.total_spent_points, 0),
      totalPaid: userPayments.reduce((acc, p) => acc + p.amount, 0),
      monthlyPaid: monthlyPayments.reduce((acc, p) => acc + p.amount, 0),
    };
  };

  const getUserRole = (userId: string) => {
    return userRoles?.find((r) => r.user_id === userId)?.role || "user";
  };

  const getDisplayName = (profile: ProfileWithEmail) => {
    // First try to use first_name + last_name
    const fullName = `${profile.last_name || ""} ${profile.first_name || ""}`.trim();
    if (fullName) return fullName;
    // Fall back to display_name
    if (profile.display_name) return profile.display_name;
    return "未設定";
  };

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
    setCurrentPage(1);
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="w-4 h-4 ml-1 opacity-50" />;
    }
    return sortDirection === "asc" 
      ? <ArrowUp className="w-4 h-4 ml-1" />
      : <ArrowDown className="w-4 h-4 ml-1" />;
  };

  const filteredProfiles = profiles?.filter((p) => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      p.display_name?.toLowerCase().includes(search) ||
      p.first_name?.toLowerCase().includes(search) ||
      p.last_name?.toLowerCase().includes(search) ||
      p.user_id.toLowerCase().includes(search) ||
      p.email?.toLowerCase().includes(search)
    );
  });

  // Sorted and paginated profiles
  const sortedAndPaginatedProfiles = useMemo(() => {
    if (!filteredProfiles) return [];
    
    let sorted = [...filteredProfiles];
    
    if (sortColumn) {
      sorted.sort((a, b) => {
        const statsA = getUserStats(a.user_id);
        const statsB = getUserStats(b.user_id);
        
        let valA: number | string | null;
        let valB: number | string | null;
        
        switch (sortColumn) {
          case "points":
            valA = a.points_balance;
            valB = b.points_balance;
            break;
          case "totalPaid":
            valA = statsA.totalPaid;
            valB = statsB.totalPaid;
            break;
          case "monthlyPaid":
            valA = statsA.monthlyPaid;
            valB = statsB.monthlyPaid;
            break;
          case "lastLogin":
            valA = a.last_login_at ? new Date(a.last_login_at).getTime() : 0;
            valB = b.last_login_at ? new Date(b.last_login_at).getTime() : 0;
            break;
          default:
            return 0;
        }
        
        if (valA < valB) return sortDirection === "asc" ? -1 : 1;
        if (valA > valB) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }
    
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return sorted.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredProfiles, sortColumn, sortDirection, currentPage, payments, transactions]);

  const totalPages = Math.ceil((filteredProfiles?.length || 0) / ITEMS_PER_PAGE);

  const filteredMigrations = pendingMigrations?.filter((m) => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      m.display_name?.toLowerCase().includes(search) ||
      m.email?.toLowerCase().includes(search) ||
      m.last_name?.toLowerCase().includes(search) ||
      m.first_name?.toLowerCase().includes(search)
    );
  });

  const activeCount = filteredProfiles?.length || 0;
  const pendingCount = pendingMigrationCount || 0;
  const displayedPendingCount = filteredMigrations?.length || 0;

  return (
    <AdminLayout title="ユーザー管理">
      <div className="space-y-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="名前、メール、ユーザーIDで検索..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-10"
          />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="active" className="flex items-center gap-2">
              <UserCheck className="w-4 h-4" />
              登録済み ({activeCount})
            </TabsTrigger>
            <TabsTrigger value="pending" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              移行待ち ({pendingCount})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  ユーザー一覧 ({activeCount})
                </CardTitle>
                <CardDescription>
                  ログイン済みのアクティブユーザー
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <p className="text-muted-foreground">読み込み中...</p>
                ) : filteredProfiles?.length === 0 ? (
                  <p className="text-muted-foreground">ユーザーがいません</p>
                ) : (
                  <div className="space-y-4">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>表示名</TableHead>
                            <TableHead>メール</TableHead>
                            <TableHead>ロール</TableHead>
                            <TableHead>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 p-0 hover:bg-transparent"
                                onClick={() => handleSort("points")}
                              >
                                ポイント
                                <SortIcon column="points" />
                              </Button>
                            </TableHead>
                            <TableHead>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 p-0 hover:bg-transparent"
                                onClick={() => handleSort("totalPaid")}
                              >
                                総課金額
                                <SortIcon column="totalPaid" />
                              </Button>
                            </TableHead>
                            <TableHead>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 p-0 hover:bg-transparent"
                                onClick={() => handleSort("monthlyPaid")}
                              >
                                今月課金
                                <SortIcon column="monthlyPaid" />
                              </Button>
                            </TableHead>
                            <TableHead>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 p-0 hover:bg-transparent"
                                onClick={() => handleSort("lastLogin")}
                              >
                                最終ログイン
                                <SortIcon column="lastLogin" />
                              </Button>
                            </TableHead>
                            <TableHead>操作</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sortedAndPaginatedProfiles.map((profile) => {
                            const stats = getUserStats(profile.user_id);
                            const role = getUserRole(profile.user_id);
                            return (
                              <TableRow key={profile.id}>
                                <TableCell className="font-medium">
                                  {getDisplayName(profile)}
                                </TableCell>
                                <TableCell className="text-xs">
                                  {profile.email || "-"}
                                </TableCell>
                                <TableCell>
                                  <Badge variant={role === "admin" ? "default" : "secondary"}>
                                    {role}
                                  </Badge>
                                </TableCell>
                                <TableCell>{profile.points_balance.toLocaleString()}pt</TableCell>
                                <TableCell>¥{stats.totalPaid.toLocaleString()}</TableCell>
                                <TableCell>¥{stats.monthlyPaid.toLocaleString()}</TableCell>
                                <TableCell className="text-xs">
                                  {profile.last_login_at
                                    ? new Date(profile.last_login_at).toLocaleString("ja-JP")
                                    : "-"}
                                </TableCell>
                                <TableCell>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setSelectedUser(profile)}
                                  >
                                    <MessageSquare className="w-4 h-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                          {activeCount}件中 {(currentPage - 1) * ITEMS_PER_PAGE + 1}〜{Math.min(currentPage * ITEMS_PER_PAGE, activeCount)}件を表示
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                          >
                            <ChevronLeft className="w-4 h-4" />
                            前へ
                          </Button>
                          <div className="flex items-center gap-1">
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                              let pageNum: number;
                              if (totalPages <= 5) {
                                pageNum = i + 1;
                              } else if (currentPage <= 3) {
                                pageNum = i + 1;
                              } else if (currentPage >= totalPages - 2) {
                                pageNum = totalPages - 4 + i;
                              } else {
                                pageNum = currentPage - 2 + i;
                              }
                              return (
                                <Button
                                  key={pageNum}
                                  variant={currentPage === pageNum ? "default" : "outline"}
                                  size="sm"
                                  className="w-8"
                                  onClick={() => setCurrentPage(pageNum)}
                                >
                                  {pageNum}
                                </Button>
                              );
                            })}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                          >
                            次へ
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pending">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  移行待ちユーザー ({pendingCount.toLocaleString()})
                </CardTitle>
                <CardDescription>
                  旧システムからインポート済み、初回ログイン待ち
                  {pendingCount > 100 && ` (最新100件を表示)`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {migrationsLoading ? (
                  <p className="text-muted-foreground">読み込み中...</p>
                ) : filteredMigrations?.length === 0 ? (
                  <p className="text-muted-foreground">移行待ちユーザーはいません</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>表示名</TableHead>
                          <TableHead>メール</TableHead>
                          <TableHead>引継ぎポイント</TableHead>
                          <TableHead>電話番号</TableHead>
                          <TableHead>インポート日</TableHead>
                          <TableHead>ステータス</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredMigrations?.map((migration) => (
                          <TableRow key={migration.id}>
                            <TableCell className="font-medium">
                              {migration.display_name || 
                               `${migration.last_name || ""} ${migration.first_name || ""}`.trim() || 
                               "未設定"}
                            </TableCell>
                            <TableCell className="text-xs font-mono">
                              {migration.email}
                            </TableCell>
                            <TableCell className="text-primary font-medium">
                              {(migration.points_balance || 0).toLocaleString()}pt
                            </TableCell>
                            <TableCell className="text-xs">
                              {migration.phone_number || "-"}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {migration.created_at
                                ? new Date(migration.created_at).toLocaleDateString("ja-JP")
                                : "-"}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-muted-foreground">
                                <Clock className="w-3 h-3 mr-1" />
                                待機中
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* User Detail Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              ユーザー詳細: {selectedUser?.display_name || selectedUser?.email || "未設定"}
            </DialogTitle>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-6">
              {/* User Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">メールアドレス</p>
                  <p className="font-medium">{selectedUser.email || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">ユーザーID</p>
                  <p className="font-mono text-xs">{selectedUser.user_id}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">登録日</p>
                  <p>{new Date(selectedUser.created_at).toLocaleDateString("ja-JP")}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">最終ログイン</p>
                  <p>
                    {selectedUser.last_login_at
                      ? new Date(selectedUser.last_login_at).toLocaleString("ja-JP")
                      : "-"}
                  </p>
                </div>
              </div>

              {/* Point Adjustment */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">ポイント調整</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <p className="text-lg font-bold">
                      現在: {selectedUser.points_balance.toLocaleString()}pt
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => setPointAdjustment((p) => p - 100)}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <Input
                        type="number"
                        value={pointAdjustment}
                        onChange={(e) => setPointAdjustment(Number(e.target.value))}
                        className="w-24 text-center"
                      />
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => setPointAdjustment((p) => p + 100)}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                    <Button
                      onClick={() =>
                        adjustPointsMutation.mutate({
                          profileId: selectedUser.id,
                          adjustment: pointAdjustment,
                        })
                      }
                      disabled={pointAdjustment === 0}
                    >
                      適用
                    </Button>
                  </div>
                  {pointAdjustment !== 0 && (
                    <p className="text-sm text-muted-foreground mt-2">
                      変更後: {Math.max(0, selectedUser.points_balance + pointAdjustment).toLocaleString()}pt
                      ({pointAdjustment > 0 ? "+" : ""}{pointAdjustment}pt)
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Admin Notes / Chat */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    管理者メモ
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="メモを入力..."
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      rows={2}
                    />
                    <Button
                      size="icon"
                      onClick={() =>
                        addNoteMutation.mutate({
                          userId: selectedUser.user_id,
                          note: newNote,
                        })
                      }
                      disabled={!newNote.trim()}
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {userNotes?.length === 0 ? (
                      <p className="text-muted-foreground text-sm">メモがありません</p>
                    ) : (
                      userNotes?.map((note) => (
                        <div
                          key={note.id}
                          className="p-3 bg-muted rounded-lg text-sm"
                        >
                          <p>{note.note}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(note.created_at).toLocaleString("ja-JP")}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedUser(null)}>
              閉じる
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
