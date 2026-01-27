import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { SuperAdminSidebar } from "./SuperAdminSidebar";

interface SuperAdminLayoutProps {
  children: React.ReactNode;
  title: string;
}

export function SuperAdminLayout({ children, title }: SuperAdminLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <SuperAdminSidebar />
        <main className="flex-1 flex flex-col">
          <header className="h-14 border-b border-border flex items-center px-4 gap-4 bg-gradient-to-r from-purple-900/20 to-background">
            <SidebarTrigger />
            <h1 className="font-bold text-lg">{title}</h1>
            <span className="ml-auto text-xs bg-purple-600 text-white px-2 py-1 rounded">
              SUPER ADMIN
            </span>
          </header>
          <div className="flex-1 p-6 overflow-auto">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
