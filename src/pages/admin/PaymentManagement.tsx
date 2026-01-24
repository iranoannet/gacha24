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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CreditCard, Search, Wallet } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface PaymentWithUser {
  id: string;
  user_id: string;
  amount: number;
  points_added: number;
  payment_method: string;
  status: string;
  stripe_payment_id: string | null;
  created_at: string;
  user_email?: string;
  user_name?: string;
}

const paymentMethodLabels: Record<string, string> = {
  credit_card: "クレジットカード",
  bank_transfer: "銀行振込",
  paypay: "PayPay",
  convenience: "コンビニ払い",
};

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  completed: { label: "完了", variant: "default" },
  pending: { label: "処理中", variant: "secondary" },
  failed: { label: "失敗", variant: "destructive" },
  refunded: { label: "返金済", variant: "outline" },
};

export default function PaymentManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: payments, isLoading } = useQuery({
    queryKey: ["admin-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as PaymentWithUser[];
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ["admin-profiles-for-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, display_name, email");
      if (error) throw error;
      return data;
    },
  });

  const paymentsWithUsers = payments?.map((payment) => {
    const profile = profiles?.find((p) => p.user_id === payment.user_id);
    return {
      ...payment,
      user_email: profile?.email || "-",
      user_name: profile?.display_name || "未設定",
    };
  });

  const filteredPayments = paymentsWithUsers?.filter((p) => {
    if (methodFilter !== "all" && p.payment_method !== methodFilter) return false;
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (!searchQuery) return true;
    
    const search = searchQuery.toLowerCase();
    return (
      p.user_email?.toLowerCase().includes(search) ||
      p.user_name?.toLowerCase().includes(search) ||
      p.stripe_payment_id?.toLowerCase().includes(search)
    );
  });

  const totalRevenue = filteredPayments?.reduce((acc, p) => {
    if (p.status === "completed") return acc + p.amount;
    return acc;
  }, 0) || 0;

  const paymentMethodStats = paymentsWithUsers?.reduce((acc, p) => {
    if (p.status === "completed") {
      acc[p.payment_method] = (acc[p.payment_method] || 0) + p.amount;
    }
    return acc;
  }, {} as Record<string, number>) || {};

  return (
    <AdminLayout title="決済管理">
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                総売上
              </CardTitle>
              <Wallet className="w-5 h-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">¥{totalRevenue.toLocaleString()}</div>
            </CardContent>
          </Card>
          {Object.entries(paymentMethodStats).map(([method, amount]) => (
            <Card key={method}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {paymentMethodLabels[method] || method}
                </CardTitle>
                <CreditCard className="w-5 h-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">¥{amount.toLocaleString()}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="メール、名前、決済IDで検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={methodFilter} onValueChange={setMethodFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="支払い方法" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべての方法</SelectItem>
              <SelectItem value="credit_card">クレジットカード</SelectItem>
              <SelectItem value="bank_transfer">銀行振込</SelectItem>
              <SelectItem value="paypay">PayPay</SelectItem>
              <SelectItem value="convenience">コンビニ払い</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="ステータス" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              <SelectItem value="completed">完了</SelectItem>
              <SelectItem value="pending">処理中</SelectItem>
              <SelectItem value="failed">失敗</SelectItem>
              <SelectItem value="refunded">返金済</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Payments Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              決済履歴 ({filteredPayments?.length || 0}件)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">読み込み中...</p>
            ) : filteredPayments?.length === 0 ? (
              <p className="text-muted-foreground">決済データがありません</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>日時</TableHead>
                      <TableHead>ユーザー</TableHead>
                      <TableHead>メール</TableHead>
                      <TableHead>金額</TableHead>
                      <TableHead>付与pt</TableHead>
                      <TableHead>支払い方法</TableHead>
                      <TableHead>ステータス</TableHead>
                      <TableHead>決済ID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPayments?.map((payment) => {
                      const statusInfo = statusLabels[payment.status] || {
                        label: payment.status,
                        variant: "secondary" as const,
                      };
                      return (
                        <TableRow key={payment.id}>
                          <TableCell className="text-sm">
                            {new Date(payment.created_at).toLocaleString("ja-JP")}
                          </TableCell>
                          <TableCell className="font-medium">
                            {payment.user_name}
                          </TableCell>
                          <TableCell className="text-xs">
                            {payment.user_email}
                          </TableCell>
                          <TableCell className="font-bold">
                            ¥{payment.amount.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            {payment.points_added.toLocaleString()}pt
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {paymentMethodLabels[payment.payment_method] || payment.payment_method}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusInfo.variant}>
                              {statusInfo.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {payment.stripe_payment_id
                              ? payment.stripe_payment_id.slice(0, 12) + "..."
                              : "-"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
