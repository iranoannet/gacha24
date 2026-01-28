import { ReactNode } from "react";
import DarkThemeSidebar from "./DarkThemeSidebar";
import DarkThemeHeader from "./DarkThemeHeader";
import DarkThemeBottomNav from "./DarkThemeBottomNav";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";

interface DarkThemeLayoutProps {
  children: ReactNode;
  showFooter?: boolean;
  selectedTag?: string;
  onTagChange?: (tag: string | null) => void;
}

/**
 * Dark theme layout with left sidebar for specific tenants (e.g., get24)
 * Inspired by wikibet.com design
 * On mobile: no sidebar, use bottom navigation instead
 */
const DarkThemeLayout = ({ 
  children, 
  showFooter = true,
  selectedTag,
  onTagChange,
}: DarkThemeLayoutProps) => {
  const isMobile = useIsMobile();

  // Mobile layout: no sidebar, bottom nav instead
  if (isMobile) {
    return (
      <div className="min-h-screen flex flex-col dark-theme">
        <DarkThemeHeader />
        <main className="flex-1 bg-[hsl(var(--dark-background))] overflow-x-hidden pb-16">
          {children}
        </main>
        <DarkThemeBottomNav />
      </div>
    );
  }

  // Desktop layout: sidebar
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen flex w-full dark-theme">
        <DarkThemeSidebar
          selectedTag={selectedTag}
          onTagChange={onTagChange}
        />
        <div className="flex-1 flex flex-col min-w-0">
          <DarkThemeHeader />
          <main className="flex-1 bg-[hsl(var(--dark-background))] overflow-x-hidden">
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
