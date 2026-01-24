import { useState } from "react";
import { useNavigate } from "react-router-dom";
import MainLayout from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Ticket, AlertCircle, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const Coupon = () => {
  const navigate = useNavigate();
  const [couponCode, setCouponCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSmsAlert, setShowSmsAlert] = useState(false);
  
  // TODO: Replace with actual SMS verification status check
  const isSmsVerified = false;

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      toast.error("クーポンコードを入力してください");
      return;
    }

    if (!isSmsVerified) {
      setShowSmsAlert(true);
      return;
    }

    setIsLoading(true);
    
    // TODO: Implement actual coupon validation
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast.error("このクーポンコードは無効です");
    setIsLoading(false);
  };

  return (
    <MainLayout>
      <div className="container px-4 py-6 max-w-2xl mx-auto">
        <h1 className="text-xl font-bold mb-6">クーポン利用</h1>

        <Card className="p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Ticket className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-bold text-foreground">クーポンコードを入力</p>
              <p className="text-xs text-muted-foreground">お持ちのクーポンコードを入力してください</p>
            </div>
          </div>

          <div className="space-y-4">
            <Input
              placeholder="クーポンコードを入力"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              className="text-center font-mono text-lg tracking-wider"
              maxLength={20}
            />
            
            <Button 
              onClick={handleApplyCoupon} 
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? "確認中..." : "クーポンを適用"}
            </Button>
          </div>
        </Card>

        {!isSmsVerified && (
          <Card className="p-4 border-accent/50 bg-accent/5">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-accent mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">SMS認証が必要です</p>
                <p className="text-xs text-muted-foreground mt-1">
                  クーポンを利用するにはSMS認証を完了してください
                </p>
                <Button 
                  variant="link" 
                  className="p-0 h-auto text-primary text-sm mt-2"
                  onClick={() => navigate("/mypage/sms-verification")}
                >
                  SMS認証を行う
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          </Card>
        )}

        <div className="mt-6">
          <h2 className="text-sm font-bold text-foreground mb-3">保有クーポン</h2>
          <Card className="p-8 text-center">
            <p className="text-muted-foreground text-sm">保有しているクーポンはありません</p>
          </Card>
        </div>

        <AlertDialog open={showSmsAlert} onOpenChange={setShowSmsAlert}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>SMS認証が必要です</AlertDialogTitle>
              <AlertDialogDescription>
                クーポンを利用するにはSMS認証を完了してください。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>キャンセル</AlertDialogCancel>
              <AlertDialogAction onClick={() => navigate("/mypage/sms-verification")}>
                SMS認証へ
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
};

export default Coupon;
