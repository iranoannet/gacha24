import { Bell, Plus, LogIn, UserPlus } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

const Header = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

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
              {/* Points Display */}
              <div className="points-badge">
                <span className="text-xs">JP¥</span>
                <span className="font-bold">0</span>
              </div>

              {/* Add Points Button */}
              <Button
                size="sm"
                variant="outline"
                className="h-8 w-8 p-0 rounded-full border-primary text-primary hover:bg-primary hover:text-primary-foreground"
              >
                <Plus className="h-4 w-4" />
              </Button>

              {/* Notifications */}
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 rounded-full relative"
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
                onClick={() => navigate("/auth?mode=signup")}
              >
                新規登録
              </Button>

              {/* Login Button */}
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-3 text-sm border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                onClick={() => navigate("/auth?mode=login")}
              >
                ログイン
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
};

export default Header;
