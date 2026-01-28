import { useLocation, useNavigate } from "react-router-dom";
import { Sparkles, Gift, History, MessageSquare, User, CreditCard, HelpCircle, ChevronLeft, ChevronRight, Flame, Clock } from "lucide-react";
import { useTenant } from "@/hooks/useTenant";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

// Categories with images
const categories = [
  { 
    id: "all", 
    label: "All", 
    image: "https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=100&h=100&fit=crop"
  },
  { 
    id: "pokemon", 
    label: "Pokemon", 
    image: "https://images.unsplash.com/photo-1613771404784-3a5686aa2be3?w=100&h=100&fit=crop"
  },
  { 
    id: "yugioh", 
    label: "Yu-Gi-Oh!", 
    image: "https://images.unsplash.com/photo-1642755017878-ebbb17016711?w=100&h=100&fit=crop"
  },
  { 
    id: "onepiece", 
    label: "One Piece", 
    image: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=100&h=100&fit=crop"
  },
  { 
    id: "weiss", 
    label: "Weiss", 
    image: "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=100&h=100&fit=crop"
  },
];

// Display tags for filtering
const displayTags = [
  { id: "new_arrivals", label: "New Arrivals", icon: Clock },
  { id: "hot_items", label: "Hot Items", icon: Flame },
];

const accountNavItems = [
  { path: "/inventory", icon: Gift, label: "Inventory" },
  { path: "/history", icon: History, label: "History" },
  { path: "/reports", icon: MessageSquare, label: "Reports" },
  { path: "/mypage", icon: User, label: "My Page" },
  { path: "/points", icon: CreditCard, label: "Buy Points" },
  { path: "/faq", icon: HelpCircle, label: "FAQ" },
];

interface DarkThemeSidebarProps {
  selectedCategory?: string;
  selectedTag?: string;
  onCategoryChange?: (category: string) => void;
  onTagChange?: (tag: string | null) => void;
}

const DarkThemeSidebar = ({ 
  selectedCategory = "all",
  selectedTag,
  onCategoryChange,
  onTagChange,
}: DarkThemeSidebarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { tenant, tenantSlug } = useTenant();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const basePath = tenantSlug ? `/${tenantSlug}` : "";

  const isActive = (path: string) => {
    const fullPath = basePath + path;
    if (path === "/") {
      return location.pathname === basePath || location.pathname === basePath + "/";
    }
    return location.pathname.startsWith(fullPath);
  };

  const handleNavigation = (path: string) => {
    navigate(basePath + path);
  };

  const handleCategoryClick = (categoryId: string) => {
    onCategoryChange?.(categoryId);
    // Navigate to home if not already there
    if (!isActive("/")) {
      handleNavigation("/");
    }
  };

  const handleTagClick = (tagId: string) => {
    // Toggle tag selection
    if (selectedTag === tagId) {
      onTagChange?.(null);
    } else {
      onTagChange?.(tagId);
    }
    // Navigate to home if not already there
    if (!isActive("/")) {
      handleNavigation("/");
    }
  };

  return (
    <Sidebar
      className={cn(
        "border-r border-[hsl(var(--dark-border))] bg-[hsl(var(--dark-surface))]",
        collapsed ? "w-16" : "w-72"
      )}
      collapsible="icon"
    >
      {/* Logo Area */}
      <div className="p-4 border-b border-[hsl(var(--dark-border))]">
        <button
          onClick={() => handleNavigation("/")}
          className="flex items-center gap-3 w-full"
        >
          {tenant?.logo_url ? (
            <img 
              src={tenant.logo_url} 
              alt={tenant.name} 
              className="h-8 w-8 rounded object-contain"
            />
          ) : (
            <div className="h-8 w-8 rounded bg-gradient-to-br from-[hsl(var(--dark-neon-primary))] to-[hsl(var(--dark-neon-secondary))] flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
          )}
          {!collapsed && (
            <span className="text-lg font-bold text-[hsl(var(--dark-foreground))] truncate">
              {tenant?.name || "Gacha"}
            </span>
          )}
        </button>
      </div>

      <SidebarContent className="bg-[hsl(var(--dark-surface))]">
        {/* Categories Section - Horizontal Image Cards */}
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-[hsl(var(--dark-muted))] text-xs uppercase tracking-wider px-3 mb-2">
              Categories
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            {!collapsed ? (
              <div className="px-3 overflow-x-auto scrollbar-hide">
                <div className="flex gap-2 pb-2">
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      onClick={() => handleCategoryClick(category.id)}
                      className={cn(
                        "flex-shrink-0 flex flex-col items-center gap-1.5 p-2 rounded-lg transition-all",
                        "min-w-[60px] w-[60px]",
                        selectedCategory === category.id && isActive("/")
                          ? "bg-[hsl(var(--dark-neon-primary)/0.2)] ring-2 ring-[hsl(var(--dark-neon-primary))]"
                          : "bg-[hsl(var(--dark-surface-elevated))] hover:bg-[hsl(var(--dark-hover))]"
                      )}
                    >
                      <div className={cn(
                        "w-10 h-10 rounded-lg overflow-hidden",
                        selectedCategory === category.id && isActive("/") && "shadow-[0_0_10px_hsl(var(--dark-neon-primary)/0.5)]"
                      )}>
                        <img 
                          src={category.image} 
                          alt={category.label}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <span className={cn(
                        "text-[10px] font-medium text-center leading-tight",
                        selectedCategory === category.id && isActive("/")
                          ? "text-[hsl(var(--dark-neon-primary))]"
                          : "text-[hsl(var(--dark-foreground))]"
                      )}>
                        {category.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <SidebarMenu>
                {categories.map((category) => (
                  <SidebarMenuItem key={category.id}>
                    <SidebarMenuButton
                      onClick={() => handleCategoryClick(category.id)}
                      className={cn(
                        "w-full flex items-center justify-center p-2 rounded-lg transition-all",
                        selectedCategory === category.id && isActive("/")
                          ? "bg-[hsl(var(--dark-neon-primary)/0.15)] ring-1 ring-[hsl(var(--dark-neon-primary))]"
                          : "hover:bg-[hsl(var(--dark-hover))]"
                      )}
                    >
                      <div className="w-8 h-8 rounded overflow-hidden">
                        <img 
                          src={category.image} 
                          alt={category.label}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Tags Section */}
        <SidebarGroup className="mt-4">
          {!collapsed && (
            <SidebarGroupLabel className="text-[hsl(var(--dark-muted))] text-xs uppercase tracking-wider px-3">
              Tags
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {displayTags.map((tag) => (
                <SidebarMenuItem key={tag.id}>
                  <SidebarMenuButton
                    onClick={() => handleTagClick(tag.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all",
                      selectedTag === tag.id
                        ? "bg-[hsl(var(--dark-neon-accent)/0.15)] text-[hsl(var(--dark-neon-accent))] border-l-2 border-[hsl(var(--dark-neon-accent))]"
                        : "text-[hsl(var(--dark-foreground))] hover:bg-[hsl(var(--dark-hover))] hover:text-[hsl(var(--dark-neon-accent))]"
                    )}
                  >
                    <tag.icon className={cn(
                      "h-5 w-5 flex-shrink-0",
                      selectedTag === tag.id && "drop-shadow-[0_0_8px_hsl(var(--dark-neon-accent))]"
                    )} />
                    {!collapsed && <span className="font-medium">{tag.label}</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Account Navigation */}
        <SidebarGroup className="mt-4">
          {!collapsed && (
            <SidebarGroupLabel className="text-[hsl(var(--dark-muted))] text-xs uppercase tracking-wider px-3">
              Account
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {accountNavItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    onClick={() => handleNavigation(item.path)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all",
                      isActive(item.path)
                        ? "bg-[hsl(var(--dark-neon-primary)/0.15)] text-[hsl(var(--dark-neon-primary))] border-l-2 border-[hsl(var(--dark-neon-primary))]"
                        : "text-[hsl(var(--dark-foreground))] hover:bg-[hsl(var(--dark-hover))] hover:text-[hsl(var(--dark-neon-primary))]"
                    )}
                  >
                    <item.icon className={cn(
                      "h-5 w-5 flex-shrink-0",
                      isActive(item.path) && "drop-shadow-[0_0_8px_hsl(var(--dark-neon-primary))]"
                    )} />
                    {!collapsed && <span className="font-medium">{item.label}</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Collapse Toggle */}
      <div className="mt-auto p-2 border-t border-[hsl(var(--dark-border))]">
        <SidebarTrigger className="w-full flex items-center justify-center p-2 rounded-lg text-[hsl(var(--dark-muted))] hover:bg-[hsl(var(--dark-hover))] hover:text-[hsl(var(--dark-foreground))] transition-colors">
          {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </SidebarTrigger>
      </div>
    </Sidebar>
  );
};

export default DarkThemeSidebar;
