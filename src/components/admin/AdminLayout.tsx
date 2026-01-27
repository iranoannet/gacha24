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
            <h1 className="font-bold text-lg">{title}</h1>
            {tenant && (
              <span className="ml-auto text-xs bg-primary/20 text-primary px-2 py-1 rounded">
                {tenant.name}
              </span>
            )}
          </header>
          <div className="flex-1 p-6 overflow-auto">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
