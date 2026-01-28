import { useState } from "react";
import { useNavigate } from "react-router-dom";
import DarkThemeLayout from "@/components/layout/DarkThemeLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Phone, ArrowLeft, Shield } from "lucide-react";
import { toast } from "sonner";
import { useTenant } from "@/hooks/useTenant";
import { cn } from "@/lib/utils";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

const DarkThemeSmsVerification = () => {
  const navigate = useNavigate();
  const { tenantSlug } = useTenant();
  const basePath = tenantSlug ? `/${tenantSlug}` : "";
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const validatePhoneNumber = (phone: string) => {
    const cleaned = phone.replace(/[-\s]/g, "");
    return /^0[789]0\d{8}$/.test(cleaned);
  };

  const handleSendCode = async () => {
    setError("");
    
    if (!validatePhoneNumber(phoneNumber)) {
      setError("Please enter a valid mobile phone number (e.g., 090-1234-5678)");
      return;
    }

    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    toast.success("Verification code sent");
    setStep("code");
    setIsLoading(false);
  };

  const handleVerifyCode = async () => {
    if (verificationCode.length !== 6) {
      setError("Please enter the 6-digit verification code");
      return;
    }

    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    toast.success("SMS verification complete");
    navigate(basePath + "/mypage");
    setIsLoading(false);
  };

  const formatPhoneNumber = (value: string) => {
    const numbers = value.replace(/\D/g, "").slice(0, 11);
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`;
  };

  return (
    <DarkThemeLayout>
      <div className="container px-4 py-6 max-w-2xl mx-auto">
        <button
          onClick={() => step === "code" ? setStep("phone") : navigate(basePath + "/mypage")}
          className="flex items-center gap-2 text-[hsl(var(--dark-muted))] mb-4 hover:text-[hsl(var(--dark-foreground))] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="text-sm">{step === "code" ? "Back to phone entry" : "Back to My Page"}</span>
        </button>

        <h1 className="text-xl font-bold mb-6 text-[hsl(var(--dark-neon-primary))]">SMS Verification</h1>

        {step === "phone" ? (
          <Card className={cn(
            "p-6",
            "bg-[hsl(var(--dark-surface-elevated))] border-[hsl(var(--dark-border))]"
          )}>
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-full bg-[hsl(var(--dark-neon-gold)/0.2)] flex items-center justify-center">
                <Phone className="h-5 w-5 text-[hsl(var(--dark-neon-gold))]" />
              </div>
              <div>
                <p className="font-bold text-[hsl(var(--dark-foreground))]">Enter Phone Number</p>
                <p className="text-xs text-[hsl(var(--dark-muted))]">We'll send a verification code via SMS</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-[hsl(var(--dark-foreground))]">Mobile Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="090-1234-5678"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(formatPhoneNumber(e.target.value))}
                  className={cn(
                    "bg-[hsl(var(--dark-surface))] border-[hsl(var(--dark-border))] text-[hsl(var(--dark-foreground))]",
                    error && "border-[hsl(var(--dark-neon-accent))]"
                  )}
                />
                {error && (
                  <p className="text-xs text-[hsl(var(--dark-neon-accent))]">{error}</p>
                )}
              </div>

              <Button 
                onClick={handleSendCode} 
                className="w-full bg-[hsl(var(--dark-neon-primary))] text-[hsl(var(--dark-background))] hover:bg-[hsl(var(--dark-neon-primary)/0.9)]"
                disabled={isLoading}
              >
                {isLoading ? "Sending..." : "Send Verification Code"}
              </Button>
            </div>

            <p className="text-xs text-[hsl(var(--dark-muted))] mt-4 text-center">
              A 6-digit verification code will be sent to your phone via SMS
            </p>
          </Card>
        ) : (
          <Card className={cn(
            "p-6",
            "bg-[hsl(var(--dark-surface-elevated))] border-[hsl(var(--dark-border))]"
          )}>
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-full bg-[hsl(var(--dark-neon-gold)/0.2)] flex items-center justify-center">
                <Shield className="h-5 w-5 text-[hsl(var(--dark-neon-gold))]" />
              </div>
              <div>
                <p className="font-bold text-[hsl(var(--dark-foreground))]">Enter Verification Code</p>
                <p className="text-xs text-[hsl(var(--dark-muted))]">Sent to {phoneNumber}</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={verificationCode}
                  onChange={(value) => {
                    setVerificationCode(value);
                    setError("");
                  }}
                >
                  <InputOTPGroup className="gap-2">
                    {[0, 1, 2, 3, 4, 5].map((index) => (
                      <InputOTPSlot 
                        key={index}
                        index={index} 
                        className="bg-[hsl(var(--dark-surface))] border-[hsl(var(--dark-border))] text-[hsl(var(--dark-foreground))]"
                      />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>

              {error && (
                <p className="text-xs text-[hsl(var(--dark-neon-accent))] text-center">{error}</p>
              )}

              <Button 
                onClick={handleVerifyCode} 
                className="w-full bg-[hsl(var(--dark-neon-primary))] text-[hsl(var(--dark-background))] hover:bg-[hsl(var(--dark-neon-primary)/0.9)]"
                disabled={isLoading || verificationCode.length !== 6}
              >
                {isLoading ? "Verifying..." : "Verify"}
              </Button>

              <div className="text-center">
                <Button 
                  variant="link" 
                  className="text-sm text-[hsl(var(--dark-muted))] hover:text-[hsl(var(--dark-neon-primary))]"
                  onClick={handleSendCode}
                  disabled={isLoading}
                >
                  Resend verification code
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </DarkThemeLayout>
  );
};

export default DarkThemeSmsVerification;
