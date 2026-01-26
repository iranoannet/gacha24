import { useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import HeroBanner from "@/components/home/HeroBanner";
import CategoryTabs from "@/components/home/CategoryTabs";
import GachaCard from "@/components/gacha/GachaCard";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

const Index = () => {
  const [selectedCategory, setSelectedCategory] = useState("all");

  const { data: gachaList, isLoading } = useQuery({
    queryKey: ["gachas-public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gacha_masters")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

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
      <HeroBanner />

      {/* Category Tabs */}
      <CategoryTabs onCategoryChange={handleCategoryChange} />

      {/* Featured Section */}
      <div className="bg-gradient-to-b from-accent/10 to-transparent py-4">
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
