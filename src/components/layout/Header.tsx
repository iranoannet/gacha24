import { Bell, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

const Header = () => {
  return (
    <header className="sticky top-0 z-40 bg-card border-b border-border">
      <div className="container flex items-center justify-between h-14 px-4">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-black text-gradient-gold">
            トレカガチャ
          </h1>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
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
        </div>
      </div>
    </header>
  );
};

export default Header;
