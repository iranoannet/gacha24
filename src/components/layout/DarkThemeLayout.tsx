import { ReactNode } from "react";
import DarkThemeSidebar from "./DarkThemeSidebar";
import DarkThemeHeader from "./DarkThemeHeader";
import { SidebarProvider } from "@/components/ui/sidebar";

interface DarkThemeLayoutProps {
  children: ReactNode;
  showFooter?: boolean;
}

/**
 * Dark theme layout with left sidebar for specific tenants (e.g., get24)
 * Inspired by wikibet.com design
 */
const DarkThemeLayout = ({ children, showFooter = true }: DarkThemeLayoutProps) => {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full dark-theme">
        <DarkThemeSidebar />
        <div className="flex-1 flex flex-col">
          <DarkThemeHeader />
          <main className="flex-1 bg-[hsl(var(--dark-background))]">
            {children}
          </main>
          {showFooter && (
            <footer className="bg-[hsl(var(--dark-surface))] border-t border-[hsl(var(--dark-border))] py-4">
              <div className="container text-center text-sm text-[hsl(var(--dark-muted))]">
                © 2024 All rights reserved.
              </div>
            </footer>
          )}
        </div>
      </div>
    </SidebarProvider>
  );
};

export default DarkThemeLayout;
