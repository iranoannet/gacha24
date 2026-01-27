import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

interface SuperAdminProtectedRouteProps {
  children: ReactNode;
}

export function SuperAdminProtectedRoute({ children }: SuperAdminProtectedRouteProps) {
  const { user, loading, isSuperAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">読み込み中...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">アクセス権限がありません</h1>
          <p className="text-muted-foreground">スーパー管理者権限が必要です</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
