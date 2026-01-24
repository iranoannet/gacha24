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
import { toast } from "sonner";

const MyPage = () => {
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
          className="rounded-xl bg-gradient-to-r from-primary to-gold-dark p-4 mb-6"
        >
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-card/20 flex items-center justify-center">
              <span className="text-2xl">🥉</span>
            </div>
            <div>
              <p className="text-xs text-primary-foreground/80">現在のランク</p>
              <p className="text-lg font-black text-primary-foreground">BEGINNER</p>
              <p className="text-xs text-primary-foreground/80">ランク特典対象外</p>
            </div>
            <ChevronRight className="h-5 w-5 text-primary-foreground ml-auto" />
          </div>
        </motion.div>

        {/* Jackpot Section */}
        <Card className="p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-foreground">ジャックポット</h2>
            <Button variant="link" className="text-primary text-sm p-0 h-auto">
              ポイントウリの仕組み
            </Button>
          </div>
          <ul className="text-xs text-muted-foreground space-y-2">
            <li>• 現金（1口＝6回）にガチャ1回を0.01で計上される。損害のあるポイントをポイント（上下10,000円/月）に変換</li>
            <li>• ポイント獲得率はランクに比例、最大1.2%以上が付与されます</li>
            <li>• ジャックポット利用確定の後、自動的にポイントに変換されます</li>
          </ul>
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
          
          <MenuItem icon={Ticket} label="クーポン利用" />
          <MenuItem icon={ShoppingBag} label="購入履歴" />
          <MenuItem icon={MapPin} label="お届け先の登録" onClick={() => navigate("/mypage/address")} />
          <MenuItem icon={Shield} label="SMS認証" badge="未認証" badgeVariant="warning" />
          <MenuItem icon={User} label="LINE連携" badge="未連携" badgeVariant="warning" />
          <MenuItem icon={Mail} label="メールアドレス変更" />
          <MenuItem icon={Lock} label="パスワード変更" />
          {user && (
            <MenuItem icon={LogOut} label="ログアウト" onClick={handleLogout} />
          )}
        </div>

        <div className="space-y-1 mt-6">
          <h3 className="text-sm font-bold text-foreground mb-2">サポート</h3>
          
          <MenuItem icon={Bell} label="お知らせ" />
          <MenuItem icon={HelpCircle} label="よくある質問/お問い合わせ" />
        </div>

        <div className="space-y-1 mt-6">
          <h3 className="text-sm font-bold text-foreground mb-2">その他</h3>
          
          <MenuItem icon={FileText} label="利用規約" />
          <MenuItem icon={BookOpen} label="プライバシーポリシー" />
          <MenuItem icon={FileText} label="特定商取引法に基づく表記" />
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
