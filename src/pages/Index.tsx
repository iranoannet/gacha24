import { useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import HeroBanner from "@/components/home/HeroBanner";
import DarkThemeHeroBanner from "@/components/home/DarkThemeHeroBanner";
import CategoryTabs from "@/components/home/CategoryTabs";
import GachaCard from "@/components/gacha/GachaCard";
import DarkThemeGachaCard from "@/components/gacha/DarkThemeGachaCard";
import DarkThemeLayout from "@/components/layout/DarkThemeLayout";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { useTenantGachas } from "@/hooks/useTenantData";
import { useTenant } from "@/hooks/useTenant";
import { cn } from "@/lib/utils";

// Tenants that use the dark theme
const DARK_THEME_TENANTS = ["get24", "get"];

const Index = () => {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const { tenant, tenantSlug } = useTenant();
  const { data: gachaList, isLoading } = useTenantGachas("active");

  const useDarkTheme = tenantSlug && DARK_THEME_TENANTS.includes(tenantSlug);

  // カテゴリとタグでフィルタリング & SOLD OUTを最後尾にソート
  const filteredGachaList = gachaList
    ?.filter((gacha) => {
      if (selectedCategory !== "all" && (gacha as any).category !== selectedCategory) {
        return false;
      }
      // Tag filter (dark theme only)
      if (selectedTag) {
        const displayTags = (gacha as any).display_tags || [];
        if (!displayTags.includes(selectedTag)) {
          return false;
        }
      }
      return true;
    })
    ?.sort((a, b) => {
      // SOLD OUT (remaining_slots === 0) を最後尾に
      const aIsSoldOut = a.remaining_slots === 0 ? 1 : 0;
      const bIsSoldOut = b.remaining_slots === 0 ? 1 : 0;
      return aIsSoldOut - bIsSoldOut;
    });

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
  };

  const handleTagChange = (tag: string | null) => {
    setSelectedTag(tag);
  };

  // Get section title for dark theme
  const getSectionTitle = () => {
    if (selectedTag === "new_arrivals") return "New Arrivals";
    if (selectedTag === "hot_items") return "Hot Items 🔥";
    if (selectedCategory === "all") return "All Gacha";
    const categoryLabels: Record<string, string> = {
      pokemon: "Pokemon",
      yugioh: "Yu-Gi-Oh!",
      onepiece: "One Piece",
      weiss: "Weiss Schwarz",
    };
    return categoryLabels[selectedCategory] || "Gacha";
  };

  // Dark theme layout for get24/get tenants
  if (useDarkTheme) {
    return (
      <DarkThemeLayout
        selectedCategory={selectedCategory}
        selectedTag={selectedTag ?? undefined}
        onCategoryChange={handleCategoryChange}
        onTagChange={handleTagChange}
      >
        {/* Hero Banner */}
        <DarkThemeHeroBanner />

        {/* Section Header */}
        <div className="bg-[hsl(var(--dark-background))] pt-6 pb-4">
          <div className="container px-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-[hsl(var(--dark-foreground))]">
                {getSectionTitle()}
              </h2>
              <span className="text-sm text-[hsl(var(--dark-muted))]">
                {filteredGachaList?.length || 0} items
              </span>
            </div>
          </div>
        </div>

        {/* Gacha Grid */}
        <section className="container px-4 py-4 bg-[hsl(var(--dark-background))]">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <Skeleton 
                  key={i} 
                  className="h-64 w-full rounded-lg bg-[hsl(var(--dark-surface-elevated))]"
                />
              ))}
            </div>
          ) : filteredGachaList && filteredGachaList.length > 0 ? (
            <motion.div 
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
              initial="hidden"
              animate="visible"
              variants={{
                hidden: {},
                visible: {
                  transition: {
                    staggerChildren: 0.05,
                  },
                },
              }}
            >
              {filteredGachaList.map((gacha) => (
                <DarkThemeGachaCard
                  key={gacha.id}
                  id={gacha.id}
                  title={gacha.title}
                  imageUrl={gacha.banner_url || "/placeholder.svg"}
                  pricePerPlay={gacha.price_per_play}
                  totalSlots={gacha.total_slots}
                  remainingSlots={gacha.remaining_slots}
                  displayTags={(gacha as any).display_tags}
                />
              ))}
            </motion.div>
          ) : (
            <div className="text-center py-12 text-[hsl(var(--dark-muted))]">
              {selectedTag 
                ? "No items found with this tag" 
                : selectedCategory === "all" 
                  ? "No active gacha available" 
                  : "No gacha in this category"}
            </div>
          )}
        </section>
      </DarkThemeLayout>
    );
  }

  // Default light theme layout
  return (
    <MainLayout>
      {/* Hero Banner */}
      <HeroBanner />

      {/* Category Tabs */}
      <CategoryTabs onCategoryChange={handleCategoryChange} isDarkTheme={false} />

      {/* Featured Section */}
      <div className="py-4 bg-gradient-to-b from-accent/10 to-transparent">
        <div className="container px-4">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">⚠️</span>
            <span className="text-sm font-bold text-accent">
              登録後限定！今だけ引ける超お得なオリパ
            </span>
            <span className="text-lg">⚠️</span>
          </div>
        </div>
      </div>

      {/* Gacha Grid */}
      <section className="container px-4 py-6">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-64 w-full rounded-lg" />
            ))}
          </div>
        ) : filteredGachaList && filteredGachaList.length > 0 ? (
          <motion.div 
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: {
                transition: {
                  staggerChildren: 0.1,
                },
              },
            }}
          >
            {filteredGachaList.map((gacha) => (
              <GachaCard
                key={gacha.id}
                id={gacha.id}
                title={gacha.title}
                imageUrl={gacha.banner_url || "/placeholder.svg"}
                pricePerPlay={gacha.price_per_play}
                totalSlots={gacha.total_slots}
                remainingSlots={gacha.remaining_slots}
                borderColor="gold"
              />
            ))}
          </motion.div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            {selectedCategory === "all" 
              ? "現在公開中のガチャはありません" 
              : "このカテゴリのガチャはありません"}
          </div>
        )}
      </section>
    </MainLayout>
  );
};

export default Index;
