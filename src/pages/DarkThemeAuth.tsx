import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { z } from "zod";
import { Eye, EyeOff, Mail, ArrowLeft } from "lucide-react";
import DarkThemeLayout from "@/components/layout/DarkThemeLayout";
import { useTenant } from "@/hooks/useTenant";

const authSchema = z.object({
  email: z.string().trim().email("有効なメールアドレスを入力してください").max(255),
  password: z.string().min(6, "パスワードは6文字以上で入力してください").max(100),
});

const emailSchema = z.object({
  email: z.string().trim().email("有効なメールアドレスを入力してください").max(255),
});

export default function DarkThemeAuth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode") || "login";
  const { tenant, tenantSlug } = useTenant();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const basePath = tenantSlug ? `/${tenantSlug}` : "";

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          navigate(basePath || "/");
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        navigate(basePath || "/");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, basePath]);

  const validateForm = () => {
    try {
      authSchema.parse({ email: email.trim(), password });
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: { email?: string; password?: string } = {};
        error.errors.forEach((err) => {
          if (err.path[0] === "email") fieldErrors.email = err.message;
          if (err.path[0] === "password") fieldErrors.password = err.message;
        });
        setErrors(fieldErrors);
      }
      return false;
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    
    const { data, error } = await supabase.auth.signInWithPassword({ 
      email: email.trim(), 
      password 
    });
    
    if (error) {
      setLoading(false);
      if (error.message.includes("Invalid login credentials")) {
        toast.error("Invalid email or password");
      } else {
        toast.error("Login error: " + error.message);
      }
      return;
    }

    if (data.user) {
      const currentTenantId = tenant?.id || null;
      
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, tenant_id")
        .eq("user_id", data.user.id)
        .eq("tenant_id", currentTenantId)
        .maybeSingle();

      if (profileError) {
        setLoading(false);
        toast.error("Failed to retrieve profile");
        await supabase.auth.signOut({ scope: 'local' });
        return;
      }

      if (!profile && currentTenantId) {
        const { error: createError } = await supabase.rpc("create_tenant_profile", {
          p_user_id: data.user.id,
          p_tenant_id: currentTenantId,
          p_display_name: data.user.email,
          p_email: data.user.email,
        });

        if (createError) {
          setLoading(false);
          toast.error("Failed to register with this site. Please sign up.");
          await supabase.auth.signOut({ scope: 'local' });
          return;
        }
        
        toast.success("Welcome! Your account has been created.");
      } else if (!profile && !currentTenantId) {
        const { data: anyProfile } = await supabase
          .from("profiles")
          .select("tenant_id")
          .eq("user_id", data.user.id)
          .limit(1)
          .maybeSingle();

        if (anyProfile?.tenant_id) {
          setLoading(false);
          toast.error("This account is not registered on this site.");
          await supabase.auth.signOut({ scope: 'local' });
          return;
        }
      }
    }

    setLoading(false);
    toast.success("Login successful");
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    
    const redirectUrl = `${window.location.origin}${basePath}/`;
    
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { 
        emailRedirectTo: redirectUrl,
        data: {
          tenant_id: tenant?.id || null,
        }
      },
    });
    setLoading(false);

    if (error) {
      if (error.message.includes("already registered")) {
        toast.error("このメールアドレスは既に登録されています");
      } else {
        toast.error("登録エラー: " + error.message);
      }
    } else {
      toast.success("確認メールを送信しました。メールをご確認ください。");
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      emailSchema.parse({ email: email.trim() });
      setErrors({});
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: { email?: string } = {};
        error.errors.forEach((err) => {
          if (err.path[0] === "email") fieldErrors.email = err.message;
        });
        setErrors(fieldErrors);
      }
      return;
    }

    setLoading(true);
    
    const redirectUrl = `${window.location.origin}${basePath}/`;
    
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          tenant_id: tenant?.id || null,
        }
      },
    });
    
    setLoading(false);

    if (error) {
      toast.error("メール送信エラー: " + error.message);
    } else {
      setMagicLinkSent(true);
      toast.success("ログインリンクを送信しました");
    }
  };

  const isLogin = mode !== "signup" && mode !== "magiclink";
  const isMagicLink = mode === "magiclink";

  // Magic Link sent confirmation screen
  if (magicLinkSent) {
    return (
      <DarkThemeLayout showFooter={true}>
        <div className="min-h-[calc(100vh-200px)] flex flex-col items-center justify-center px-4 py-8">
          <div className="w-full max-w-md text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[hsl(var(--dark-neon-primary))]/20 flex items-center justify-center">
              <Mail className="w-8 h-8 text-[hsl(var(--dark-neon-primary))]" />
            </div>
            <h1 className="text-2xl font-bold text-[hsl(var(--dark-foreground))] mb-4">
              メールを確認してください
            </h1>
            <p className="text-[hsl(var(--dark-muted))] mb-6">
              <span className="text-[hsl(var(--dark-foreground))]">{email}</span> に
              ログインリンクを送信しました。
            </p>
            <p className="text-sm text-[hsl(var(--dark-muted))] mb-8">
              メールが届かない場合は、迷惑メールフォルダをご確認ください。
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setMagicLinkSent(false);
                setEmail("");
              }}
              className="border-[hsl(var(--dark-border))] text-[hsl(var(--dark-foreground))]"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              戻る
            </Button>
          </div>
        </div>
      </DarkThemeLayout>
    );
  }

  return (
    <DarkThemeLayout showFooter={true}>
      <div className="min-h-[calc(100vh-200px)] flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          {/* Tenant name */}
          {tenant && (
            <div className="text-center mb-4">
              <span className="text-sm text-[hsl(var(--dark-muted))]">{tenant.name}</span>
            </div>
          )}
          
          <h1 className="text-2xl font-bold text-[hsl(var(--dark-foreground))] mb-8">
            {isMagicLink ? "メールでログイン" : isLogin ? "ログイン" : "新規登録"}
          </h1>

          {/* Magic Link Form */}
          {isMagicLink ? (
            <form onSubmit={handleMagicLink} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm text-[hsl(var(--dark-foreground))]">
                  メールアドレス
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 border-[hsl(var(--dark-border))] bg-[hsl(var(--dark-surface-elevated))] text-[hsl(var(--dark-foreground))] placeholder:text-[hsl(var(--dark-muted))] focus:border-[hsl(var(--dark-neon-primary))] focus:ring-[hsl(var(--dark-neon-primary))]"
                  placeholder="you@example.com"
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-base font-bold bg-gradient-to-r from-[hsl(var(--dark-neon-gold))] to-[hsl(40,100%,45%)] text-black hover:brightness-110 transition-all"
                disabled={loading}
              >
                {loading ? "送信中..." : "ログインリンクを送信"}
              </Button>

              <p className="text-xs text-center text-[hsl(var(--dark-muted))]">
                ※ 旧サイトのアカウントをお持ちの方は、こちらからログインできます
              </p>
            </form>
          ) : (
            /* Regular Login/Signup Form */
            <form onSubmit={isLogin ? handleLogin : handleSignUp} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm text-[hsl(var(--dark-foreground))]">
                  メールアドレス
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 border-[hsl(var(--dark-border))] bg-[hsl(var(--dark-surface-elevated))] text-[hsl(var(--dark-foreground))] placeholder:text-[hsl(var(--dark-muted))] focus:border-[hsl(var(--dark-neon-primary))] focus:ring-[hsl(var(--dark-neon-primary))]"
                  placeholder="you@example.com"
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm text-[hsl(var(--dark-foreground))]">
                  パスワード
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 border-[hsl(var(--dark-border))] bg-[hsl(var(--dark-surface-elevated))] text-[hsl(var(--dark-foreground))] placeholder:text-[hsl(var(--dark-muted))] pr-12 focus:border-[hsl(var(--dark-neon-primary))] focus:ring-[hsl(var(--dark-neon-primary))]"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--dark-muted))] hover:text-[hsl(var(--dark-foreground))] transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-base font-bold bg-gradient-to-r from-[hsl(var(--dark-neon-gold))] to-[hsl(40,100%,45%)] text-black hover:brightness-110 transition-all"
                disabled={loading}
              >
                {loading
                  ? isLogin
                    ? "ログイン中..."
                    : "登録中..."
                  : isLogin
                  ? "ログイン"
                  : "アカウント作成"}
              </Button>
            </form>
          )}

          {/* Links Section */}
          {isLogin && !isMagicLink && (
            <div className="mt-6 text-center space-y-3">
              <Link
                to={`${basePath}/auth?mode=magiclink`}
                className="block text-sm text-[hsl(var(--dark-neon-primary))] hover:underline transition-colors"
              >
                <Mail className="w-4 h-4 inline mr-1" />
                メールでログイン（パスワード不要）
              </Link>
              <Link
                to={`${basePath}/auth?mode=signup`}
                className="block text-sm text-[hsl(var(--dark-muted))] hover:text-[hsl(var(--dark-foreground))] transition-colors"
              >
                新規アカウント作成
              </Link>
            </div>
          )}

          {isMagicLink && (
            <div className="mt-6 text-center">
              <Link
                to={`${basePath}/auth?mode=login`}
                className="text-sm text-[hsl(var(--dark-muted))] hover:text-[hsl(var(--dark-foreground))] transition-colors"
              >
                <ArrowLeft className="w-4 h-4 inline mr-1" />
                パスワードでログイン
              </Link>
            </div>
          )}

          {!isLogin && !isMagicLink && (
            <div className="mt-6 text-center">
              <Link
                to={`${basePath}/auth?mode=login`}
                className="text-sm text-[hsl(var(--dark-neon-primary))] hover:underline transition-colors"
              >
                すでにアカウントをお持ちの方
              </Link>
            </div>
          )}
        </div>
      </div>
    </DarkThemeLayout>
  );
}
