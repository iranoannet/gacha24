import { useState } from "react";
import { SuperAdminLayout } from "@/components/super-admin/SuperAdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Building2, ExternalLink, Settings, Copy, Shield, ShieldOff } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TenantFormData {
  name: string;
  slug: string;
  logo_url: string;
  primary_color: string;
  custom_domain: string;
  is_active: boolean;
  allowed_ips: string; // comma-separated or newline-separated IPs
}

const initialFormData: TenantFormData = {
  name: "",
  slug: "",
  logo_url: "",
  primary_color: "#D4AF37",
  custom_domain: "",
  is_active: true,
  allowed_ips: "",
};

export default function TenantManagement() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<string | null>(null);
  const [formData, setFormData] = useState<TenantFormData>(initialFormData);
  const [isCopyDialogOpen, setIsCopyDialogOpen] = useState(false);
  const [copyingTenant, setCopyingTenant] = useState<{ id: string; name: string } | null>(null);
  const [newTenantName, setNewTenantName] = useState("");
  const [newTenantSlug, setNewTenantSlug] = useState("");
  const [isIpDialogOpen, setIsIpDialogOpen] = useState(false);
  const [ipEditTenant, setIpEditTenant] = useState<{ id: string; name: string; allowed_ips: string[] | null } | null>(null);
  const [ipInput, setIpInput] = useState("");

  const { data: tenants, isLoading } = useQuery({
    queryKey: ["super-admin-tenants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: TenantFormData) => {
      const allowedIps = parseIpList(data.allowed_ips);
      const { error } = await supabase.from("tenants").insert({
        name: data.name,
        slug: data.slug,
        logo_url: data.logo_url || null,
        primary_color: data.primary_color,
        custom_domain: data.custom_domain || null,
        is_active: data.is_active,
        allowed_ips: allowedIps,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["super-admin-tenants"] });
      toast.success("テナントを作成しました");
      setIsDialogOpen(false);
      setFormData(initialFormData);
    },
    onError: (error: Error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: TenantFormData }) => {
      const allowedIps = parseIpList(data.allowed_ips);
      const { error } = await supabase.from("tenants").update({
        name: data.name,
        slug: data.slug,
        logo_url: data.logo_url || null,
        primary_color: data.primary_color,
        custom_domain: data.custom_domain || null,
        is_active: data.is_active,
        allowed_ips: allowedIps,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["super-admin-tenants"] });
      toast.success("テナントを更新しました");
      setIsDialogOpen(false);
      setEditingTenant(null);
      setFormData(initialFormData);
    },
    onError: (error: Error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  const updateIpMutation = useMutation({
    mutationFn: async ({ id, allowed_ips }: { id: string; allowed_ips: string[] | null }) => {
      const { error } = await supabase.from("tenants").update({ allowed_ips }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["super-admin-tenants"] });
      toast.success("IP制限を更新しました");
      setIsIpDialogOpen(false);
      setIpEditTenant(null);
      setIpInput("");
    },
    onError: (error: Error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  const copyTenantMutation = useMutation({
    mutationFn: async ({ sourceId, name, slug }: { sourceId: string; name: string; slug: string }) => {
      // Get source tenant settings
      const { data: sourceTenant, error: sourceError } = await supabase
        .from("tenants")
        .select("*")
        .eq("id", sourceId)
        .single();
      
      if (sourceError) throw sourceError;
      
      // Create new tenant with same settings but different name/slug
      // Data (cards, gachas, users, etc.) will NOT be copied - only settings
      // allowed_ips is NOT copied for security reasons
      const { error: createError } = await supabase.from("tenants").insert({
        name,
        slug,
        logo_url: sourceTenant.logo_url,
        primary_color: sourceTenant.primary_color,
        custom_domain: "", // Reset custom domain for new tenant
        is_active: true,
        allowed_ips: null, // Don't copy IP restrictions
      });
      
      if (createError) throw createError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["super-admin-tenants"] });
      toast.success("テナントをコピーしました（設定のみ、データなし）");
      setIsCopyDialogOpen(false);
      setCopyingTenant(null);
      setNewTenantName("");
      setNewTenantSlug("");
    },
    onError: (error: Error) => {
      toast.error(`コピーエラー: ${error.message}`);
    },
  });

  // Parse IP list from comma/newline separated string
  const parseIpList = (input: string): string[] | null => {
    if (!input.trim()) return null;
    const ips = input
      .split(/[,\n]/)
      .map(ip => ip.trim())
      .filter(ip => ip && /^[\d.]+$/.test(ip));
    return ips.length > 0 ? ips : null;
  };

  // Format IP array to string for display
  const formatIpList = (ips: string[] | null): string => {
    if (!ips) return "";
    return ips.join("\n");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTenant) {
      updateMutation.mutate({ id: editingTenant, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (tenant: typeof tenants extends (infer T)[] ? T : never) => {
    setEditingTenant(tenant.id);
    setFormData({
      name: tenant.name,
      slug: tenant.slug,
      logo_url: tenant.logo_url || "",
      primary_color: tenant.primary_color || "#D4AF37",
      custom_domain: (tenant as any).custom_domain || "",
      is_active: tenant.is_active,
      allowed_ips: formatIpList((tenant as any).allowed_ips),
    });
    setIsDialogOpen(true);
  };

  const handleOpenDialog = () => {
    setEditingTenant(null);
    setFormData(initialFormData);
    setIsDialogOpen(true);
  };

  const handleCopyTenant = (tenant: { id: string; name: string }) => {
    setCopyingTenant(tenant);
    setNewTenantName(tenant.name + "（コピー）");
    setNewTenantSlug("");
    setIsCopyDialogOpen(true);
  };

  const handleCopySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!copyingTenant || !newTenantName || !newTenantSlug) return;
    
    copyTenantMutation.mutate({
      sourceId: copyingTenant.id,
      name: newTenantName,
      slug: newTenantSlug,
    });
  };

  const handleOpenIpDialog = (tenant: { id: string; name: string; allowed_ips: string[] | null }) => {
    setIpEditTenant(tenant);
    setIpInput(formatIpList(tenant.allowed_ips));
    setIsIpDialogOpen(true);
  };

  const handleIpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ipEditTenant) return;
    
    const allowedIps = parseIpList(ipInput);
    updateIpMutation.mutate({ id: ipEditTenant.id, allowed_ips: allowedIps });
  };

  const handleRemoveIpRestriction = () => {
    if (!ipEditTenant) return;
    updateIpMutation.mutate({ id: ipEditTenant.id, allowed_ips: null });
  };

  return (
    <SuperAdminLayout title="テナント管理">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="space-y-1">
            <p className="text-muted-foreground">
              登録されているテナント（会社）を管理します
            </p>
            <p className="text-xs text-muted-foreground">
              ※ シングルコードベース方式：1つのアプリで全テナントを管理し、データはtenant_idで分離されます
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleOpenDialog}>
                <Plus className="w-4 h-4 mr-2" />
                新規テナント
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingTenant ? "テナント編集" : "新規テナント作成"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">会社名</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="株式会社サンプル"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">スラッグ（URL用）</Label>
                  <Input
                    id="slug"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                    placeholder="sample-company"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="logo_url">ロゴURL（任意）</Label>
                  <Input
                    id="logo_url"
                    value={formData.logo_url}
                    onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                    placeholder="https://example.com/logo.png"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="primary_color">ブランドカラー</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      id="primary_color"
                      value={formData.primary_color}
                      onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                      className="w-16 h-10 p-1"
                    />
                    <Input
                      value={formData.primary_color}
                      onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                      placeholder="#D4AF37"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="custom_domain">カスタムドメイン（任意）</Label>
                  <Input
                    id="custom_domain"
                    value={formData.custom_domain}
                    onChange={(e) => setFormData({ ...formData, custom_domain: e.target.value.toLowerCase().replace(/\s/g, '') })}
                    placeholder="www.company-gacha.com"
                  />
                  <p className="text-xs text-muted-foreground">
                    独自ドメインを設定する場合、DNS設定が必要です
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="allowed_ips">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      IP制限（任意）
                    </div>
                  </Label>
                  <Textarea
                    id="allowed_ips"
                    value={formData.allowed_ips}
                    onChange={(e) => setFormData({ ...formData, allowed_ips: e.target.value })}
                    placeholder="許可するIPアドレスを入力（1行に1つ、または カンマ区切り）&#10;例:&#10;133.32.227.0&#10;192.168.1.100"
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    空欄の場合は制限なし。IPを設定すると、そのIPからのみアクセス可能になります。
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="is_active">有効</Label>
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingTenant ? "更新" : "作成"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              テナント一覧
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">読み込み中...</p>
            ) : tenants && tenants.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>会社名</TableHead>
                    <TableHead>スラッグ</TableHead>
                    <TableHead>カスタムドメイン</TableHead>
                    <TableHead>ブランドカラー</TableHead>
                    <TableHead>IP制限</TableHead>
                    <TableHead>ステータス</TableHead>
                    <TableHead>作成日</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenants.map((tenant) => (
                    <TableRow key={tenant.id}>
                      <TableCell className="font-medium">{tenant.name}</TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/{tenant.slug}</code>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {(tenant as any).custom_domain || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-6 h-6 rounded border"
                            style={{ backgroundColor: tenant.primary_color || '#D4AF37' }}
                          />
                          <span className="text-xs text-muted-foreground">{tenant.primary_color}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {(tenant as any).allowed_ips && (tenant as any).allowed_ips.length > 0 ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-orange-500 hover:text-orange-600"
                            onClick={() => handleOpenIpDialog({
                              id: tenant.id,
                              name: tenant.name,
                              allowed_ips: (tenant as any).allowed_ips,
                            })}
                            title={`IP制限: ${(tenant as any).allowed_ips.join(', ')}`}
                          >
                            <Shield className="w-4 h-4 mr-1" />
                            {(tenant as any).allowed_ips.length}件
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-foreground"
                            onClick={() => handleOpenIpDialog({
                              id: tenant.id,
                              name: tenant.name,
                              allowed_ips: null,
                            })}
                          >
                            <ShieldOff className="w-4 h-4" />
                          </Button>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-1 rounded ${tenant.is_active ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                          {tenant.is_active ? '有効' : '無効'}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(tenant.created_at).toLocaleDateString('ja-JP')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Link to={`/${tenant.slug}`} target="_blank">
                            <Button variant="ghost" size="sm" title="サイトを開く">
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Link to={`/${tenant.slug}/admin`} target="_blank">
                            <Button variant="ghost" size="sm" title="管理画面を開く">
                              <Settings className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(tenant)} title="編集">
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleCopyTenant({ id: tenant.id, name: tenant.name })} 
                            title="テナントをコピー"
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-sm">テナントがまだありません</p>
            )}
          </CardContent>
        </Card>

        {/* Copy Tenant Dialog */}
        <Dialog open={isCopyDialogOpen} onOpenChange={setIsCopyDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>テナントをコピー</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCopySubmit} className="space-y-4">
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>注意:</strong> テナント設定（ブランドカラー、ロゴ等）のみがコピーされます。
                  ユーザー、ガチャ、カード、取引履歴、IP制限などのデータはコピーされません。
                </p>
              </div>
              
              {copyingTenant && (
                <p className="text-sm text-muted-foreground">
                  コピー元: <strong>{copyingTenant.name}</strong>
                </p>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="copy-name">新しい会社名</Label>
                <Input
                  id="copy-name"
                  value={newTenantName}
                  onChange={(e) => setNewTenantName(e.target.value)}
                  placeholder="株式会社〇〇"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="copy-slug">新しいスラッグ（URL用）</Label>
                <Input
                  id="copy-slug"
                  value={newTenantSlug}
                  onChange={(e) => setNewTenantSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="new-company"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  URLパス: /{newTenantSlug || "example"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setIsCopyDialogOpen(false)}
                >
                  キャンセル
                </Button>
                <Button 
                  type="submit" 
                  className="flex-1" 
                  disabled={copyTenantMutation.isPending || !newTenantSlug}
                >
                  {copyTenantMutation.isPending ? "コピー中..." : "コピー作成"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* IP Restriction Dialog */}
        <Dialog open={isIpDialogOpen} onOpenChange={setIsIpDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                IP制限設定
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleIpSubmit} className="space-y-4">
              {ipEditTenant && (
                <p className="text-sm text-muted-foreground">
                  テナント: <strong>{ipEditTenant.name}</strong>
                </p>
              )}
              
              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
                <p className="text-sm text-orange-800 dark:text-orange-200">
                  <strong>注意:</strong> IP制限を設定すると、指定したIPアドレス以外からはこのテナントにアクセスできなくなります。
                  固定IP回線をお使いでない場合、アクセスできなくなる可能性があります。
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="ip-list">許可するIPアドレス</Label>
                <Textarea
                  id="ip-list"
                  value={ipInput}
                  onChange={(e) => setIpInput(e.target.value)}
                  placeholder="1行に1つのIPアドレスを入力&#10;例:&#10;133.32.227.0&#10;192.168.1.100"
                  rows={5}
                />
                <p className="text-xs text-muted-foreground">
                  空欄で保存すると、IP制限が解除されます。
                </p>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setIsIpDialogOpen(false)}
                >
                  キャンセル
                </Button>
                {ipEditTenant?.allowed_ips && (
                  <Button 
                    type="button" 
                    variant="destructive"
                    onClick={handleRemoveIpRestriction}
                    disabled={updateIpMutation.isPending}
                  >
                    制限解除
                  </Button>
                )}
                <Button 
                  type="submit" 
                  className="flex-1" 
                  disabled={updateIpMutation.isPending}
                >
                  {updateIpMutation.isPending ? "更新中..." : "保存"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </SuperAdminLayout>
  );
}
