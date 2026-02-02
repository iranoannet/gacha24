import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "./AdminSidebar";
import { useTenant } from "@/hooks/useTenant";

interface AdminLayoutProps {
  children: React.ReactNode;
  title: string;
}

export function AdminLayout({ children, title }: AdminLayoutProps) {
  const { tenant } = useTenant();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AdminSidebar />
        <main className="flex-1 flex flex-col">
          <header className="h-14 border-b border-border flex items-center px-4 gap-4 bg-card">
            <SidebarTrigger />
            <div className="flex items-center gap-3">
              {tenant && (
                <span className="font-bold text-lg text-primary">{tenant.name}</span>
              )}
              <span className="text-muted-foreground">|</span>
              <h1 className="font-medium text-base">{title}</h1>
            </div>
          </header>
          <div className="flex-1 p-6 overflow-auto">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
