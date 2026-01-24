import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Coins, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import gachaCard1 from "@/assets/gacha-card-1.jpg";
import gachaCard2 from "@/assets/gacha-card-2.jpg";
import gachaCard3 from "@/assets/gacha-card-3.jpg";

// Mock data - カードラインナップ
const cardLineup = [
  { id: "1", name: "リザードンex SAR", imageUrl: gachaCard1, rarity: "S", quantity: 1, conversionPoints: 50000 },
  { id: "2", name: "ピカチュウex SAR", imageUrl: gachaCard2, rarity: "S", quantity: 1, conversionPoints: 30000 },
  { id: "3", name: "ミュウex SR", imageUrl: gachaCard3, rarity: "A", quantity: 2, conversionPoints: 15000 },
  { id: "4", name: "ルギア SR", imageUrl: gachaCard1, rarity: "A", quantity: 2, conversionPoints: 12000 },
  { id: "5", name: "レックウザ AR", imageUrl: gachaCard2, rarity: "B", quantity: 5, conversionPoints: 5000 },
  { id: "6", name: "ゲンガー AR", imageUrl: gachaCard3, rarity: "B", quantity: 5, conversionPoints: 4000 },
  { id: "7", name: "カイリュー R", imageUrl: gachaCard1, rarity: "C", quantity: 10, conversionPoints: 1000 },
  { id: "8", name: "ギャラドス R", imageUrl: gachaCard2, rarity: "C", quantity: 10, conversionPoints: 800 },
  { id: "9", name: "イーブイ C", imageUrl: gachaCard3, rarity: "D", quantity: 30, conversionPoints: 100 },
  { id: "10", name: "ピカチュウ C", imageUrl: gachaCard1, rarity: "D", quantity: 34, conversionPoints: 100 },
];

// Mock gacha data
const gachaData = {
  id: "1",
  title: "大当たりを待ち構えろ！1等100枚大量封入!!!",
  subtitle: "1/3の確率で100コイン以上が当たる!!",
  bannerUrl: gachaCard1,
  pricePerPlay: 500,
  totalSlots: 100,
  remainingSlots: 77,
  rank: 1,
};

const rarityStyles: Record<string, { bg: string; text: string; glow: string }> = {
  S: { bg: "bg-rarity-s", text: "text-foreground", glow: "shadow-[0_0_20px_hsl(var(--rarity-s))]" },
  A: { bg: "bg-rarity-a", text: "text-foreground", glow: "shadow-[0_0_15px_hsl(var(--rarity-a))]" },
  B: { bg: "bg-rarity-b", text: "text-foreground", glow: "shadow-[0_0_10px_hsl(var(--rarity-b))]" },
  C: { bg: "bg-rarity-c", text: "text-foreground", glow: "" },
  D: { bg: "bg-rarity-d", text: "text-foreground", glow: "" },
};

const GachaDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const soldPercentage = ((gachaData.totalSlots - gachaData.remainingSlots) / gachaData.totalSlots) * 100;

  const handlePlay = (count: 1 | 10 | 100) => {
    // TODO: ガチャ実行ロジック
    console.log(`Playing ${count} times`);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="container px-4 h-14 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm">戻る</span>
          </button>
          <Button variant="ghost" size="icon">
            <Share2 className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container px-4 py-4">
        {/* Banner with Rank Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-xl overflow-hidden mb-6"
        >
          <img
            src={gachaData.bannerUrl}
            alt={gachaData.title}
            className="w-full aspect-video object-cover"
          />
          {/* Rank Badge */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2">
            <div className="relative">
              <div className="bg-gradient-to-r from-blue-500 via-cyan-400 to-yellow-400 px-6 py-1 rounded-full">
                <span className="text-white font-black text-lg">{gachaData.rank}位</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Card Lineup Section */}
        <section className="mb-6">
          <h2 className="text-lg font-bold mb-4 text-center text-foreground">
            カードラインナップ
          </h2>
          
          <motion.div
            className="grid grid-cols-2 gap-3"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: {
                transition: { staggerChildren: 0.05 },
              },
            }}
          >
            {cardLineup.map((card) => (
              <motion.div
                key={card.id}
                variants={{
                  hidden: { opacity: 0, scale: 0.9 },
                  visible: { opacity: 1, scale: 1 },
                }}
                className={`relative rounded-lg overflow-hidden bg-card border border-border ${rarityStyles[card.rarity]?.glow || ""}`}
              >
                {/* Rarity Badge */}
                <Badge
                  className={`absolute top-2 left-2 z-10 ${rarityStyles[card.rarity]?.bg} ${rarityStyles[card.rarity]?.text} font-black text-xs px-2`}
                >
                  {card.rarity}
                </Badge>
                
                {/* Quantity Badge */}
                <div className="absolute bottom-2 right-2 z-10 bg-foreground/80 text-background text-xs font-bold px-2 py-0.5 rounded">
                  ×{card.quantity}
                </div>
                
                {/* Card Image */}
                <img
                  src={card.imageUrl}
                  alt={card.name}
                  className="w-full aspect-[3/4] object-cover"
                />
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* Gacha Info */}
        <section className="bg-card rounded-xl p-4 border border-border">
          <h3 className="font-bold text-foreground mb-2">ガチャ情報</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">1回の価格</span>
              <span className="font-bold text-primary flex items-center gap-1">
                <Coins className="h-4 w-4" />
                {gachaData.pricePerPlay.toLocaleString()} コイン
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">総口数</span>
              <span className="font-bold text-foreground">{gachaData.totalSlots}口</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">残り口数</span>
              <span className="font-bold text-accent">{gachaData.remainingSlots}口</span>
            </div>
          </div>
        </section>
      </main>

      {/* Fixed Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-3 z-50">
        <div className="container">
          {/* Progress Bar with Remaining */}
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center gap-1 text-sm">
              <span className="text-primary font-bold">🔥</span>
              <span className="text-muted-foreground">{gachaData.remainingSlots}/{gachaData.totalSlots}</span>
            </div>
            <Progress value={soldPercentage} className="flex-1 h-2" />
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              残りわずかお早めに!!
            </span>
          </div>
          
          {/* Play Buttons */}
          <div className="grid grid-cols-3 gap-2">
            <Button
              className="btn-gacha h-12 text-sm font-bold"
              onClick={() => handlePlay(1)}
            >
              <div className="flex flex-col items-center">
                <span>1回ガチャ</span>
                <span className="text-xs opacity-80">{gachaData.pricePerPlay}コイン</span>
              </div>
            </Button>
            <Button
              className="h-12 text-sm font-bold bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white"
              onClick={() => handlePlay(10)}
            >
              <div className="flex flex-col items-center">
                <span>10連ガチャ</span>
                <span className="text-xs opacity-80">{(gachaData.pricePerPlay * 10).toLocaleString()}コイン</span>
              </div>
            </Button>
            <Button
              className="h-12 text-sm font-bold bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
              onClick={() => handlePlay(100)}
            >
              <div className="flex flex-col items-center">
                <span>100連ガチャ</span>
                <span className="text-xs opacity-80">{(gachaData.pricePerPlay * 100).toLocaleString()}コイン</span>
              </div>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GachaDetail;
