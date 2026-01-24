import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Download, Truck, Check, Search, Package } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type ActionStatus = Database["public"]["Enums"]["action_status"];
type InventoryAction = Database["public"]["Tables"]["inventory_actions"]["Row"];

const statusColors: Record<ActionStatus, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
  pending: { variant: "secondary", label: "発送待ち" },
  processing: { variant: "default", label: "処理中" },
  completed: { variant: "outline", label: "完了" },
  shipped: { variant: "default", label: "発送済み" },
};

export default function ShippingManagement() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<ActionStatus | "all">("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [trackingDialogOpen, setTrackingDialogOpen] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState("");

  const { data: shippingRequests, isLoading } = useQuery({
    queryKey: ["admin-shipping", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("inventory_actions")
        .select(`
          *,
          cards(*),
          gacha_slots(*, gacha_masters(*))
        `)
        .eq("action_type", "shipping")
        .order("requested_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as (InventoryAction & {
        cards: Database["public"]["Tables"]["cards"]["Row"] | null;
        gacha_slots: (Database["public"]["Tables"]["gacha_slots"]["Row"] & {
          gacha_masters: Database["public"]["Tables"]["gacha_masters"]["Row"] | null;
        }) | null;
      })[];
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ ids, status, tracking }: { ids: string[]; status: ActionStatus; tracking?: string }) => {
      const updates: Partial<InventoryAction> = {
        status,
        processed_at: status === "shipped" || status === "completed" ? new Date().toISOString() : null,
      };
      if (tracking) {
        updates.tracking_number = tracking;
      }

      const { error } = await supabase
        .from("inventory_actions")
        .update(updates)
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-shipping"] });
      setSelectedIds([]);
      setTrackingDialogOpen(false);
      setTrackingNumber("");
      toast.success("ステータスを更新しました");
    },
    onError: (error) => toast.error("エラー: " + error.message),
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(shippingRequests?.map((r) => r.id) || []);
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelect = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds([...selectedIds, id]);
    } else {
      setSelectedIds(selectedIds.filter((i) => i !== id));
    }
  };

  const exportCSV = () => {
    if (!shippingRequests || selectedIds.length === 0) return;

    const selected = shippingRequests.filter((r) => selectedIds.includes(r.id));
    const csvContent = [
      ["ID", "ユーザーID", "カード名", "ガチャ名", "ステータス", "依頼日時"].join(","),
      ...selected.map((r) =>
        [
          r.id,
          r.user_id,
          r.cards?.name || "-",
          r.gacha_slots?.gacha_masters?.title || "-",
          statusColors[r.status].label,
          new Date(r.requested_at).toLocaleString("ja-JP"),
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `shipping_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    toast.success("CSVをエクスポートしました");
  };

  const filteredRequests = shippingRequests?.filter((r) => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      r.cards?.name?.toLowerCase().includes(search) ||
      r.gacha_slots?.gacha_masters?.title?.toLowerCase().includes(search) ||
      r.user_id.toLowerCase().includes(search)
    );
  });

  return (
    <AdminLayout title="配送管理">
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="カード名、ガチャ名、ユーザーIDで検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ActionStatus | "all")}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              <SelectItem value="pending">発送待ち</SelectItem>
              <SelectItem value="processing">処理中</SelectItem>
              <SelectItem value="shipped">発送済み</SelectItem>
              <SelectItem value="completed">完了</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {selectedIds.length > 0 && (
          <Card>
            <CardContent className="py-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{selectedIds.length}件選択中</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setTrackingDialogOpen(true)}
                >
                  <Truck className="w-4 h-4 mr-1" />
                  発送済みにする
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => updateStatusMutation.mutate({ ids: selectedIds, status: "completed" })}
                >
                  <Check className="w-4 h-4 mr-1" />
                  完了にする
                </Button>
                <Button size="sm" variant="outline" onClick={exportCSV}>
                  <Download className="w-4 h-4 mr-1" />
                  CSVエクスポート
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              発送依頼一覧
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">読み込み中...</p>
            ) : filteredRequests?.length === 0 ? (
              <p className="text-muted-foreground">発送依頼がありません</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedIds.length === filteredRequests?.length && filteredRequests.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>カード</TableHead>
                    <TableHead>ガチャ</TableHead>
                    <TableHead>ユーザー</TableHead>
                    <TableHead>ステータス</TableHead>
                    <TableHead>追跡番号</TableHead>
                    <TableHead>依頼日時</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRequests?.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(request.id)}
                          onCheckedChange={(checked) => handleSelect(request.id, !!checked)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{request.cards?.name || "-"}</TableCell>
                      <TableCell>{request.gacha_slots?.gacha_masters?.title || "-"}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {request.user_id.slice(0, 8)}...
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusColors[request.status].variant}>
                          {statusColors[request.status].label}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {request.tracking_number || "-"}
                      </TableCell>
                      <TableCell>
                        {new Date(request.requested_at).toLocaleString("ja-JP")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Tracking Number Dialog */}
        <Dialog open={trackingDialogOpen} onOpenChange={setTrackingDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>追跡番号を入力</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="追跡番号（任意）"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
              />
              <Button
                className="w-full"
                onClick={() =>
                  updateStatusMutation.mutate({
                    ids: selectedIds,
                    status: "shipped",
                    tracking: trackingNumber || undefined,
                  })
                }
                disabled={updateStatusMutation.isPending}
              >
                {updateStatusMutation.isPending ? "更新中..." : "発送済みにする"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
