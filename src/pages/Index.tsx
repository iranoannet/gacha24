import { useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import HeroBanner from "@/components/home/HeroBanner";
import DarkThemeHeroBanner from "@/components/home/DarkThemeHeroBanner";
import CategoryTabs from "@/components/home/CategoryTabs";
import GachaCard from "@/components/gacha/GachaCard";
import DarkThemeGachaCard from "@/components/gacha/DarkThemeGachaCard";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { useTenantGachas } from "@/hooks/useTenantData";
import { useTenant } from "@/hooks/useTenant";
import { cn } from "@/lib/utils";

// Tenants that use the dark theme
const DARK_THEME_TENANTS = ["get24", "get"];

const Index = () => {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const { tenant, tenantSlug } = useTenant();
  const { data: gachaList, isLoading } = useTenantGachas("active");

  const useDarkTheme = tenantSlug && DARK_THEME_TENANTS.includes(tenantSlug);

  // カテゴリでフィルタリング & SOLD OUTを最後尾にソート
  const filteredGachaList = gachaList
    ?.filter((gacha) => {
      if (selectedCategory === "all") return true;
      return (gacha as any).category === selectedCategory;
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

  return (
    <MainLayout>
      {/* Hero Banner */}
      {useDarkTheme ? <DarkThemeHeroBanner /> : <HeroBanner />}

      {/* Category Tabs */}
      <div className={useDarkTheme ? "bg-[hsl(var(--dark-background))]" : ""}>
        <CategoryTabs onCategoryChange={handleCategoryChange} isDarkTheme={useDarkTheme} />
      </div>

      {/* Featured Section */}
      <div className={cn(
        "py-4",
        useDarkTheme 
          ? "bg-[hsl(var(--dark-background))]"
          : "bg-gradient-to-b from-accent/10 to-transparent"
      )}>
        <div className="container px-4">
          <div className={cn(
            "flex items-center gap-2 mb-4",
            useDarkTheme && "p-3 rounded-lg bg-[hsl(var(--dark-neon-accent)/0.1)] border border-[hsl(var(--dark-neon-accent)/0.3)]"
          )}>
            <span className="text-lg">⚠️</span>
            <span className={cn(
              "text-sm font-bold",
              useDarkTheme 
                ? "text-[hsl(var(--dark-neon-accent))]"
                : "text-accent"
            )}>
              登録後限定！今だけ引ける超お得なオリパ
            </span>
            <span className="text-lg">⚠️</span>
          </div>
        </div>
      </div>

      {/* Gacha Grid */}
      <section className={cn(
        "container px-4 py-6",
        useDarkTheme && "bg-[hsl(var(--dark-background))]"
      )}>
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton 
                key={i} 
                className={cn(
                  "h-64 w-full rounded-lg",
                  useDarkTheme && "bg-[hsl(var(--dark-surface-elevated))]"
                )} 
              />
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
              useDarkTheme ? (
                <DarkThemeGachaCard
                  key={gacha.id}
                  id={gacha.id}
                  title={gacha.title}
                  imageUrl={gacha.banner_url || "/placeholder.svg"}
                  pricePerPlay={gacha.price_per_play}
                  totalSlots={gacha.total_slots}
                  remainingSlots={gacha.remaining_slots}
                />
              ) : (
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
              )
            ))}
          </motion.div>
        ) : (
          <div className={cn(
            "text-center py-12",
            useDarkTheme 
              ? "text-[hsl(var(--dark-muted))]"
              : "text-muted-foreground"
          )}>
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
