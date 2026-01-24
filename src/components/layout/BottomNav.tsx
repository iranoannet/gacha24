import { useLocation, useNavigate } from "react-router-dom";
import { Sparkles, Gift, History, MessageSquare, User } from "lucide-react";

const navItems = [
  { path: "/", icon: Sparkles, label: "オリパガチャ" },
  { path: "/inventory", icon: Gift, label: "獲得商品" },
  { path: "/history", icon: History, label: "当選履歴" },
  { path: "/reports", icon: MessageSquare, label: "当選報告" },
  { path: "/mypage", icon: User, label: "マイページ" },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="bottom-nav">
      <div className="grid grid-cols-5 max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`nav-item ${isActive ? "active" : ""}`}
            >
              <Icon className={`h-5 w-5 ${isActive ? "text-primary" : ""}`} />
              <span className={`text-[10px] mt-1 font-medium ${isActive ? "text-primary" : ""}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
