import { useState, useEffect, useRef } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { toast } from "sonner";
import { Send, Plus, MessageSquare, Clock, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type TicketStatus = "pending" | "in_progress" | "completed" | "cancelled";

interface Ticket {
  id: string;
  title: string;
  description: string | null;
  status: TicketStatus;
  estimated_cost: number;
  is_paid: boolean;
  created_at: string;
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

export default function SupportChat() {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const queryClient = useQueryClient();
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [isCreatingTicket, setIsCreatingTicket] = useState(false);
  const [newTicketTitle, setNewTicketTitle] = useState("");
  const [newTicketDescription, setNewTicketDescription] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch tickets
  const { data: tickets, isLoading: ticketsLoading } = useQuery({
    queryKey: ["support-tickets", tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Ticket[];
    },
    enabled: !!tenant?.id,
  });

  // Fetch messages for selected ticket
  const { data: messages } = useQuery({
    queryKey: ["support-messages", selectedTicket?.id],
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

  // Real-time subscription for messages
  useEffect(() => {
    if (!selectedTicket) return;

    const channel = supabase
      .channel(`messages-${selectedTicket.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: `ticket_id=eq.${selectedTicket.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["support-messages", selectedTicket.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedTicket, queryClient]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Create ticket mutation
  const createTicketMutation = useMutation({
    mutationFn: async () => {
      if (!user || !tenant) throw new Error("認証が必要です");
      const { data, error } = await supabase
        .from("support_tickets")
        .insert({
          tenant_id: tenant.id,
          user_id: user.id,
          title: newTicketTitle,
          description: newTicketDescription,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      setSelectedTicket(data as Ticket);
      setNewTicketTitle("");
      setNewTicketDescription("");
      setIsCreatingTicket(false);
      toast.success("チケットを作成しました");
    },
    onError: () => {
      toast.error("チケットの作成に失敗しました");
    },
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      if (!user || !selectedTicket) throw new Error("認証が必要です");
      const { error } = await supabase.from("support_messages").insert({
        ticket_id: selectedTicket.id,
        sender_id: user.id,
        sender_type: "tenant_admin",
        message: newMessage,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: ["support-messages", selectedTicket?.id] });
    },
    onError: () => {
      toast.error("メッセージの送信に失敗しました");
    },
  });

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;
    sendMessageMutation.mutate();
  };

  return (
    <AdminLayout title="サポート">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-10rem)]">
        {/* Ticket List */}
        <Card className="lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">チケット一覧</CardTitle>
            <Dialog open={isCreatingTicket} onOpenChange={setIsCreatingTicket}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-1" />
                  新規
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>新規サポートチケット</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div>
                    <label className="text-sm font-medium">件名</label>
                    <Input
                      value={newTicketTitle}
                      onChange={(e) => setNewTicketTitle(e.target.value)}
                      placeholder="例: テキストの修正依頼"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">詳細</label>
                    <Textarea
                      value={newTicketDescription}
                      onChange={(e) => setNewTicketDescription(e.target.value)}
                      placeholder="修正したい内容を詳しく記載してください"
                      rows={4}
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => createTicketMutation.mutate()}
                    disabled={!newTicketTitle.trim() || createTicketMutation.isPending}
                  >
                    チケットを作成
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-16rem)]">
              {ticketsLoading ? (
                <div className="p-4 text-center text-muted-foreground">読み込み中...</div>
              ) : tickets && tickets.length > 0 ? (
                <div className="divide-y divide-border">
                  {tickets.map((ticket) => {
                    const config = statusConfig[ticket.status];
                    return (
                      <button
                        key={ticket.id}
                        onClick={() => setSelectedTicket(ticket)}
                        className={`w-full p-4 text-left hover:bg-muted/50 transition-colors ${
                          selectedTicket?.id === ticket.id ? "bg-muted" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm truncate pr-2">{ticket.title}</span>
                          <Badge className={config.color}>{config.label}</Badge>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>
                            {format(new Date(ticket.created_at), "M/d HH:mm", { locale: ja })}
                          </span>
                          {ticket.estimated_cost > 0 && (
                            <span className="text-primary">
                              ¥{ticket.estimated_cost.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 text-center text-muted-foreground">
                  チケットがありません
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Chat Area */}
        <Card className="lg:col-span-2 flex flex-col">
          {selectedTicket ? (
            <>
              <CardHeader className="border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{selectedTicket.title}</CardTitle>
                    {selectedTicket.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {selectedTicket.description}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <Badge className={statusConfig[selectedTicket.status].color}>
                      {statusConfig[selectedTicket.status].label}
                    </Badge>
                    {selectedTicket.estimated_cost > 0 && (
                      <p className="text-sm text-primary mt-1">
                        見積: ¥{selectedTicket.estimated_cost.toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col p-0">
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {messages?.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${
                          msg.sender_type === "tenant_admin" ? "justify-end" : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg p-3 ${
                            msg.sender_type === "tenant_admin"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                          <p
                            className={`text-xs mt-1 ${
                              msg.sender_type === "tenant_admin"
                                ? "text-primary-foreground/70"
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
                      disabled={selectedTicket.status === "completed"}
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={!newMessage.trim() || sendMessageMutation.isPending || selectedTicket.status === "completed"}
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </>
          ) : (
            <CardContent className="flex-1 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>チケットを選択してチャットを開始</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </AdminLayout>
  );
}
