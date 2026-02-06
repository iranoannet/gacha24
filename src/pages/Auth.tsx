import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { z } from "zod";
import { Eye, EyeOff } from "lucide-react";
import MainLayout from "@/components/layout/MainLayout";
import { useTenant } from "@/hooks/useTenant";

const authSchema = z.object({
  email: z.string().trim().email("有効なメールアドレスを入力してください").max(255),
  password: z.string().min(6, "パスワードは6文字以上で入力してください").max(100),
});

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode") || "login";
  const { tenant, tenantSlug } = useTenant();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  // Get the base path for current tenant
  const basePath = tenantSlug ? `/${tenantSlug}` : "";

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          // Redirect to tenant-specific home if on a tenant path
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
        toast.error("メールアドレスまたはパスワードが正しくありません");
      } else {
        toast.error("ログインエラー: " + error.message);
      }
      return;
    }

    // Check if user has a profile for current tenant
    if (data.user) {
      const currentTenantId = tenant?.id || null;
      
      // Query for profile with matching tenant_id
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, tenant_id")
        .eq("user_id", data.user.id)
        .eq("tenant_id", currentTenantId)
        .maybeSingle();

      if (profileError) {
        setLoading(false);
        toast.error("プロフィールの取得に失敗しました");
        await supabase.auth.signOut({ scope: 'local' });
        return;
      }

      // If no profile for this tenant, create one (for existing users logging into new tenant)
      if (!profile && currentTenantId) {
        // User exists but doesn't have a profile for this tenant
        // Create a new tenant-specific profile
        const { error: createError } = await supabase.rpc("create_tenant_profile", {
          p_user_id: data.user.id,
          p_tenant_id: currentTenantId,
          p_display_name: data.user.email,
          p_email: data.user.email,
        });

        if (createError) {
          setLoading(false);
          toast.error("このテナントへの登録に失敗しました。新規登録してください。");
          await supabase.auth.signOut({ scope: 'local' });
          return;
        }
        
        toast.success("新しいサイトへようこそ！アカウントを作成しました。");
      } else if (!profile && !currentTenantId) {
        // User has profiles for tenants but not for the default site
        // Check if they have any profile at all
        const { data: anyProfile } = await supabase
          .from("profiles")
          .select("tenant_id")
          .eq("user_id", data.user.id)
          .limit(1)
          .maybeSingle();

        if (anyProfile?.tenant_id) {
          // User belongs to a specific tenant, not the default site
          setLoading(false);
          toast.error("このサイトのアカウントではありません。テナントサイトからログインしてください。");
          await supabase.auth.signOut({ scope: 'local' });
          return;
        }
      }
    }

    setLoading(false);
    toast.success("ログインしました");
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    
    // Set redirect URL with tenant path
    const redirectUrl = `${window.location.origin}${basePath}/`;
    
    // Include tenant_id in user metadata for the DB trigger to use
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
      toast.success("アカウントを作成しました");
    }
  };

  const isLogin = mode !== "signup";

  return (
    <MainLayout hideBottomNav>
      <div className="min-h-[calc(100vh-120px)] flex flex-col bg-background">
        <div className="container px-4 py-8 max-w-md mx-auto flex-1">
          {/* Show tenant name if on a tenant site */}
          {tenant && (
            <div className="text-center mb-4">
              <span className="text-sm text-muted-foreground">{tenant.name}</span>
            </div>
          )}
          
          <h1 className="text-2xl font-bold text-foreground mb-8">
            {isLogin ? "ログイン" : "アカウント新規作成"}
          </h1>

          <form onSubmit={isLogin ? handleLogin : handleSignUp} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm text-foreground">
                メールアドレス
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 border-border bg-background"
                placeholder=""
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm text-foreground">
                パスワード
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 border-border bg-background pr-12"
                  placeholder=""
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
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
              className="w-full h-12 btn-gacha text-base font-bold"
              disabled={loading}
            >
              {loading
                ? isLogin
                  ? "ログイン中..."
                  : "登録中..."
                : isLogin
                ? "ログインする"
                : "アカウントを作成する"}
            </Button>
          </form>

          {isLogin && (
            <div className="mt-6 text-center space-y-3">
              <Link
                to={`${basePath}/password-reset`}
                className="text-sm text-muted-foreground underline underline-offset-4 hover:text-primary transition-colors"
              >
                パスワードをお忘れですか？
              </Link>
              <Link
                to={`${basePath}/auth?mode=signup`}
                className="block text-sm text-foreground underline underline-offset-4 hover:text-primary transition-colors"
              >
                アカウント新規作成
              </Link>
            </div>
          )}

          {!isLogin && (
            <div className="mt-6 text-center">
              <Link
                to={`${basePath}/auth?mode=login`}
                className="text-sm text-foreground underline underline-offset-4 hover:text-primary transition-colors"
              >
                既にアカウントをお持ちの方はこちら
              </Link>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
