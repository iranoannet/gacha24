import { useState } from "react";
import { SuperAdminLayout } from "@/components/super-admin/SuperAdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Users, Search, Shield, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function AllUsersManagement() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [tenantFilter, setTenantFilter] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [assignTenantId, setAssignTenantId] = useState<string>("");

  const { data: tenants } = useQuery({
    queryKey: ["super-admin-tenants-for-filter"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tenants").select("id, name");
      if (error) throw error;
      return data;
    },
  });

  const { data: profiles, isLoading } = useQuery({
    queryKey: ["super-admin-all-profiles", tenantFilter],
    queryFn: async () => {
      let query = supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false })
        .range(0, 10000);

      if (tenantFilter !== "all") {
        if (tenantFilter === "none") {
          query = query.is("tenant_id", null);
        } else {
          query = query.eq("tenant_id", tenantFilter);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: userRoles } = useQuery({
    queryKey: ["super-admin-user-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("*").range(0, 10000);
      if (error) throw error;
      return data;
    },
  });

  const assignTenantMutation = useMutation({
    mutationFn: async ({ userId, tenantId }: { userId: string; tenantId: string | null }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ tenant_id: tenantId })
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["super-admin-all-profiles"] });
      toast.success("テナントを割り当てました");
      setIsAssignDialogOpen(false);
      setSelectedUser(null);
    },
    onError: (error: Error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  const toggleAdminMutation = useMutation({
    mutationFn: async ({ userId, makeAdmin }: { userId: string; makeAdmin: boolean }) => {
      if (makeAdmin) {
        const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: "admin" });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", "admin");
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["super-admin-user-roles"] });
      toast.success("権限を更新しました");
    },
    onError: (error: Error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  const deleteUsersMutation = useMutation({
    mutationFn: async (userIds: string[]) => {
      // Delete from profiles
      const { error: profileError } = await supabase
        .from("profiles")
        .delete()
        .in("user_id", userIds);
      if (profileError) throw profileError;

      // Delete from user_roles
      const { error: roleError } = await supabase
        .from("user_roles")
        .delete()
        .in("user_id", userIds);
      if (roleError) throw roleError;

      // Delete from user_migrations by email
      const profilesToDelete = profiles?.filter(p => userIds.includes(p.user_id)) || [];
      const emails = profilesToDelete.map(p => p.email).filter(Boolean);
      if (emails.length > 0) {
        await supabase
          .from("user_migrations")
          .delete()
          .in("email", emails);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["super-admin-all-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["super-admin-user-roles"] });
      toast.success(`${selectedUserIds.length}件のユーザーを削除しました`);
      setSelectedUserIds([]);
      setIsDeleteDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error(`削除エラー: ${error.message}`);
    },
  });

  const getUserRole = (userId: string) => {
    const roles = userRoles?.filter((r) => r.user_id === userId) || [];
    if (roles.some((r) => r.role === "super_admin")) return "super_admin";
    if (roles.some((r) => r.role === "admin")) return "admin";
    return "user";
  };

  const getTenantName = (tenantId: string | null) => {
    if (!tenantId) return "未割当";
    return tenants?.find((t) => t.id === tenantId)?.name || "不明";
  };

  const filteredProfiles = profiles?.filter((p) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      p.email?.toLowerCase().includes(searchLower) ||
      p.display_name?.toLowerCase().includes(searchLower)
    );
  });

  const toggleSelectUser = (userId: string) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const toggleSelectAll = () => {
    if (!filteredProfiles) return;
    const allIds = filteredProfiles.map(p => p.user_id);
    if (selectedUserIds.length === allIds.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(allIds);
    }
  };

  const handleAssignTenant = (profile: any) => {
    setSelectedUser(profile);
    setAssignTenantId(profile.tenant_id || "");
    setIsAssignDialogOpen(true);
  };

  return (
    <SuperAdminLayout title="全ユーザー管理">
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="メールアドレスまたは表示名で検索..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={tenantFilter} onValueChange={setTenantFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="テナントで絞り込み" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              <SelectItem value="none">未割当</SelectItem>
              {tenants?.map((tenant) => (
                <SelectItem key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              ユーザー一覧
            </CardTitle>
            {selectedUserIds.length > 0 && (
              <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="w-4 h-4 mr-1" />
                    {selectedUserIds.length}件を削除
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>ユーザーを削除しますか？</AlertDialogTitle>
                    <AlertDialogDescription>
                      選択された{selectedUserIds.length}件のユーザーを削除します。この操作は取り消せません。
                      プロフィール、ロール、移行データも削除されます。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>キャンセル</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteUsersMutation.mutate(selectedUserIds)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      削除する
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">読み込み中...</p>
            ) : filteredProfiles && filteredProfiles.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={filteredProfiles.length > 0 && selectedUserIds.length === filteredProfiles.length}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>メール / 表示名</TableHead>
                    <TableHead>テナント</TableHead>
                    <TableHead>権限</TableHead>
                    <TableHead>ポイント残高</TableHead>
                    <TableHead>登録日</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProfiles.map((profile) => {
                    const role = getUserRole(profile.user_id);
                    return (
                      <TableRow key={profile.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedUserIds.includes(profile.user_id)}
                            onCheckedChange={() => toggleSelectUser(profile.user_id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{profile.email || "未設定"}</p>
                            <p className="text-xs text-muted-foreground">{profile.display_name || "-"}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={profile.tenant_id ? "text-foreground" : "text-muted-foreground"}>
                            {getTenantName(profile.tenant_id)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={`text-xs px-2 py-1 rounded ${
                            role === "super_admin" 
                              ? "bg-purple-500/20 text-purple-500" 
                              : role === "admin" 
                              ? "bg-blue-500/20 text-blue-500"
                              : "bg-muted text-muted-foreground"
                          }`}>
                            {role === "super_admin" ? "スーパー管理者" : role === "admin" ? "管理者" : "ユーザー"}
                          </span>
                        </TableCell>
                        <TableCell>{profile.points_balance?.toLocaleString() || 0} pt</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(profile.created_at).toLocaleDateString("ja-JP")}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAssignTenant(profile)}
                            >
                              テナント割当
                            </Button>
                            {role !== "super_admin" && (
                              <Button
                                variant={role === "admin" ? "destructive" : "secondary"}
                                size="sm"
                                onClick={() => toggleAdminMutation.mutate({
                                  userId: profile.user_id,
                                  makeAdmin: role !== "admin",
                                })}
                              >
                                <Shield className="w-4 h-4 mr-1" />
                                {role === "admin" ? "管理者解除" : "管理者にする"}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-sm">ユーザーが見つかりません</p>
            )}
          </CardContent>
        </Card>

        <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>テナント割当</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {selectedUser?.email} をどのテナントに割り当てますか？
              </p>
              <div className="space-y-2">
                <Label>テナント</Label>
                <Select value={assignTenantId} onValueChange={setAssignTenantId}>
                  <SelectTrigger>
                    <SelectValue placeholder="テナントを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">割当解除</SelectItem>
                    {tenants?.map((tenant) => (
                      <SelectItem key={tenant.id} value={tenant.id}>
                        {tenant.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full"
                onClick={() => {
                  assignTenantMutation.mutate({
                    userId: selectedUser.user_id,
                    tenantId: assignTenantId === "none" ? null : assignTenantId,
                  });
                }}
                disabled={assignTenantMutation.isPending}
              >
                割り当てる
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </SuperAdminLayout>
  );
}
