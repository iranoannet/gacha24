import { ReactNode, useState, useEffect } from "react";
import DarkThemeSidebar from "./DarkThemeSidebar";
import DarkThemeHeader from "./DarkThemeHeader";
import DarkThemeBottomNav from "./DarkThemeBottomNav";
import { SidebarProvider } from "@/components/ui/sidebar";

interface DarkThemeLayoutProps {
  children: ReactNode;
  showFooter?: boolean;
  selectedTag?: string;
  onTagChange?: (tag: string | null) => void;
}

const MOBILE_BREAKPOINT = 768;

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
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Show loading state while determining layout to prevent flash
  if (isMobile === null) {
    return (
      <div className="min-h-screen bg-[hsl(var(--dark-background))] dark-theme" />
    );
  }

  // Mobile layout: no sidebar, bottom nav instead
  if (isMobile) {
    return (
      <div className="min-h-screen flex flex-col dark-theme bg-[hsl(var(--dark-background))]">
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
