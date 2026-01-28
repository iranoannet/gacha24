import { useState } from "react";
import { cn } from "@/lib/utils";

const categories = [
  { id: "all", label: "すべて" },
  { id: "pokemon", label: "ポケモン" },
  { id: "onepiece", label: "ワンピース" },
  { id: "yugioh", label: "遊戯王" },
  { id: "weiss", label: "ヴァイス" },
];

const tags = [
  "おすすめ順🔥",
  "#初心者向け",
  "#低単価",
  "#高単価",
  "#小口",
  "#1等超豪華",
  "#ミステリー",
  "#最強保証",
];

interface CategoryTabsProps {
  onCategoryChange?: (category: string) => void;
  onTagChange?: (tag: string) => void;
  isDarkTheme?: boolean;
}

const CategoryTabs = ({ onCategoryChange, onTagChange, isDarkTheme = false }: CategoryTabsProps) => {
  const [activeCategory, setActiveCategory] = useState("all");
  const [activeTag, setActiveTag] = useState("おすすめ順🔥");

  const handleCategoryClick = (categoryId: string) => {
    setActiveCategory(categoryId);
    onCategoryChange?.(categoryId);
  };

  const handleTagClick = (tag: string) => {
    setActiveTag(tag);
    onTagChange?.(tag);
  };

  return (
    <div className={cn(
      "border-b",
      isDarkTheme 
        ? "border-[hsl(var(--dark-border))] bg-[hsl(var(--dark-surface))]"
        : "border-border bg-card"
    )}>
      {/* Main Categories */}
      <div className="flex overflow-x-auto scrollbar-hide">
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => handleCategoryClick(category.id)}
            className={cn(
              "flex-shrink-0 px-6 py-3 text-sm font-medium transition-colors relative",
              activeCategory === category.id
                ? isDarkTheme 
                  ? "text-[hsl(var(--dark-neon-primary))]"
                  : "text-primary"
                : isDarkTheme
                  ? "text-[hsl(var(--dark-muted))] hover:text-[hsl(var(--dark-foreground))]"
                  : "text-muted-foreground hover:text-foreground"
            )}
          >
            {category.label}
            {activeCategory === category.id && (
              <span className={cn(
                "absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full",
                isDarkTheme 
                  ? "bg-[hsl(var(--dark-neon-primary))] shadow-[0_0_8px_hsl(var(--dark-neon-primary)/0.6)]"
                  : "bg-primary"
              )} />
            )}
          </button>
        ))}
      </div>

      {/* Tags */}
      <div className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-hide">
        {tags.map((tag) => (
          <button
            key={tag}
            onClick={() => handleTagClick(tag)}
            className={cn(
              "flex-shrink-0 px-3 py-1.5 text-xs rounded-full border transition-colors",
              activeTag === tag
                ? isDarkTheme
                  ? "bg-[hsl(var(--dark-neon-primary))] text-[hsl(var(--dark-background))] border-[hsl(var(--dark-neon-primary))] shadow-[0_0_10px_hsl(var(--dark-neon-primary)/0.4)]"
                  : "bg-primary text-primary-foreground border-primary"
                : isDarkTheme
                  ? "bg-[hsl(var(--dark-surface-elevated))] text-[hsl(var(--dark-muted))] border-[hsl(var(--dark-border))] hover:border-[hsl(var(--dark-neon-primary))] hover:text-[hsl(var(--dark-neon-primary))]"
                  : "bg-card text-muted-foreground border-border hover:border-primary hover:text-primary"
            )}
          >
            {tag}
          </button>
        ))}
      </div>
    </div>
  );
};

export default CategoryTabs;
