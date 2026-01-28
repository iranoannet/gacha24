import { useNavigate } from "react-router-dom";
import MainLayout from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { 
  User, 
  ChevronRight, 
  Ticket, 
  ShoppingBag, 
  MapPin, 
  Shield, 
  Mail, 
  Lock, 
  LogOut,
  HelpCircle,
  Bell,
  FileText,
  BookOpen
} from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { toast } from "sonner";
import DarkThemeMyPage from "./DarkThemeMyPage";

// Tenants that use dark theme
const DARK_THEME_TENANTS = ["get24", "get"];

const MyPage = () => {
  const { tenantSlug } = useTenant();
  
  // Check if this tenant uses dark theme
  const useDarkTheme = tenantSlug && DARK_THEME_TENANTS.includes(tenantSlug);
  
  if (useDarkTheme) {
    return <DarkThemeMyPage />;
  }
  
  return <LightThemeMyPage />;
};

const LightThemeMyPage = () => {
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    toast.success("ログアウトしました");
    navigate("/");
  };

  const handleUserCardClick = () => {
    if (!user) {
      navigate("/auth");
    }
  };

  return (
    <MainLayout>
      <div className="container px-4 py-6 max-w-2xl mx-auto">
        <h1 className="text-xl font-bold mb-4">マイページ</h1>

        {/* User Profile Card */}
        <Card 
          className="p-4 mb-4 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={handleUserCardClick}
        >
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <User className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="flex-1">
              {loading ? (
                <p className="text-sm text-muted-foreground">読み込み中...</p>
              ) : user ? (
                <>
                  <p className="font-medium text-foreground">{user.email}</p>
                  <p className="text-xs text-muted-foreground">ログイン中</p>
                </>
              ) : (
                <>
                  <p className="font-medium text-foreground">ゲストユーザー</p>
                  <p className="text-xs text-muted-foreground">ログインしてください</p>
                </>
              )}
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>
        </Card>

        {/* Rank Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          {/* Rank Banner */}
          <div className="rounded-t-2xl bg-gradient-to-r from-primary via-primary to-gold-dark p-5 relative overflow-hidden">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border-2 border-white/30 shadow-lg">
                <span className="text-3xl">🏅</span>
              </div>
              <div>
                <p className="text-xs text-primary-foreground/80 font-medium">現在のランク</p>
                <p className="text-2xl font-black text-primary-foreground tracking-wide">BEGINNER</p>
                <p className="text-xs text-primary-foreground/70">コイン還元率0.0%</p>
              </div>
            </div>
          </div>
          
          {/* Rank Points Progress */}
          <Card className="rounded-t-none rounded-b-2xl border-t-0">
            <div className="p-4">
              <p className="text-sm font-bold text-foreground mb-3">ランクポイント</p>
              <div className="w-full bg-muted rounded-full h-2 mb-2">
                <div className="bg-primary h-2 rounded-full" style={{ width: '0%' }}></div>
              </div>
              <p className="text-right text-xs text-muted-foreground">
                次のランクまで <span className="text-lg font-bold text-foreground">100,000</span> pt
              </p>
            </div>
          </Card>
        </motion.div>

        {/* Rank Info Section */}
        <Card className="p-4 mb-6">
          <div className="space-y-4 text-sm">
            <div>
              <h3 className="font-bold text-foreground mb-2">■ ランクについて</h3>
              <p className="text-muted-foreground text-xs leading-relaxed">
                コイン購入時の還元率アップ、ランクアップ時のコインプレゼント、ランク限定オリパなど、さまざまな特典が受けられるランクシステムです。
                ステージは7段階で、累計のランクポイントによって決まります。
              </p>
            </div>
            <div>
              <h3 className="font-bold text-foreground mb-2">■ ランクポイントについて</h3>
              <p className="text-muted-foreground text-xs">
                1コインの購入で、ランクポイントを1pt獲得できます。
              </p>
            </div>
            <div>
              <h3 className="font-bold text-foreground mb-2">■ ランクアップ条件</h3>
              <p className="text-muted-foreground text-xs">
                ランクごとに設定されたランクポイントを達成することで、次のランクに昇格します。
              </p>
            </div>
          </div>
        </Card>

        {/* Referral Code */}
        <Card className="p-4 mb-6 border-primary border-2">
          <div className="flex items-center gap-2 mb-2">
            <Ticket className="h-4 w-4 text-primary" />
            <span className="text-sm font-bold text-primary">招待コード</span>
          </div>
          <p className="text-xs text-muted-foreground mb-2">
            ※ フロフィログインなど で登録
          </p>
          <div className="bg-muted rounded-lg p-3 text-sm font-mono text-foreground">
            【期間限定】友達招待キャンペーン開催中！
          </div>
        </Card>

        {/* Menu List */}
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-foreground mb-2">アカウント</h3>
          
          <MenuItem icon={Ticket} label="クーポン利用" onClick={() => navigate("/mypage/coupon")} />
          <MenuItem icon={ShoppingBag} label="購入履歴" onClick={() => navigate("/history")} />
          <MenuItem icon={MapPin} label="お届け先の登録" onClick={() => navigate("/mypage/address")} />
          <MenuItem icon={Shield} label="SMS認証" badge="未認証" badgeVariant="warning" onClick={() => navigate("/mypage/sms-verification")} />
          <MenuItem icon={User} label="LINE連携" badge="未連携" badgeVariant="warning" onClick={() => navigate("/mypage/line")} />
          <MenuItem icon={Mail} label="メールアドレス変更" onClick={() => navigate("/mypage/email")} />
          <MenuItem icon={Lock} label="パスワード変更" onClick={() => navigate("/mypage/password")} />
          {user && (
            <MenuItem icon={LogOut} label="ログアウト" onClick={handleLogout} />
          )}
        </div>

        <div className="space-y-1 mt-6">
          <h3 className="text-sm font-bold text-foreground mb-2">サポート</h3>
          
          <MenuItem icon={Bell} label="お知らせ" onClick={() => navigate("/notifications")} />
          <MenuItem icon={HelpCircle} label="よくある質問/お問い合わせ" onClick={() => navigate("/faq")} />
        </div>

        <div className="space-y-1 mt-6">
          <h3 className="text-sm font-bold text-foreground mb-2">その他</h3>
          
          <MenuItem icon={FileText} label="利用規約" onClick={() => navigate("/terms")} />
          <MenuItem icon={BookOpen} label="プライバシーポリシー" onClick={() => navigate("/privacy")} />
          <MenuItem icon={FileText} label="特定商取引法に基づく表記" onClick={() => navigate("/legal")} />
        </div>
      </div>
    </MainLayout>
  );
};

interface MenuItemProps {
  icon: React.ElementType;
  label: string;
  badge?: string;
  badgeVariant?: "warning" | "success";
  onClick?: () => void;
}

const MenuItem = ({ icon: Icon, label, badge, badgeVariant, onClick }: MenuItemProps) => {
  return (
    <button 
      className="w-full flex items-center gap-3 p-3 hover:bg-muted rounded-lg transition-colors"
      onClick={onClick}
    >
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="flex-1 text-sm text-foreground text-left">{label}</span>
      {badge && (
        <span className={`text-xs px-2 py-0.5 rounded-full ${
          badgeVariant === "warning" 
            ? "bg-accent/10 text-accent" 
            : "bg-green-100 text-green-600"
        }`}>
          {badge}
        </span>
      )}
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
};

export default MyPage;
