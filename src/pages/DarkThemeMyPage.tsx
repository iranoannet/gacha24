import { useNavigate } from "react-router-dom";
import DarkThemeLayout from "@/components/layout/DarkThemeLayout";
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
  BookOpen,
  Trophy,
  Zap
} from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const DarkThemeMyPage = () => {
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();
  const { tenantSlug } = useTenant();
  const basePath = tenantSlug ? `/${tenantSlug}` : "";

  const handleLogout = async () => {
    await signOut();
    toast.success("Logged out successfully");
    navigate(`${basePath}/`);
  };

  const handleUserCardClick = () => {
    if (!user) {
      navigate(`${basePath}/auth`);
    }
  };

  return (
    <DarkThemeLayout>
      <div className="container px-4 py-6 max-w-2xl mx-auto">
        <h1 className="text-xl font-bold mb-4 text-[hsl(var(--dark-foreground))]">My Page</h1>

        {/* User Profile Card */}
        <Card 
          className={cn(
            "p-4 mb-4 cursor-pointer transition-colors",
            "bg-[hsl(var(--dark-surface-elevated))]",
            "border-[hsl(var(--dark-border))]",
            "hover:bg-[hsl(var(--dark-surface))]"
          )}
          onClick={handleUserCardClick}
        >
          <div className="flex items-center gap-3">
            <div className={cn(
              "h-12 w-12 rounded-full flex items-center justify-center",
              "bg-[hsl(var(--dark-neon-primary)/0.2)]",
              "border border-[hsl(var(--dark-neon-primary)/0.5)]"
            )}>
              <User className="h-6 w-6 text-[hsl(var(--dark-neon-primary))]" />
            </div>
            <div className="flex-1">
              {loading ? (
                <p className="text-sm text-[hsl(var(--dark-muted))]">Loading...</p>
              ) : user ? (
                <>
                  <p className="font-medium text-[hsl(var(--dark-foreground))]">{user.email}</p>
                  <p className="text-xs text-[hsl(var(--dark-neon-secondary))]">Logged in</p>
                </>
              ) : (
                <>
                  <p className="font-medium text-[hsl(var(--dark-foreground))]">Guest User</p>
                  <p className="text-xs text-[hsl(var(--dark-muted))]">Please log in</p>
                </>
              )}
            </div>
            <ChevronRight className="h-5 w-5 text-[hsl(var(--dark-muted))]" />
          </div>
        </Card>

        {/* Rank Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          {/* Rank Banner */}
          <div className={cn(
            "rounded-t-2xl p-5 relative overflow-hidden",
            "bg-gradient-to-r from-[hsl(var(--dark-neon-gold))] via-[hsl(var(--dark-neon-primary))] to-[hsl(var(--dark-neon-gold))]"
          )}>
            <div className="flex items-center gap-4">
              <div className={cn(
                "h-16 w-16 rounded-full flex items-center justify-center",
                "bg-white/20 backdrop-blur-sm border-2 border-white/30 shadow-lg"
              )}>
                <Trophy className="h-8 w-8 text-white" />
              </div>
              <div>
                <p className="text-xs text-white/80 font-medium">Current Rank</p>
                <p className="text-2xl font-black text-white tracking-wide">BEGINNER</p>
                <p className="text-xs text-white/70">Coin Return Rate: 0.0%</p>
              </div>
            </div>
          </div>
          
          {/* Rank Points Progress */}
          <Card className={cn(
            "rounded-t-none rounded-b-2xl border-t-0",
            "bg-[hsl(var(--dark-surface-elevated))]",
            "border-[hsl(var(--dark-border))]"
          )}>
            <div className="p-4">
              <p className="text-sm font-bold text-[hsl(var(--dark-foreground))] mb-3">Rank Points</p>
              <div className="w-full bg-[hsl(var(--dark-input))] rounded-full h-2 mb-2 overflow-hidden">
                <div 
                  className="h-2 rounded-full bg-gradient-to-r from-[hsl(var(--dark-neon-primary))] to-[hsl(var(--dark-neon-secondary))]" 
                  style={{ width: '0%' }}
                />
              </div>
              <p className="text-right text-xs text-[hsl(var(--dark-muted))]">
                Next rank in <span className="text-lg font-bold text-[hsl(var(--dark-neon-gold))]">100,000</span> pt
              </p>
            </div>
          </Card>
        </motion.div>

        {/* Rank Info Section */}
        <Card className={cn(
          "p-4 mb-6",
          "bg-[hsl(var(--dark-surface-elevated))]",
          "border-[hsl(var(--dark-border))]"
        )}>
          <div className="space-y-4 text-sm">
            <div>
              <h3 className="font-bold text-[hsl(var(--dark-foreground))] mb-2 flex items-center gap-2">
                <Zap className="h-4 w-4 text-[hsl(var(--dark-neon-primary))]" />
                About Ranks
              </h3>
              <p className="text-[hsl(var(--dark-muted))] text-xs leading-relaxed">
                Earn higher coin return rates, rank-up bonuses, and exclusive gacha access! 
                There are 7 rank levels based on your total rank points.
              </p>
            </div>
            <div>
              <h3 className="font-bold text-[hsl(var(--dark-foreground))] mb-2">■ Earning Rank Points</h3>
              <p className="text-[hsl(var(--dark-muted))] text-xs">
                Earn 1 rank point for every 1 coin purchased.
              </p>
            </div>
            <div>
              <h3 className="font-bold text-[hsl(var(--dark-foreground))] mb-2">■ Rank Up Conditions</h3>
              <p className="text-[hsl(var(--dark-muted))] text-xs">
                Reach the required rank points to advance to the next level.
              </p>
            </div>
          </div>
        </Card>

        {/* Referral Code */}
        <Card className={cn(
          "p-4 mb-6",
          "bg-[hsl(var(--dark-surface-elevated))]",
          "border-2 border-[hsl(var(--dark-neon-primary))]"
        )}>
          <div className="flex items-center gap-2 mb-2">
            <Ticket className="h-4 w-4 text-[hsl(var(--dark-neon-primary))]" />
            <span className="text-sm font-bold text-[hsl(var(--dark-neon-primary))]">Referral Code</span>
          </div>
          <p className="text-xs text-[hsl(var(--dark-muted))] mb-2">
            Share with friends to earn rewards!
          </p>
          <div className={cn(
            "rounded-lg p-3 text-sm font-mono",
            "bg-[hsl(var(--dark-surface))]",
            "text-[hsl(var(--dark-foreground))]"
          )}>
            【Limited Time】Friend Referral Campaign Active!
          </div>
        </Card>

        {/* Menu List */}
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-[hsl(var(--dark-foreground))] mb-2">Account</h3>
          
          <MenuItem icon={Ticket} label="Use Coupon" onClick={() => navigate(`${basePath}/mypage/coupon`)} />
          <MenuItem icon={ShoppingBag} label="Purchase History" onClick={() => navigate(`${basePath}/history`)} />
          <MenuItem icon={MapPin} label="Shipping Address" onClick={() => navigate(`${basePath}/mypage/address`)} />
          <MenuItem icon={Shield} label="SMS Verification" badge="Unverified" badgeVariant="warning" onClick={() => navigate(`${basePath}/mypage/sms-verification`)} />
          <MenuItem icon={User} label="LINE Connection" badge="Not Connected" badgeVariant="warning" onClick={() => navigate(`${basePath}/mypage/line`)} />
          <MenuItem icon={Mail} label="Change Email" onClick={() => navigate(`${basePath}/mypage/email`)} />
          <MenuItem icon={Lock} label="Change Password" onClick={() => navigate(`${basePath}/mypage/password`)} />
          {user && (
            <MenuItem icon={LogOut} label="Logout" onClick={handleLogout} />
          )}
        </div>

        <div className="space-y-1 mt-6">
          <h3 className="text-sm font-bold text-[hsl(var(--dark-foreground))] mb-2">Support</h3>
          
          <MenuItem icon={Bell} label="Notifications" onClick={() => navigate(`${basePath}/notifications`)} />
          <MenuItem icon={HelpCircle} label="FAQ / Contact" onClick={() => navigate(`${basePath}/faq`)} />
        </div>

        <div className="space-y-1 mt-6">
          <h3 className="text-sm font-bold text-[hsl(var(--dark-foreground))] mb-2">Other</h3>
          
          <MenuItem icon={FileText} label="Terms of Service" onClick={() => navigate(`${basePath}/terms`)} />
          <MenuItem icon={BookOpen} label="Privacy Policy" onClick={() => navigate(`${basePath}/privacy`)} />
          <MenuItem icon={FileText} label="Legal Notice" onClick={() => navigate(`${basePath}/legal`)} />
        </div>
      </div>
    </DarkThemeLayout>
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
      className={cn(
        "w-full flex items-center gap-3 p-3 rounded-lg transition-colors",
        "hover:bg-[hsl(var(--dark-surface-elevated))]"
      )}
      onClick={onClick}
    >
      <Icon className="h-4 w-4 text-[hsl(var(--dark-muted))]" />
      <span className="flex-1 text-sm text-[hsl(var(--dark-foreground))] text-left">{label}</span>
      {badge && (
        <span className={cn(
          "text-xs px-2 py-0.5 rounded-full",
          badgeVariant === "warning" 
            ? "bg-[hsl(var(--dark-neon-accent)/0.2)] text-[hsl(var(--dark-neon-accent))]" 
            : "bg-[hsl(var(--dark-neon-secondary)/0.2)] text-[hsl(var(--dark-neon-secondary))]"
        )}>
          {badge}
        </span>
      )}
      <ChevronRight className="h-4 w-4 text-[hsl(var(--dark-muted))]" />
    </button>
  );
};

export default DarkThemeMyPage;
