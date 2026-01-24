import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import gachaBanner1 from "@/assets/gacha-banner-1.jpg";

interface Banner {
  id: string;
  image_url: string;
  link_url: string | null;
  title: string | null;
}

const HeroBanner = () => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const { data: banners } = useQuery({
    queryKey: ["active-hero-banners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hero_banners")
        .select("id, image_url, link_url, title")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (error) throw error;
      return data as Banner[];
    },
  });

  // Fallback to default banner if no banners in DB
  const displayBanners: Banner[] = banners?.length
    ? banners
    : [{ id: "default", image_url: gachaBanner1, link_url: null, title: "トレカガチャ メインバナー" }];

  useEffect(() => {
    if (displayBanners.length <= 1) return;
    
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % displayBanners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [displayBanners.length]);

  // Reset index if banners change
  useEffect(() => {
    setCurrentIndex(0);
  }, [banners?.length]);

  const goTo = (index: number) => {
    setCurrentIndex(index);
  };

  const goNext = () => {
    setCurrentIndex((prev) => (prev + 1) % displayBanners.length);
  };

  const goPrev = () => {
    setCurrentIndex((prev) => (prev - 1 + displayBanners.length) % displayBanners.length);
  };

  const currentBanner = displayBanners[currentIndex];

  const BannerImage = () => (
    <motion.img
      key={currentBanner.id}
      src={currentBanner.image_url}
      alt={currentBanner.title || "Banner"}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="absolute inset-0 w-full h-full object-cover"
    />
  );

  return (
    <div className="relative w-full overflow-hidden bg-foreground/5">
      {/* Banner Container */}
      <div className="relative aspect-[21/9] md:aspect-[3/1]">
        <AnimatePresence mode="wait">
          {currentBanner.link_url ? (
            <a href={currentBanner.link_url} className="block absolute inset-0">
              <BannerImage />
            </a>
          ) : (
            <BannerImage />
          )}
        </AnimatePresence>
      </div>

      {/* Navigation Arrows */}
      {displayBanners.length > 1 && (
        <>
          <button
            onClick={goPrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-card/80 backdrop-blur flex items-center justify-center shadow-lg hover:bg-card transition-colors"
          >
            <ChevronLeft className="h-6 w-6 text-foreground" />
          </button>
          <button
            onClick={goNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-card/80 backdrop-blur flex items-center justify-center shadow-lg hover:bg-card transition-colors"
          >
            <ChevronRight className="h-6 w-6 text-foreground" />
          </button>
        </>
      )}

      {/* Dots */}
      {displayBanners.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
          {displayBanners.map((_, index) => (
            <button
              key={index}
              onClick={() => goTo(index)}
              className={`h-2 rounded-full transition-all ${
                index === currentIndex
                  ? "w-6 bg-primary"
                  : "w-2 bg-card/60"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default HeroBanner;
