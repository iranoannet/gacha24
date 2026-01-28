import { ReactNode } from "react";
import Header from "./Header";
import BottomNav from "./BottomNav";
import Footer from "./Footer";
import DarkThemeLayout from "./DarkThemeLayout";
import { useTenant } from "@/hooks/useTenant";
import { useLocation } from "react-router-dom";

interface MainLayoutProps {
  children: ReactNode;
  showFooter?: boolean;
  hideBottomNav?: boolean;
}

// Tenants that use the dark theme with left sidebar
const DARK_THEME_TENANTS = ["get24", "get"];

const MainLayout = ({ children, showFooter = true, hideBottomNav = false }: MainLayoutProps) => {
  const { tenantSlug } = useTenant();
  const location = useLocation();
  
  // Check if this tenant uses the dark theme
  const useDarkTheme = tenantSlug && DARK_THEME_TENANTS.includes(tenantSlug);
  
  // Don't use dark theme for admin routes
  const isAdminRoute = location.pathname.includes("/admin");
  
  if (useDarkTheme && !isAdminRoute) {
    return (
      <DarkThemeLayout showFooter={showFooter}>
        {children}
      </DarkThemeLayout>
    );
  }

  // Default layout
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      {showFooter && <Footer />}
      {!hideBottomNav && <BottomNav />}
    </div>
  );
};

export default MainLayout;
