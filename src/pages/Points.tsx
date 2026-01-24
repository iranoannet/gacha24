import { useState } from "react";
import { ArrowLeft, Coins } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";

const pointsOptions = [
  { points: 500, price: 500, bonus: 0 },
  { points: 1000, price: 1000, bonus: 0 },
  { points: 3000, price: 3000, bonus: 0 },
  { points: 5000, price: 5000, bonus: 0 },
  { points: 10000, price: 10000, bonus: 0 },
  { points: 30000, price: 30000, bonus: 0 },
  { points: 50000, price: 50000, bonus: 0 },
  { points: 100000, price: 100000, bonus: 0 },
  { points: 250000, price: 250000, bonus: 0 },
  { points: 500000, price: 500000, bonus: 0 },
  { points: 1000000, price: 1000000, bonus: 0 },
];

const paymentMethods = [
  { id: "credit_card", name: "クレジットカード", icons: ["VISA", "MC", "JCB", "AMEX"] },
  { id: "apple_pay", name: "Apple Pay", icons: ["ApplePay"] },
  { id: "bank_transfer", name: "銀行振込", icons: [] },
  { id: "merpay", name: "メルペイ", icons: ["MerPay"] },
  { id: "amazon_pay", name: "Amazon Pay", icons: ["AmazonPay"] },
  { id: "paidy", name: "あと払い（ペイディ）", icons: ["Paidy"] },
];

const Points = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedPoints, setSelectedPoints] = useState<number | null>(null);
  const [selectedPayment, setSelectedPayment] = useState("credit_card");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [cardName, setCardName] = useState("");

  // ユーザーのプロファイル取得
  const { data: profile } = useQuery({
    queryKey: ["user-profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("points_balance")
        .eq("user_id", user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const currentBalance = profile?.points_balance ?? 0;
  const selectedOption = pointsOptions.find((o) => o.points === selectedPoints);
  const totalPoints = selectedOption
    ? selectedOption.points + selectedOption.bonus
    : 0;

  // ポイント選択画面
  if (!selectedPoints) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-card border-b border-border">
          <div className="container flex items-center justify-between h-14 px-4">
            <button onClick={() => navigate(-1)} className="p-2 -ml-2">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="font-bold text-lg">ポイント購入</h1>
            <div className="w-9" />
          </div>
        </header>

        <main className="container px-4 py-6 max-w-2xl mx-auto">
          {/* Current Balance */}
          <div className="mb-6 p-4 bg-gradient-to-r from-primary/20 to-accent/20 rounded-lg border border-primary/30">
            <p className="text-sm text-muted-foreground mb-1">現在のポイント残高</p>
            <p className="text-2xl font-bold text-primary">
              {currentBalance.toLocaleString()} <span className="text-sm">pt</span>
            </p>
          </div>

          {/* Points Options */}
          <div className="space-y-2">
            {pointsOptions.map((option, index) => (
              <motion.button
                key={option.points}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                onClick={() => setSelectedPoints(option.points)}
                className="w-full flex items-center justify-between p-4 bg-card border border-border rounded-lg hover:border-primary hover:bg-primary/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Coins className="h-5 w-5 text-primary" />
                  <span className="font-bold text-lg">
                    {option.points.toLocaleString()}
                    <span className="text-sm font-normal text-muted-foreground ml-1">
                      コイン
                    </span>
                  </span>
                </div>
                <span className="px-4 py-1.5 bg-primary text-primary-foreground rounded-full text-sm font-bold">
                  {option.price.toLocaleString()}円
                </span>
              </motion.button>
            ))}
          </div>
        </main>
      </div>
    );
  }

  // 決済画面
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card border-b border-border">
        <div className="container flex items-center justify-between h-14 px-4">
          <button onClick={() => setSelectedPoints(null)} className="p-2 -ml-2">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="font-bold text-lg">お支払い</h1>
          <div className="w-9" />
        </div>
      </header>

      <main className="container px-4 py-6 max-w-2xl mx-auto space-y-6">
        {/* Purchase Summary */}
        <Card className="border-primary/30">
          <CardContent className="p-4 space-y-3">
            <h2 className="font-bold text-sm text-muted-foreground">購入内容</h2>
            
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">支払い金額</span>
              <span className="font-bold text-lg">{selectedOption?.price.toLocaleString()}円</span>
            </div>
            
            <div className="flex justify-between items-center text-primary">
              <span>獲得コイン</span>
              <span className="font-bold">{selectedOption?.points.toLocaleString()}コイン</span>
            </div>
            
            {selectedOption && selectedOption.bonus > 0 && (
              <div className="flex justify-between items-center text-sm text-muted-foreground">
                <span>ボーナス(3%)</span>
                <span>+{selectedOption.bonus}pt</span>
              </div>
            )}
            
            <div className="pt-2 border-t border-border flex justify-between items-center text-primary">
              <span className="font-bold">獲得ランクポイント</span>
              <span className="font-bold text-lg">{totalPoints.toLocaleString()}pt</span>
            </div>
          </CardContent>
        </Card>

        {/* Payment Methods */}
        <div className="space-y-3">
          <h2 className="font-bold text-sm text-muted-foreground">お支払い方法</h2>
          
          <RadioGroup value={selectedPayment} onValueChange={setSelectedPayment}>
            {paymentMethods.map((method) => (
              <Card
                key={method.id}
                className={`cursor-pointer transition-colors ${
                  selectedPayment === method.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
                onClick={() => setSelectedPayment(method.id)}
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <RadioGroupItem value={method.id} id={method.id} />
                  <Label htmlFor={method.id} className="flex-1 cursor-pointer font-medium">
                    {method.name}
                  </Label>
                  <div className="flex gap-1">
                    {method.icons.map((icon) => (
                      <span
                        key={icon}
                        className="text-[10px] px-1.5 py-0.5 bg-muted rounded text-muted-foreground"
                      >
                        {icon}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </RadioGroup>
        </div>

        {/* Credit Card Form */}
        {selectedPayment === "credit_card" && (
          <Card className="border-primary/30">
            <CardContent className="p-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cardNumber">カード番号</Label>
                <Input
                  id="cardNumber"
                  placeholder="1234 1234 1234 1234"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  className="bg-muted/50"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="expiry">有効期限</Label>
                  <Input
                    id="expiry"
                    placeholder="月 / 年"
                    value={expiry}
                    onChange={(e) => setExpiry(e.target.value)}
                    className="bg-muted/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cvc">セキュリティコード</Label>
                  <Input
                    id="cvc"
                    placeholder="数字3~4桁"
                    value={cvc}
                    onChange={(e) => setCvc(e.target.value)}
                    className="bg-muted/50"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="cardName">名義人</Label>
                <Input
                  id="cardName"
                  placeholder="TARO YAMADA"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  className="bg-muted/50"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Purchase Button */}
        <Button className="w-full h-12 btn-gacha text-lg font-bold">
          購入する
        </Button>
      </main>
    </div>
  );
};

export default Points;
