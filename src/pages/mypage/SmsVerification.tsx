import { useState } from "react";
import { useNavigate } from "react-router-dom";
import MainLayout from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Phone, ArrowLeft, Shield } from "lucide-react";
import { toast } from "sonner";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

const SmsVerification = () => {
  const navigate = useNavigate();
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
      setError("有効な携帯電話番号を入力してください（例: 090-1234-5678）");
      return;
    }

    setIsLoading(true);
    
    // TODO: Implement actual SMS sending via Edge Function
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    toast.success("認証コードを送信しました");
    setStep("code");
    setIsLoading(false);
  };

  const handleVerifyCode = async () => {
    if (verificationCode.length !== 6) {
      setError("6桁の認証コードを入力してください");
      return;
    }

    setIsLoading(true);
    
    // TODO: Implement actual code verification
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // For demo purposes, accept any 6-digit code
    toast.success("SMS認証が完了しました");
    navigate("/mypage");
    setIsLoading(false);
  };

  const formatPhoneNumber = (value: string) => {
    const numbers = value.replace(/\D/g, "").slice(0, 11);
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`;
  };

  return (
    <MainLayout>
      <div className="container px-4 py-6 max-w-2xl mx-auto">
        <button
          onClick={() => step === "code" ? setStep("phone") : navigate("/mypage")}
          className="flex items-center gap-2 text-muted-foreground mb-4 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="text-sm">{step === "code" ? "電話番号入力に戻る" : "マイページに戻る"}</span>
        </button>

        <h1 className="text-xl font-bold mb-6">SMS認証</h1>

        {step === "phone" ? (
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Phone className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-bold text-foreground">電話番号を入力</p>
                <p className="text-xs text-muted-foreground">SMSで認証コードを送信します</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">携帯電話番号</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="090-1234-5678"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(formatPhoneNumber(e.target.value))}
                  className={error ? "border-destructive" : ""}
                />
                {error && (
                  <p className="text-xs text-destructive">{error}</p>
                )}
              </div>

              <Button 
                onClick={handleSendCode} 
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? "送信中..." : "認証コードを送信"}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground mt-4 text-center">
              入力された電話番号にSMSで6桁の認証コードを送信します
            </p>
          </Card>
        ) : (
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-bold text-foreground">認証コードを入力</p>
                <p className="text-xs text-muted-foreground">{phoneNumber} に送信しました</p>
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
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              {error && (
                <p className="text-xs text-destructive text-center">{error}</p>
              )}

              <Button 
                onClick={handleVerifyCode} 
                className="w-full"
                disabled={isLoading || verificationCode.length !== 6}
              >
                {isLoading ? "確認中..." : "認証する"}
              </Button>

              <div className="text-center">
                <Button 
                  variant="link" 
                  className="text-sm text-muted-foreground"
                  onClick={handleSendCode}
                  disabled={isLoading}
                >
                  認証コードを再送信
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </MainLayout>
  );
};

export default SmsVerification;
