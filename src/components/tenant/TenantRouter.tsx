import { Routes, Route, useParams } from "react-router-dom";
import { TenantLayout } from "./TenantLayout";
import Index from "@/pages/Index";
import GachaDetail from "@/pages/GachaDetail";
import Inventory from "@/pages/Inventory";
import History from "@/pages/History";
import MyPage from "@/pages/MyPage";
import ShippingAddress from "@/pages/ShippingAddress";
import Coupon from "@/pages/mypage/Coupon";
import EmailChange from "@/pages/mypage/EmailChange";
import PasswordChange from "@/pages/mypage/PasswordChange";
import SmsVerification from "@/pages/mypage/SmsVerification";
import LineFriend from "@/pages/mypage/LineFriend";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import LegalNotice from "@/pages/LegalNotice";
import Terms from "@/pages/Terms";
import FAQ from "@/pages/FAQ";
import Notifications from "@/pages/Notifications";
import NotificationDetail from "@/pages/NotificationDetail";
import Points from "@/pages/Points";
import Auth from "@/pages/Auth";
import DarkThemeAuth from "@/pages/DarkThemeAuth";
import Reports from "@/pages/Reports";
import NotFound from "@/pages/NotFound";

// Dark theme pages
import DarkThemeGachaDetail from "@/pages/DarkThemeGachaDetail";
import DarkThemeInventory from "@/pages/DarkThemeInventory";
import DarkThemeHistory from "@/pages/DarkThemeHistory";
import DarkThemeMyPage from "@/pages/DarkThemeMyPage";
import DarkThemePoints from "@/pages/DarkThemePoints";
import DarkThemeCoupon from "@/pages/mypage/DarkThemeCoupon";
import DarkThemeSmsVerification from "@/pages/mypage/DarkThemeSmsVerification";

// Tenants that use dark theme
const DARK_THEME_TENANTS = ["get24", "get"];

// Admin pages
import AdminDashboard from "@/pages/admin/AdminDashboard";
import CardMaster from "@/pages/admin/CardMaster";
import GachaManagement from "@/pages/admin/GachaManagement";
import SlotEditor from "@/pages/admin/SlotEditor";
import ShippingManagement from "@/pages/admin/ShippingManagement";
import PaymentManagement from "@/pages/admin/PaymentManagement";
import UserManagement from "@/pages/admin/UserManagement";
import Analytics from "@/pages/admin/Analytics";
import BannerManagement from "@/pages/admin/BannerManagement";
import { AdminProtectedRoute } from "@/components/admin/AdminProtectedRoute";

/**
 * Routes for tenant-specific pages (under /:tenantSlug/...)
 * These routes are wrapped with TenantLayout for branding
 */
/**
 * Routes for tenant-specific pages (under /:tenantSlug/...)
 * Automatically routes to dark theme pages for get24/get tenants
 */
export function TenantRouter() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const useDarkTheme = tenantSlug && DARK_THEME_TENANTS.includes(tenantSlug);

  return (
    <TenantLayout>
      <Routes>
        {/* User pages - with conditional dark theme routing */}
        <Route path="/" element={<Index />} />
        <Route path="/auth" element={useDarkTheme ? <DarkThemeAuth /> : <Auth />} />
        <Route path="/gacha/:id" element={useDarkTheme ? <DarkThemeGachaDetail /> : <GachaDetail />} />
        <Route path="/inventory" element={useDarkTheme ? <DarkThemeInventory /> : <Inventory />} />
        <Route path="/history" element={useDarkTheme ? <DarkThemeHistory /> : <History />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/mypage" element={useDarkTheme ? <DarkThemeMyPage /> : <MyPage />} />
        <Route path="/mypage/address" element={<ShippingAddress />} />
        <Route path="/mypage/coupon" element={useDarkTheme ? <DarkThemeCoupon /> : <Coupon />} />
        <Route path="/mypage/email" element={<EmailChange />} />
        <Route path="/mypage/password" element={<PasswordChange />} />
        <Route path="/mypage/sms-verification" element={useDarkTheme ? <DarkThemeSmsVerification /> : <SmsVerification />} />
        <Route path="/mypage/line" element={<LineFriend />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/legal" element={<LegalNotice />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/faq" element={<FAQ />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/notifications/:id" element={<NotificationDetail />} />
        <Route path="/points" element={useDarkTheme ? <DarkThemePoints /> : <Points />} />

        {/* Tenant Admin Routes */}
        <Route path="/admin" element={<AdminProtectedRoute><AdminDashboard /></AdminProtectedRoute>} />
        <Route path="/admin/cards" element={<AdminProtectedRoute><CardMaster /></AdminProtectedRoute>} />
        <Route path="/admin/gachas" element={<AdminProtectedRoute><GachaManagement /></AdminProtectedRoute>} />
        <Route path="/admin/slots" element={<AdminProtectedRoute><SlotEditor /></AdminProtectedRoute>} />
        <Route path="/admin/banners" element={<AdminProtectedRoute><BannerManagement /></AdminProtectedRoute>} />
        <Route path="/admin/shipping" element={<AdminProtectedRoute><ShippingManagement /></AdminProtectedRoute>} />
        <Route path="/admin/payments" element={<AdminProtectedRoute><PaymentManagement /></AdminProtectedRoute>} />
        <Route path="/admin/users" element={<AdminProtectedRoute><UserManagement /></AdminProtectedRoute>} />
        <Route path="/admin/analytics" element={<AdminProtectedRoute><Analytics /></AdminProtectedRoute>} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </TenantLayout>
  );
}
