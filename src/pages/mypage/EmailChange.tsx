import { useState } from "react";
import { useNavigate } from "react-router-dom";
import MainLayout from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { z } from "zod";

const emailSchema = z.object({
  email: z.string().trim().email("有効なメールアドレスを入力してください").max(255, "メールアドレスは255文字以内で入力してください"),
});

const EmailChange = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [newEmail, setNewEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; confirm?: string }>({});

  const validateForm = () => {
    const newErrors: { email?: string; confirm?: string } = {};
    
    const result = emailSchema.safeParse({ email: newEmail });
    if (!result.success) {
      newErrors.email = result.error.errors[0]?.message;
    }
    
    if (newEmail !== confirmEmail) {
      newErrors.confirm = "メールアドレスが一致しません";
    }
    
    if (newEmail === user?.email) {
      newErrors.email = "現在のメールアドレスと同じです";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        email: newEmail,
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success("確認メールを送信しました。新しいメールアドレスで確認してください。");
        navigate("/mypage");
      }
    } catch (error) {
      toast.error("エラーが発生しました");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="container px-4 py-6 max-w-2xl mx-auto">
        <button
          onClick={() => navigate("/mypage")}
          className="flex items-center gap-2 text-muted-foreground mb-4 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="text-sm">マイページに戻る</span>
        </button>

        <h1 className="text-xl font-bold mb-6">メールアドレス変更</h1>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">現在のメールアドレス</p>
              <p className="font-medium text-foreground">{user?.email || "未設定"}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newEmail">新しいメールアドレス</Label>
              <Input
                id="newEmail"
                type="email"
                placeholder="新しいメールアドレスを入力"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className={errors.email ? "border-destructive" : ""}
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmEmail">新しいメールアドレス（確認）</Label>
              <Input
                id="confirmEmail"
                type="email"
                placeholder="新しいメールアドレスを再入力"
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                className={errors.confirm ? "border-destructive" : ""}
              />
              {errors.confirm && (
                <p className="text-xs text-destructive">{errors.confirm}</p>
              )}
            </div>

            <div className="pt-4">
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "送信中..." : "変更する"}
              </Button>
            </div>
          </form>

          <p className="text-xs text-muted-foreground mt-4 text-center">
            新しいメールアドレスに確認メールが送信されます。<br />
            メール内のリンクをクリックして変更を完了してください。
          </p>
        </Card>
      </div>
    </MainLayout>
  );
};

export default EmailChange;
