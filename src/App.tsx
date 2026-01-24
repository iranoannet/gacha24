import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { AdminProtectedRoute } from "@/components/admin/AdminProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import GachaDetail from "./pages/GachaDetail";
import Inventory from "./pages/Inventory";
import History from "./pages/History";
import Reports from "./pages/Reports";
import MyPage from "./pages/MyPage";
import NotFound from "./pages/NotFound";

// Admin pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import CardMaster from "./pages/admin/CardMaster";
import GachaManagement from "./pages/admin/GachaManagement";
import SlotEditor from "./pages/admin/SlotEditor";
import ShippingManagement from "./pages/admin/ShippingManagement";
import UserManagement from "./pages/admin/UserManagement";
import Analytics from "./pages/admin/Analytics";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/gacha/:id" element={<GachaDetail />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/history" element={<History />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/mypage" element={<MyPage />} />
            
            {/* Admin Routes - Protected */}
            <Route path="/admin" element={<AdminProtectedRoute><AdminDashboard /></AdminProtectedRoute>} />
            <Route path="/admin/cards" element={<AdminProtectedRoute><CardMaster /></AdminProtectedRoute>} />
            <Route path="/admin/gachas" element={<AdminProtectedRoute><GachaManagement /></AdminProtectedRoute>} />
            <Route path="/admin/slots" element={<AdminProtectedRoute><SlotEditor /></AdminProtectedRoute>} />
            <Route path="/admin/shipping" element={<AdminProtectedRoute><ShippingManagement /></AdminProtectedRoute>} />
            <Route path="/admin/users" element={<AdminProtectedRoute><UserManagement /></AdminProtectedRoute>} />
            <Route path="/admin/analytics" element={<AdminProtectedRoute><Analytics /></AdminProtectedRoute>} />
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
