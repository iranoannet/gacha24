import { useState, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Play, X } from "lucide-react";
import { CardPackAnimation } from "@/components/gacha/CardPackAnimation";
import { GachaAnimationSystem } from "@/components/gacha/GachaAnimationSystem";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AnimationPreviewDialogProps {
  animationType: "A" | "B";
  fakeSChance?: number;
}

type PreviewTier = "S" | "A" | "B" | "miss";

// サンプルカードデータ
const generateSampleCards = (tier: PreviewTier, count: number = 1) => {
  const tierCards = {
    S: { name: "【テスト】S賞カード", prizeTier: "S", conversionPoints: 50000 },
    A: { name: "【テスト】A賞カード", prizeTier: "A", conversionPoints: 10000 },
    B: { name: "【テスト】B賞カード", prizeTier: "B", conversionPoints: 1000 },
    miss: { name: "【テスト】C賞カード", prizeTier: "miss", conversionPoints: 100 },
  };

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
  const [playCount, setPlayCount] = useState<1 | 10>(1);
  const [sampleCards, setSampleCards] = useState(generateSampleCards("S", 1));

  // プレビュー設定変更時にサンプルカードを更新
  useEffect(() => {
    setSampleCards(generateSampleCards(previewTier, playCount));
  }, [previewTier, playCount]);

  const handlePlay = useCallback(() => {
    setSampleCards(generateSampleCards(previewTier, playCount));
    setIsPlaying(true);
  }, [previewTier, playCount]);

  const handleComplete = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const handleClose = useCallback(() => {
    setIsPlaying(false);
    setIsOpen(false);
  }, []);

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
            {/* 閉じるボタン */}
            <Button 
              variant="ghost" 
              size="icon" 
              className="absolute top-2 right-2 z-[120] text-white hover:bg-white/20"
              onClick={handleComplete}
            >
              <X className="w-5 h-5" />
            </Button>

            {animationType === "B" ? (
              <CardPackAnimation
                isPlaying={isPlaying}
                onComplete={handleComplete}
                onSkip={handleComplete}
                drawnCards={sampleCards}
                playCount={playCount}
                fakeSChance={fakeSChance}
              />
            ) : (
              <GachaAnimationSystem
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
                  onValueChange={(value) => setPlayCount(parseInt(value) as 1 | 10)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1回</SelectItem>
                    <SelectItem value="10">10連</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {animationType === "B" && (
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <p className="font-medium mb-1">フェイク演出確率: {fakeSChance}%</p>
                <p className="text-muted-foreground text-xs">
                  C賞（ハズレ）選択時、{fakeSChance}%の確率でS賞風の派手な演出が出ます（ドキドキ演出）
                </p>
              </div>
            )}

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
