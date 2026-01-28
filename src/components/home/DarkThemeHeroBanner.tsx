import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTenantBanners } from "@/hooks/useTenantData";
import gachaBanner1 from "@/assets/gacha-banner-1.jpg";
import { cn } from "@/lib/utils";

interface Banner {
  id: string;
  image_url: string;
  link_url: string | null;
  title: string | null;
}

const DarkThemeHeroBanner = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const { data: banners } = useTenantBanners();

  // Fallback to default banner if no banners in DB
  const displayBanners: Banner[] = banners?.length
    ? banners
    : [{ id: "default", image_url: gachaBanner1, link_url: null, title: "メインバナー" }];

  useEffect(() => {
    if (displayBanners.length <= 1) return;
    
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % displayBanners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [displayBanners.length]);

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
      initial={{ opacity: 0, scale: 1.05 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.7 }}
      className="absolute inset-0 w-full h-full object-cover"
    />
  );

  return (
    <div className="relative w-full overflow-hidden bg-[hsl(var(--dark-surface))]">
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
        
        {/* Gradient overlay for better text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-[hsl(var(--dark-background)/0.6)] via-transparent to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[hsl(var(--dark-background)/0.3)] via-transparent to-[hsl(var(--dark-background)/0.3)]" />
      </div>

      {/* Navigation Arrows */}
      {displayBanners.length > 1 && (
        <>
          <button
            onClick={goPrev}
            className={cn(
              "absolute left-3 top-1/2 -translate-y-1/2",
              "h-10 w-10 rounded-full flex items-center justify-center",
              "bg-[hsl(var(--dark-surface)/0.8)] backdrop-blur-sm",
              "border border-[hsl(var(--dark-border))]",
              "text-[hsl(var(--dark-foreground))]",
              "hover:bg-[hsl(var(--dark-neon-primary)/0.2)] hover:border-[hsl(var(--dark-neon-primary))]",
              "hover:text-[hsl(var(--dark-neon-primary))]",
              "transition-all shadow-lg"
            )}
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            onClick={goNext}
            className={cn(
              "absolute right-3 top-1/2 -translate-y-1/2",
              "h-10 w-10 rounded-full flex items-center justify-center",
              "bg-[hsl(var(--dark-surface)/0.8)] backdrop-blur-sm",
              "border border-[hsl(var(--dark-border))]",
              "text-[hsl(var(--dark-foreground))]",
              "hover:bg-[hsl(var(--dark-neon-primary)/0.2)] hover:border-[hsl(var(--dark-neon-primary))]",
              "hover:text-[hsl(var(--dark-neon-primary))]",
              "transition-all shadow-lg"
            )}
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}

      {/* Dots with neon effect */}
      {displayBanners.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          {displayBanners.map((_, index) => (
            <button
              key={index}
              onClick={() => goTo(index)}
              className={cn(
                "h-2 rounded-full transition-all duration-300",
                index === currentIndex
                  ? "w-8 bg-[hsl(var(--dark-neon-primary))] shadow-[0_0_10px_hsl(var(--dark-neon-primary)/0.6)]"
                  : "w-2 bg-[hsl(var(--dark-muted)/0.5)] hover:bg-[hsl(var(--dark-muted))]"
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default DarkThemeHeroBanner;
