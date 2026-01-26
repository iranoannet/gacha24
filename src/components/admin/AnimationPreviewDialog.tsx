import { useState, useCallback, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Play, X, RotateCcw } from "lucide-react";
import { CardPackAnimation } from "@/components/gacha/CardPackAnimation";
import { GachaAnimationSystem } from "@/components/gacha/GachaAnimationSystem";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AnimationPreviewDialogProps {
  animationType: "A" | "B";
  fakeSChance?: number;
}

type PreviewTier = "S" | "A" | "B" | "miss";

// サンプルカードデータ（画像URL付き）
const generateSampleCards = (tier: PreviewTier, count: number = 1) => {
  const tierCards = {
    S: { name: "【テスト】S賞カード", prizeTier: "S", conversionPoints: 50000 },
    A: { name: "【テスト】A賞カード", prizeTier: "A", conversionPoints: 10000 },
    B: { name: "【テスト】B賞カード", prizeTier: "B", conversionPoints: 1000 },
    miss: { name: "【テスト】C賞カード", prizeTier: "miss", conversionPoints: 100 },
  };

  // 10連・100連の場合は混合にする
  if (count > 1) {
    return Array.from({ length: count }, (_, i) => {
      // 最後のカードは選択した賞
      if (i === count - 1) {
        return {
          slotId: `test-slot-${i}`,
          cardId: `test-card-${i}`,
          name: tierCards[tier].name,
          imageUrl: null,
          prizeTier: tierCards[tier].prizeTier,
          conversionPoints: tierCards[tier].conversionPoints,
        };
      }
      // それ以外はランダム（C賞多め）
      const randomTier = Math.random() < 0.7 ? "miss" : Math.random() < 0.5 ? "B" : "A";
      return {
        slotId: `test-slot-${i}`,
        cardId: `test-card-${i}`,
        name: tierCards[randomTier as PreviewTier].name,
        imageUrl: null,
        prizeTier: tierCards[randomTier as PreviewTier].prizeTier,
        conversionPoints: tierCards[randomTier as PreviewTier].conversionPoints,
      };
    });
  }

  return Array.from({ length: count }, (_, i) => ({
    slotId: `test-slot-${i}`,
    cardId: `test-card-${i}`,
    name: tierCards[tier].name,
    imageUrl: null,
    prizeTier: tierCards[tier].prizeTier,
    conversionPoints: tierCards[tier].conversionPoints,
  }));
};

export function AnimationPreviewDialog({ 
  animationType, 
  fakeSChance = 15 
}: AnimationPreviewDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [previewTier, setPreviewTier] = useState<PreviewTier>("S");
  const [playCount, setPlayCount] = useState<1 | 10 | 100>(1);
  const [sampleCards, setSampleCards] = useState(generateSampleCards("S", 1));
  const [animationKey, setAnimationKey] = useState(0);
  
  // 前回の設定を追跡
  const prevAnimationType = useRef(animationType);
  const prevFakeSChance = useRef(fakeSChance);

  // animationType や fakeSChance が変わったら再生中の場合はリセット
  useEffect(() => {
    if (prevAnimationType.current !== animationType || prevFakeSChance.current !== fakeSChance) {
      if (isPlaying) {
        // 演出をリセットして再開
        setIsPlaying(false);
        setTimeout(() => {
          setSampleCards(generateSampleCards(previewTier, playCount));
          setAnimationKey(prev => prev + 1);
          setIsPlaying(true);
        }, 100);
      }
      prevAnimationType.current = animationType;
      prevFakeSChance.current = fakeSChance;
    }
  }, [animationType, fakeSChance, isPlaying, previewTier, playCount]);

  // プレビュー設定変更時にサンプルカードを更新
  useEffect(() => {
    setSampleCards(generateSampleCards(previewTier, playCount));
  }, [previewTier, playCount]);

  const handlePlay = useCallback(() => {
    setSampleCards(generateSampleCards(previewTier, playCount));
    setAnimationKey(prev => prev + 1);
    setIsPlaying(true);
  }, [previewTier, playCount]);

  const handleComplete = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const handleClose = useCallback(() => {
    setIsPlaying(false);
    setIsOpen(false);
  }, []);

  const handleReplay = useCallback(() => {
    setIsPlaying(false);
    setTimeout(() => {
      setSampleCards(generateSampleCards(previewTier, playCount));
      setAnimationKey(prev => prev + 1);
      setIsPlaying(true);
    }, 100);
  }, [previewTier, playCount]);

  // 演出時間の目安
  const getDurationText = () => {
    if (animationType === "A") return "約6秒";
    if (playCount === 1) return "約9秒";
    if (playCount === 10) return "約16秒";
    return "約28秒";
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) setIsPlaying(false); }}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-1 ml-2">
          <Play className="w-3 h-3" />
          テスト
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            演出プレビュー（{animationType === "A" ? "スロットマシン風" : "カードパック開封風"}）
          </DialogTitle>
        </DialogHeader>

        {isPlaying ? (
          <div className="relative min-h-[400px] bg-black rounded-lg overflow-hidden">
            {/* コントロールボタン */}
            <div className="absolute top-2 right-2 z-[120] flex gap-2">
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-white hover:bg-white/20"
                onClick={handleReplay}
                title="リプレイ"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-white hover:bg-white/20"
                onClick={handleComplete}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {animationType === "B" ? (
              <CardPackAnimation
                key={animationKey}
                isPlaying={isPlaying}
                onComplete={handleComplete}
                onSkip={handleComplete}
                drawnCards={sampleCards}
                playCount={playCount}
                fakeSChance={fakeSChance}
              />
            ) : (
              <GachaAnimationSystem
                key={animationKey}
                isPlaying={isPlaying}
                onComplete={handleComplete}
                onSkip={handleComplete}
                colorTheme={previewTier === "S" ? "gold" : previewTier === "A" ? "gold" : previewTier === "B" ? "blue" : "monochrome"}
                intensity={previewTier === "S" ? 5 : previewTier === "A" ? 4 : previewTier === "B" ? 3 : 2}
                cameraMotion={previewTier === "S" ? "impactZoom" : "shake"}
                particleStyle={previewTier === "S" ? "rainbow" : previewTier === "A" ? "confetti" : "spark"}
                playCount={playCount}
                isRainbow={previewTier === "S"}
              />
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              演出の動作確認ができます。各設定を選んで「再生」をクリックしてください。
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>当選賞</Label>
                <Select
                  value={previewTier}
                  onValueChange={(value: PreviewTier) => setPreviewTier(value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="S">S賞（最高演出）</SelectItem>
                    <SelectItem value="A">A賞</SelectItem>
                    <SelectItem value="B">B賞</SelectItem>
                    <SelectItem value="miss">C賞（ハズレ）</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>回数</Label>
                <Select
                  value={String(playCount)}
                  onValueChange={(value) => setPlayCount(parseInt(value) as 1 | 10 | 100)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1回</SelectItem>
                    <SelectItem value="10">10連</SelectItem>
                    {animationType === "B" && (
                      <SelectItem value="100">100連</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {animationType === "B" && (
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <p className="font-medium mb-1">フェイク演出確率: {fakeSChance}%</p>
                <p className="text-muted-foreground text-xs">
                  C賞（ハズレ）選択時、{fakeSChance}%の確率でS賞風の派手な演出が出ます
                </p>
              </div>
            )}

            <div className="text-center text-xs text-muted-foreground">
              演出時間: {getDurationText()}
            </div>

            <Button onClick={handlePlay} className="w-full gap-2">
              <Play className="w-4 h-4" />
              演出を再生
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
