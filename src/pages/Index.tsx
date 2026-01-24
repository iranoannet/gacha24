import MainLayout from "@/components/layout/MainLayout";
import HeroBanner from "@/components/home/HeroBanner";
import CategoryTabs from "@/components/home/CategoryTabs";
import GachaCard from "@/components/gacha/GachaCard";
import { motion } from "framer-motion";
import gachaCard1 from "@/assets/gacha-card-1.jpg";
import gachaCard2 from "@/assets/gacha-card-2.jpg";
import gachaCard3 from "@/assets/gacha-card-3.jpg";

// Mock gacha data
const gachaList = [
  {
    id: "1",
    title: "超お試しガチャ",
    imageUrl: gachaCard1,
    pricePerPlay: 0,
    totalSlots: Infinity,
    remainingSlots: Infinity,
    borderColor: "red" as const,
  },
  {
    id: "2",
    title: "ノーリスク初回限定",
    imageUrl: gachaCard2,
    pricePerPlay: 50,
    totalSlots: 1000,
    remainingSlots: 847,
    borderColor: "gold" as const,
  },
  {
    id: "3",
    title: "3パック確定ガチャ",
    imageUrl: gachaCard3,
    pricePerPlay: 1000,
    totalSlots: 500,
    remainingSlots: 423,
    borderColor: "gold" as const,
  },
  {
    id: "4",
    title: "アド確定ガチャ",
    imageUrl: gachaCard1,
    pricePerPlay: 5000,
    totalSlots: 200,
    remainingSlots: 156,
    borderColor: "rainbow" as const,
  },
  {
    id: "5",
    title: "1等山盛りオリパ",
    imageUrl: gachaCard2,
    pricePerPlay: 500,
    totalSlots: 1000,
    remainingSlots: 0,
    borderColor: "gold" as const,
  },
  {
    id: "6",
    title: "新春限定ガチャ",
    imageUrl: gachaCard3,
    pricePerPlay: 300,
    totalSlots: 800,
    remainingSlots: 612,
    borderColor: "gold" as const,
  },
];

const Index = () => {
  return (
    <MainLayout>
      {/* Hero Banner */}
      <HeroBanner />

      {/* Category Tabs */}
      <CategoryTabs />

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
          {gachaList.map((gacha) => (
            <GachaCard
              key={gacha.id}
              {...gacha}
            />
          ))}
        </motion.div>
      </section>
    </MainLayout>
  );
};

export default Index;
