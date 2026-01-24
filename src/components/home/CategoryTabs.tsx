import { useState } from "react";

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
}

const CategoryTabs = ({ onCategoryChange, onTagChange }: CategoryTabsProps) => {
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
    <div className="border-b border-border bg-card">
      {/* Main Categories */}
      <div className="flex overflow-x-auto scrollbar-hide">
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => handleCategoryClick(category.id)}
            className={`flex-shrink-0 px-6 py-3 text-sm font-medium transition-colors relative ${
              activeCategory === category.id
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {category.label}
            {activeCategory === category.id && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
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
            className={`flex-shrink-0 px-3 py-1.5 text-xs rounded-full border transition-colors ${
              activeTag === tag
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border hover:border-primary hover:text-primary"
            }`}
          >
            {tag}
          </button>
        ))}
      </div>
    </div>
  );
};

export default CategoryTabs;
