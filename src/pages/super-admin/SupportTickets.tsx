import { useState, useEffect, useRef } from "react";
import { SuperAdminLayout } from "@/components/super-admin/SuperAdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Send, MessageSquare, Clock, CheckCircle, Building2 } from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

type TicketStatus = "pending" | "in_progress" | "completed" | "cancelled";

interface Ticket {
  id: string;
  tenant_id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: TicketStatus;
  estimated_cost: number;
  is_paid: boolean;
  created_at: string;
  tenants?: { name: string; slug: string };
}

interface Message {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_type: string;
  message: string;
  created_at: string;
}

const statusConfig: Record<TicketStatus, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: "未対応", color: "bg-yellow-500/20 text-yellow-500", icon: Clock },
  in_progress: { label: "対応中", color: "bg-blue-500/20 text-blue-500", icon: MessageSquare },
  completed: { label: "完了", color: "bg-green-500/20 text-green-500", icon: CheckCircle },
  cancelled: { label: "キャンセル", color: "bg-red-500/20 text-red-500", icon: Clock },
};

const ESTIMATE_ITEMS = [
  { label: "テキスト修正", cost: 1000 },
  { label: "画像差替え", cost: 2000 },
  { label: "レイアウト変更", cost: 5000 },
  { label: "機能追加（小）", cost: 10000 },
  { label: "機能追加（中）", cost: 30000 },
  { label: "機能追加（大）", cost: 50000 },
];

export default function SupportTickets() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch all tickets with tenant info
  const { data: tickets, isLoading } = useQuery({
    queryKey: ["super-admin-tickets", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("support_tickets")
        .select("*, tenants(name, slug)")
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter as TicketStatus);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Ticket[];
    },
  });

  // Fetch messages for selected ticket
  const { data: messages } = useQuery({
    queryKey: ["super-admin-messages", selectedTicket?.id],
    queryFn: async () => {
      if (!selectedTicket) return [];
      const { data, error } = await supabase
        .from("support_messages")
        .select("*")
        .eq("ticket_id", selectedTicket.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Message[];
    },
    enabled: !!selectedTicket,
  });

  // Real-time subscription
  useEffect(() => {
    if (!selectedTicket) return;

    const channel = supabase
      .channel(`admin-messages-${selectedTicket.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: `ticket_id=eq.${selectedTicket.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["super-admin-messages", selectedTicket.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedTicket, queryClient]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      if (!user || !selectedTicket) throw new Error("認証が必要です");
      const { error } = await supabase.from("support_messages").insert({
        ticket_id: selectedTicket.id,
        sender_id: user.id,
        sender_type: "super_admin",
        message: newMessage,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: ["super-admin-messages", selectedTicket?.id] });
    },
    onError: () => {
      toast.error("メッセージの送信に失敗しました");
    },
  });

  // Update ticket status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ ticketId, status }: { ticketId: string; status: TicketStatus }) => {
      const { error } = await supabase
        .from("support_tickets")
        .update({ status: status as TicketStatus })
        .eq("id", ticketId);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["super-admin-tickets"] });
      if (selectedTicket) {
        setSelectedTicket({
          ...selectedTicket,
          status: updateStatusMutation.variables?.status || selectedTicket.status,
        });
      }
      toast.success("ステータスを更新しました");
    },
    onError: () => {
      toast.error("更新に失敗しました");
    },
  });

  // Update estimated cost mutation
  const updateEstimateMutation = useMutation({
    mutationFn: async ({ ticketId, cost }: { ticketId: string; cost: number }) => {
      const { error } = await supabase
        .from("support_tickets")
        .update({ estimated_cost: cost })
        .eq("id", ticketId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["super-admin-tickets"] });
      toast.success("見積もりを設定しました");
    },
    onError: () => {
      toast.error("更新に失敗しました");
    },
  });

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;
    sendMessageMutation.mutate();
  };

  const handleAddEstimate = (cost: number) => {
    if (!selectedTicket) return;
    const newCost = (selectedTicket.estimated_cost || 0) + cost;
    updateEstimateMutation.mutate({ ticketId: selectedTicket.id, cost: newCost });
    setSelectedTicket({ ...selectedTicket, estimated_cost: newCost });
  };

  return (
    <SuperAdminLayout title="サポートチケット管理">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ticket List */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">チケット一覧</CardTitle>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべて</SelectItem>
                <SelectItem value="pending">未対応</SelectItem>
                <SelectItem value="in_progress">対応中</SelectItem>
                <SelectItem value="completed">完了</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-16rem)]">
              {isLoading ? (
                <div className="p-4 text-center text-muted-foreground">読み込み中...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>テナント</TableHead>
                      <TableHead>件名</TableHead>
                      <TableHead>ステータス</TableHead>
                      <TableHead>見積</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tickets?.map((ticket) => (
                      <TableRow
                        key={ticket.id}
                        className={`cursor-pointer ${selectedTicket?.id === ticket.id ? "bg-muted" : ""}`}
                        onClick={() => setSelectedTicket(ticket)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm">{ticket.tenants?.name || "不明"}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{ticket.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(ticket.created_at), "M/d HH:mm", { locale: ja })}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={statusConfig[ticket.status].color}>
                            {statusConfig[ticket.status].label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {ticket.estimated_cost > 0 && (
                            <span className="text-primary font-medium">
                              ¥{ticket.estimated_cost.toLocaleString()}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Chat & Actions */}
        <div className="space-y-4">
          {selectedTicket ? (
            <>
              {/* Actions Card */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{selectedTicket.title}</CardTitle>
                    <Select
                      value={selectedTicket.status}
                      onValueChange={(value) =>
                        updateStatusMutation.mutate({
                          ticketId: selectedTicket.id,
                          status: value as TicketStatus,
                        })
                      }
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">未対応</SelectItem>
                        <SelectItem value="in_progress">対応中</SelectItem>
                        <SelectItem value="completed">完了</SelectItem>
                        <SelectItem value="cancelled">キャンセル</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">見積もり追加</p>
                      <div className="flex flex-wrap gap-2">
                        {ESTIMATE_ITEMS.map((item) => (
                          <Button
                            key={item.label}
                            variant="outline"
                            size="sm"
                            onClick={() => handleAddEstimate(item.cost)}
                          >
                            {item.label} (¥{item.cost.toLocaleString()})
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className="text-sm font-medium">現在の見積もり</span>
                      <span className="text-xl font-bold text-primary">
                        ¥{(selectedTicket.estimated_cost || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Chat Card */}
              <Card className="flex flex-col h-[calc(100vh-26rem)]">
                <CardHeader className="border-b pb-2">
                  <CardTitle className="text-sm">チャット</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col p-0">
                  <ScrollArea className="flex-1 p-4">
                    <div className="space-y-4">
                      {messages?.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex ${
                            msg.sender_type === "super_admin" ? "justify-end" : "justify-start"
                          }`}
                        >
                          <div
                            className={`max-w-[80%] rounded-lg p-3 ${
                              msg.sender_type === "super_admin"
                                ? "bg-purple-600 text-white"
                                : "bg-muted"
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                            <p
                              className={`text-xs mt-1 ${
                                msg.sender_type === "super_admin"
                                  ? "text-purple-200"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {format(new Date(msg.created_at), "M/d HH:mm", { locale: ja })}
                            </p>
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>
                  <div className="p-4 border-t">
                    <div className="flex gap-2">
                      <Input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="メッセージを入力..."
                        onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                      />
                      <Button
                        onClick={handleSendMessage}
                        disabled={!newMessage.trim() || sendMessageMutation.isPending}
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="h-[calc(100vh-12rem)] flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>チケットを選択してください</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </SuperAdminLayout>
  );
}
