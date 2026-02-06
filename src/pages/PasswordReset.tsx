import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { z } from "zod";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import MainLayout from "@/components/layout/MainLayout";
import { useTenant } from "@/hooks/useTenant";

const emailSchema = z.string().trim().email("有効なメールアドレスを入力してください");
const passwordSchema = z.string().min(6, "パスワードは6文字以上で入力してください").max(100);

export default function PasswordReset() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { tenantSlug } = useTenant();
  const basePath = tenantSlug ? `/${tenantSlug}` : "";

  // If we have access_token in hash, user clicked the reset link
  const isUpdateMode = window.location.hash.includes("type=recovery");

  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; confirm?: string }>({});

  const handleSendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = emailSchema.safeParse(email.trim());
    if (!result.success) {
      setErrors({ email: result.error.errors[0]?.message });
      return;
    }

    setLoading(true);
    const redirectUrl = `${window.location.origin}${basePath}/password-reset`;

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: redirectUrl,
    });

    setLoading(false);
    if (error) {
      toast.error("エラーが発生しました: " + error.message);
    } else {
      setSent(true);
      toast.success("パスワードリセットメールを送信しました");
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { password?: string; confirm?: string } = {};

    const result = passwordSchema.safeParse(newPassword);
    if (!result.success) {
      newErrors.password = result.error.errors[0]?.message;
    }
    if (newPassword !== confirmPassword) {
      newErrors.confirm = "パスワードが一致しません";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);

    if (error) {
      toast.error("パスワードの更新に失敗しました: " + error.message);
    } else {
      toast.success("パスワードを更新しました");
      navigate(`${basePath}/auth?mode=login`);
    }
  };

  return (
    <MainLayout hideBottomNav>
      <div className="min-h-[calc(100vh-120px)] flex flex-col bg-background">
        <div className="container px-4 py-8 max-w-md mx-auto flex-1">
          <Link
            to={`${basePath}/auth?mode=login`}
            className="flex items-center gap-2 text-muted-foreground mb-6 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">ログインに戻る</span>
          </Link>

          <h1 className="text-2xl font-bold text-foreground mb-2">
            {isUpdateMode ? "新しいパスワードを設定" : "パスワードをリセット"}
          </h1>
          <p className="text-sm text-muted-foreground mb-8">
            {isUpdateMode
              ? "新しいパスワードを入力してください"
              : "登録メールアドレスにリセットリンクを送信します"}
          </p>

          {isUpdateMode ? (
            <form onSubmit={handleUpdatePassword} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="newPassword">新しいパスワード</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={`h-12 pr-12 ${errors.password ? "border-destructive" : ""}`}
                    placeholder="6文字以上"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showNew ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">パスワード確認</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`h-12 pr-12 ${errors.confirm ? "border-destructive" : ""}`}
                    placeholder="もう一度入力"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {errors.confirm && <p className="text-sm text-destructive">{errors.confirm}</p>}
              </div>

              <Button type="submit" className="w-full h-12 btn-gacha text-base font-bold" disabled={loading}>
                {loading ? "更新中..." : "パスワードを更新"}
              </Button>
            </form>
          ) : sent ? (
            <div className="text-center space-y-4 py-8">
              <p className="text-foreground">
                <strong>{email}</strong> にリセットリンクを送信しました。
              </p>
              <p className="text-sm text-muted-foreground">
                メールが届かない場合は、迷惑メールフォルダをご確認ください。
              </p>
              <Button
                variant="outline"
                onClick={() => setSent(false)}
                className="mt-4"
              >
                再送信する
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSendReset} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email">メールアドレス</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`h-12 ${errors.email ? "border-destructive" : ""}`}
                  placeholder="登録したメールアドレス"
                />
                {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
              </div>

              <Button type="submit" className="w-full h-12 btn-gacha text-base font-bold" disabled={loading}>
                {loading ? "送信中..." : "リセットリンクを送信"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
