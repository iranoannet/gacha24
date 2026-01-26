import { Bell, LogIn, UserPlus, Loader2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const Header = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  // ユーザーのプロファイル（ポイント残高）を取得
  const { data: profile } = useQuery({
    queryKey: ["user-profile-header", user?.id],
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
    refetchInterval: 5000, // 5秒ごとに更新
  });

  const pointsBalance = profile?.points_balance ?? 0;

  return (
    <header className="sticky top-0 z-40 bg-card border-b border-border">
      <div className="container flex items-center justify-between h-14 px-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <h1 className="text-xl font-black text-gradient-gold">
            トレカガチャ
          </h1>
        </Link>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          {user ? (
            <>
              {/* Points Display - Clickable */}
              <button
                onClick={() => navigate("/points")}
                className="points-badge cursor-pointer hover:opacity-80 transition-opacity"
              >
                <span className="text-xs">JP¥</span>
                <span className="font-bold">{pointsBalance.toLocaleString()}</span>
              </button>

              {/* Notifications */}
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 rounded-full relative"
                onClick={() => navigate("/notifications")}
              >
                <Bell className="h-5 w-5 text-muted-foreground" />
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-accent text-[10px] font-bold text-accent-foreground flex items-center justify-center">
                  3
                </span>
              </Button>
            </>
          ) : !loading ? (
            <>
              {/* Sign Up Button */}
              <Button
                size="sm"
                className="btn-gacha h-8 px-3 text-sm font-bold"
                onClick={() => {
                  console.log("[Header] Sign up clicked");
                  navigate("/auth?mode=signup");
                }}
              >
                新規登録
              </Button>

              {/* Login Button */}
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-3 text-sm border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                onClick={() => {
                  console.log("[Header] Login clicked");
                  navigate("/auth?mode=login");
                }}
              >
                ログイン
              </Button>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">読込中...</span>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;