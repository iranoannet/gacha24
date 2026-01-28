import { useState } from "react";
import { useNavigate } from "react-router-dom";
import DarkThemeLayout from "@/components/layout/DarkThemeLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Ticket, AlertCircle, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useTenant } from "@/hooks/useTenant";
import { cn } from "@/lib/utils";
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

const DarkThemeCoupon = () => {
  const navigate = useNavigate();
  const { tenantSlug } = useTenant();
  const basePath = tenantSlug ? `/${tenantSlug}` : "";
  const [couponCode, setCouponCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSmsAlert, setShowSmsAlert] = useState(false);
  
  const isSmsVerified = false;

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      toast.error("Please enter a coupon code");
      return;
    }

    if (!isSmsVerified) {
      setShowSmsAlert(true);
      return;
    }

    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    toast.error("This coupon code is invalid");
    setIsLoading(false);
  };

  return (
    <DarkThemeLayout>
      <div className="container px-4 py-6 max-w-2xl mx-auto">
        <h1 className="text-xl font-bold mb-6 text-[hsl(var(--dark-neon-primary))]">Use Coupon</h1>

        <Card className={cn(
          "p-6 mb-6",
          "bg-[hsl(var(--dark-surface-elevated))] border-[hsl(var(--dark-border))]"
        )}>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-full bg-[hsl(var(--dark-neon-gold)/0.2)] flex items-center justify-center">
              <Ticket className="h-5 w-5 text-[hsl(var(--dark-neon-gold))]" />
            </div>
            <div>
              <p className="font-bold text-[hsl(var(--dark-foreground))]">Enter Coupon Code</p>
              <p className="text-xs text-[hsl(var(--dark-muted))]">Enter your coupon code below</p>
            </div>
          </div>

          <div className="space-y-4">
            <Input
              placeholder="Enter coupon code"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              className={cn(
                "text-center font-mono text-lg tracking-wider",
                "bg-[hsl(var(--dark-surface))] border-[hsl(var(--dark-border))] text-[hsl(var(--dark-foreground))]"
              )}
              maxLength={20}
            />
            
            <Button 
              onClick={handleApplyCoupon} 
              className="w-full bg-[hsl(var(--dark-neon-primary))] text-[hsl(var(--dark-background))] hover:bg-[hsl(var(--dark-neon-primary)/0.9)]"
              disabled={isLoading}
            >
              {isLoading ? "Checking..." : "Apply Coupon"}
            </Button>
          </div>
        </Card>

        {!isSmsVerified && (
          <Card className={cn(
            "p-4 mb-6",
            "bg-[hsl(var(--dark-neon-accent)/0.1)] border-[hsl(var(--dark-neon-accent)/0.3)]"
          )}>
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-[hsl(var(--dark-neon-accent))] mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-[hsl(var(--dark-neon-accent))]">SMS Verification Required</p>
                <p className="text-xs text-[hsl(var(--dark-muted))] mt-1">
                  Please complete SMS verification to use coupons
                </p>
                <Button 
                  variant="link" 
                  className="p-0 h-auto text-[hsl(var(--dark-neon-primary))] text-sm mt-2"
                  onClick={() => navigate(basePath + "/mypage/sms-verification")}
                >
                  Verify SMS
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          </Card>
        )}

        <div>
          <h2 className="text-sm font-bold text-[hsl(var(--dark-muted))] mb-3">Your Coupons</h2>
          <Card className={cn(
            "p-8 text-center",
            "bg-[hsl(var(--dark-surface-elevated))] border-[hsl(var(--dark-border))]"
          )}>
            <p className="text-[hsl(var(--dark-muted))] text-sm">You have no coupons</p>
          </Card>
        </div>

        <AlertDialog open={showSmsAlert} onOpenChange={setShowSmsAlert}>
          <AlertDialogContent className="bg-[hsl(var(--dark-surface))] border-[hsl(var(--dark-border))]">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-[hsl(var(--dark-foreground))]">SMS Verification Required</AlertDialogTitle>
              <AlertDialogDescription className="text-[hsl(var(--dark-muted))]">
                Please complete SMS verification to use coupons.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-[hsl(var(--dark-surface-elevated))] border-[hsl(var(--dark-border))] text-[hsl(var(--dark-foreground))]">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => navigate(basePath + "/mypage/sms-verification")}
                className="bg-[hsl(var(--dark-neon-primary))] text-[hsl(var(--dark-background))]"
              >
                Verify SMS
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DarkThemeLayout>
  );
};

export default DarkThemeCoupon;
