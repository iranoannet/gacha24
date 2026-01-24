import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import gachaBanner1 from "@/assets/gacha-banner-1.jpg";

const banners = [
  {
    id: 1,
    image: gachaBanner1,
    link: "#",
    alt: "トレカガチャ メインバナー",
  },
];

const HeroBanner = () => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const goTo = (index: number) => {
    setCurrentIndex(index);
  };

  const goNext = () => {
    setCurrentIndex((prev) => (prev + 1) % banners.length);
  };

  const goPrev = () => {
    setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length);
  };

  return (
    <div className="relative w-full overflow-hidden bg-foreground/5">
      {/* Banner Container */}
      <div className="relative aspect-[21/9] md:aspect-[3/1]">
        <AnimatePresence mode="wait">
          <motion.img
            key={banners[currentIndex].id}
            src={banners[currentIndex].image}
            alt={banners[currentIndex].alt}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 w-full h-full object-cover"
          />
        </AnimatePresence>
      </div>

      {/* Navigation Arrows */}
      {banners.length > 1 && (
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
      {banners.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
          {banners.map((_, index) => (
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
