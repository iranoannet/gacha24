import { useState } from "react";
import { ArrowLeft, Coins, TestTube2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import DarkThemeLayout from "@/components/layout/DarkThemeLayout";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

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
  { id: "credit_card", name: "Credit Card", icons: ["VISA", "MC", "JCB", "AMEX"] },
  { id: "apple_pay", name: "Apple Pay", icons: ["ApplePay"] },
  { id: "bank_transfer", name: "Bank Transfer", icons: [] },
  { id: "merpay", name: "MerPay", icons: ["MerPay"] },
  { id: "amazon_pay", name: "Amazon Pay", icons: ["AmazonPay"] },
  { id: "paidy", name: "Pay Later (Paidy)", icons: ["Paidy"] },
];

// Check if we're in development/preview mode
const isDemoMode = () => {
  const hostname = window.location.hostname;
  return hostname.includes('localhost') || 
         hostname.includes('lovableproject.com') || 
         hostname.includes('lovable.app');
};

const DarkThemePoints = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tenantSlug, tenant } = useTenant();
  const basePath = tenantSlug ? `/${tenantSlug}` : "";
  const queryClient = useQueryClient();
  const [selectedPoints, setSelectedPoints] = useState<number | null>(null);
  const [selectedPayment, setSelectedPayment] = useState("credit_card");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [cardName, setCardName] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["user-profile", user?.id, tenant?.id],
    queryFn: async () => {
      if (!user || !tenant) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("points_balance")
        .eq("user_id", user.id)
        .eq("tenant_id", tenant.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!tenant,
  });

  const currentBalance = profile?.points_balance ?? 0;
  const selectedOption = pointsOptions.find((o) => o.points === selectedPoints);
  const totalPoints = selectedOption
    ? selectedOption.points + selectedOption.bonus
    : 0;

  const handleDemoPurchase = async () => {
    if (!user || !tenant || !selectedOption) return;

    setIsProcessing(true);
    try {
      // 1. Add points to profile
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ points_balance: currentBalance + selectedOption.points })
        .eq("user_id", user.id)
        .eq("tenant_id", tenant.id);

      if (updateError) throw updateError;

      // 2. Record payment
      const { error: paymentError } = await supabase
        .from("payments")
        .insert({
          user_id: user.id,
          tenant_id: tenant.id,
          amount: selectedOption.price,
          points_added: selectedOption.points,
          payment_method: selectedPayment,
          status: "completed",
        });

      if (paymentError) throw paymentError;

      // Refresh profile data
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      queryClient.invalidateQueries({ queryKey: ["header-points"] });

      toast({
        title: "Demo Purchase Complete!",
        description: `${selectedOption.points.toLocaleString()} points have been added to your account.`,
      });

      setSelectedPoints(null);
    } catch (error) {
      console.error("Demo purchase error:", error);
      toast({
        title: "Error",
        description: "Failed to process demo purchase. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Point selection screen
  if (!selectedPoints) {
    return (
      <DarkThemeLayout showFooter={false}>
        <div className="container px-4 py-6 max-w-2xl mx-auto">
          <h1 className="text-xl font-bold mb-6 text-[hsl(var(--dark-neon-primary))]">Buy Points</h1>

          {/* Current Balance */}
          <div className="mb-6 p-4 bg-gradient-to-r from-[hsl(var(--dark-neon-primary)/0.2)] to-[hsl(var(--dark-neon-secondary)/0.2)] rounded-lg border border-[hsl(var(--dark-neon-primary)/0.3)]">
            <p className="text-sm text-[hsl(var(--dark-muted))] mb-1">Current Balance</p>
            <p className="text-2xl font-bold text-[hsl(var(--dark-neon-primary))]">
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
                className={cn(
                  "w-full flex items-center justify-between p-4 rounded-lg transition-all",
                  "bg-[hsl(var(--dark-surface-elevated))] border border-[hsl(var(--dark-border))]",
                  "hover:border-[hsl(var(--dark-neon-primary))] hover:bg-[hsl(var(--dark-neon-primary)/0.05)]"
                )}
              >
                <div className="flex items-center gap-3">
                  <Coins className="h-5 w-5 text-[hsl(var(--dark-neon-gold))]" />
                  <span className="font-bold text-lg text-[hsl(var(--dark-foreground))]">
                    {option.points.toLocaleString()}
                    <span className="text-sm font-normal text-[hsl(var(--dark-muted))] ml-1">
                      coins
                    </span>
                  </span>
                </div>
                <span className="px-4 py-1.5 bg-[hsl(var(--dark-neon-primary))] text-[hsl(var(--dark-background))] rounded-full text-sm font-bold">
                  ¥{option.price.toLocaleString()}
                </span>
              </motion.button>
            ))}
          </div>
        </div>
      </DarkThemeLayout>
    );
  }

  // Payment screen
  return (
    <DarkThemeLayout showFooter={false}>
      <div className="container px-4 py-6 max-w-2xl mx-auto space-y-6">
        <button
          onClick={() => setSelectedPoints(null)}
          className="flex items-center gap-2 text-[hsl(var(--dark-muted))] hover:text-[hsl(var(--dark-foreground))] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="text-sm">Back to point selection</span>
        </button>

        <h1 className="text-xl font-bold text-[hsl(var(--dark-neon-primary))]">Payment</h1>

        {/* Purchase Summary */}
        <Card className="bg-[hsl(var(--dark-surface-elevated))] border-[hsl(var(--dark-neon-primary)/0.3)]">
          <CardContent className="p-4 space-y-3">
            <h2 className="font-bold text-sm text-[hsl(var(--dark-muted))]">Order Summary</h2>
            
            <div className="flex justify-between items-center">
              <span className="text-[hsl(var(--dark-muted))]">Payment Amount</span>
              <span className="font-bold text-lg text-[hsl(var(--dark-foreground))]">¥{selectedOption?.price.toLocaleString()}</span>
            </div>
            
            <div className="flex justify-between items-center text-[hsl(var(--dark-neon-primary))]">
              <span>Coins Earned</span>
              <span className="font-bold">{selectedOption?.points.toLocaleString()} coins</span>
            </div>
            
            {selectedOption && selectedOption.bonus > 0 && (
              <div className="flex justify-between items-center text-sm text-[hsl(var(--dark-muted))]">
                <span>Bonus (3%)</span>
                <span>+{selectedOption.bonus}pt</span>
              </div>
            )}
            
            <div className="pt-2 border-t border-[hsl(var(--dark-border))] flex justify-between items-center text-[hsl(var(--dark-neon-gold))]">
              <span className="font-bold">Rank Points Earned</span>
              <span className="font-bold text-lg">{totalPoints.toLocaleString()}pt</span>
            </div>
          </CardContent>
        </Card>

        {/* Payment Methods */}
        <div className="space-y-3">
          <h2 className="font-bold text-sm text-[hsl(var(--dark-muted))]">Payment Method</h2>
          
          <RadioGroup value={selectedPayment} onValueChange={setSelectedPayment}>
            {paymentMethods.map((method) => (
              <Card
                key={method.id}
                className={cn(
                  "cursor-pointer transition-colors",
                  "bg-[hsl(var(--dark-surface-elevated))]",
                  selectedPayment === method.id
                    ? "border-[hsl(var(--dark-neon-primary))] bg-[hsl(var(--dark-neon-primary)/0.05)]"
                    : "border-[hsl(var(--dark-border))] hover:border-[hsl(var(--dark-neon-primary)/0.5)]"
                )}
                onClick={() => setSelectedPayment(method.id)}
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <RadioGroupItem value={method.id} id={method.id} className="border-[hsl(var(--dark-border))]" />
                  <Label htmlFor={method.id} className="flex-1 cursor-pointer font-medium text-[hsl(var(--dark-foreground))]">
                    {method.name}
                  </Label>
                  <div className="flex gap-1">
                    {method.icons.map((icon) => (
                      <span
                        key={icon}
                        className="text-[10px] px-1.5 py-0.5 bg-[hsl(var(--dark-surface))] rounded text-[hsl(var(--dark-muted))]"
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
          <Card className="bg-[hsl(var(--dark-surface-elevated))] border-[hsl(var(--dark-neon-primary)/0.3)]">
            <CardContent className="p-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cardNumber" className="text-[hsl(var(--dark-foreground))]">Card Number</Label>
                <Input
                  id="cardNumber"
                  placeholder="1234 1234 1234 1234"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  className="bg-[hsl(var(--dark-surface))] border-[hsl(var(--dark-border))] text-[hsl(var(--dark-foreground))]"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="expiry" className="text-[hsl(var(--dark-foreground))]">Expiry Date</Label>
                  <Input
                    id="expiry"
                    placeholder="MM / YY"
                    value={expiry}
                    onChange={(e) => setExpiry(e.target.value)}
                    className="bg-[hsl(var(--dark-surface))] border-[hsl(var(--dark-border))] text-[hsl(var(--dark-foreground))]"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cvc" className="text-[hsl(var(--dark-foreground))]">Security Code</Label>
                  <Input
                    id="cvc"
                    placeholder="CVC"
                    value={cvc}
                    onChange={(e) => setCvc(e.target.value)}
                    className="bg-[hsl(var(--dark-surface))] border-[hsl(var(--dark-border))] text-[hsl(var(--dark-foreground))]"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="cardName" className="text-[hsl(var(--dark-foreground))]">Cardholder Name</Label>
                <Input
                  id="cardName"
                  placeholder="TARO YAMADA"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  className="bg-[hsl(var(--dark-surface))] border-[hsl(var(--dark-border))] text-[hsl(var(--dark-foreground))]"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Purchase Button */}
        {isDemoMode() ? (
          <div className="space-y-3">
            <div className="p-3 bg-[hsl(var(--dark-neon-gold)/0.1)] border border-[hsl(var(--dark-neon-gold)/0.3)] rounded-lg">
              <div className="flex items-center gap-2 text-[hsl(var(--dark-neon-gold))]">
                <TestTube2 className="h-4 w-4" />
                <span className="text-sm font-medium">Demo Mode</span>
              </div>
              <p className="text-xs text-[hsl(var(--dark-muted))] mt-1">
                This is a test environment. Points will be added without real payment.
              </p>
            </div>
            <Button 
              onClick={handleDemoPurchase}
              disabled={isProcessing}
              className="w-full h-12 text-lg font-bold bg-[hsl(var(--dark-neon-gold))] text-[hsl(var(--dark-background))] hover:bg-[hsl(var(--dark-neon-gold)/0.9)]"
            >
              {isProcessing ? "Processing..." : `Demo Purchase (${selectedOption?.points.toLocaleString()} pts)`}
            </Button>
          </div>
        ) : (
          <Button className="w-full h-12 text-lg font-bold bg-[hsl(var(--dark-neon-primary))] text-[hsl(var(--dark-background))] hover:bg-[hsl(var(--dark-neon-primary)/0.9)]">
            Purchase
          </Button>
        )}
      </div>
    </DarkThemeLayout>
  );
};

export default DarkThemePoints;
