import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger 
} from "@/components/ui/dialog";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Upload, Trash2, Play, Film, Plus, X, Loader2 } from "lucide-react";

const PRIZE_TIERS = ["S", "A", "B", "C", "D", "E"] as const;
type PrizeTierType = typeof PRIZE_TIERS[number];

const TIER_STYLES: Record<PrizeTierType, { bg: string; label: string }> = {
  S: { bg: "bg-gradient-to-r from-red-500 to-rose-600", label: "S賞" },
  A: { bg: "bg-gradient-to-r from-amber-400 to-orange-500", label: "A賞" },
  B: { bg: "bg-gradient-to-r from-cyan-400 to-blue-500", label: "B賞" },
  C: { bg: "bg-gradient-to-r from-green-400 to-emerald-500", label: "C賞" },
  D: { bg: "bg-gradient-to-r from-purple-400 to-violet-500", label: "D賞" },
  E: { bg: "bg-gradient-to-r from-gray-400 to-gray-500", label: "E賞" },
};

interface AnimationVideo {
  id: string;
  gacha_id: string;
  prize_tier: string;
  video_url: string;
  file_name: string | null;
  file_size: number | null;
  created_at: string;
}

interface AnimationVideoManagerProps {
  gachaId: string;
  gachaTitle: string;
  tenantId?: string | null;
}

export function AnimationVideoManager({ gachaId, gachaTitle, tenantId }: AnimationVideoManagerProps) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTier, setSelectedTier] = useState<PrizeTierType | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewVideo, setPreviewVideo] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AnimationVideo | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch videos for this gacha
  const { data: videos, isLoading } = useQuery({
    queryKey: ["animation-videos", gachaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gacha_animation_videos")
        .select("*")
        .eq("gacha_id", gachaId)
        .order("prize_tier", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as AnimationVideo[];
    },
    enabled: isOpen,
  });

  // Group videos by tier
  const videosByTier = PRIZE_TIERS.reduce((acc, tier) => {
    acc[tier] = videos?.filter(v => v.prize_tier === tier) || [];
    return acc;
  }, {} as Record<PrizeTierType, AnimationVideo[]>);

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async ({ file, tier }: { file: File; tier: PrizeTierType }) => {
      // Validate file size (100MB max)
      if (file.size > 100 * 1024 * 1024) {
        throw new Error("ファイルサイズは100MB以下にしてください");
      }

      // Validate file type
      if (!file.type.startsWith("video/")) {
        throw new Error("動画ファイルを選択してください");
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${gachaId}/${tier}/${crypto.randomUUID()}.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("gacha-animations")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("gacha-animations")
        .getPublicUrl(fileName);

      // Insert record
      const { error: insertError } = await supabase
        .from("gacha_animation_videos")
        .insert({
          gacha_id: gachaId,
          prize_tier: tier,
          video_url: urlData.publicUrl,
          file_name: file.name,
          file_size: file.size,
          tenant_id: tenantId || null,
        });

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["animation-videos", gachaId] });
      toast.success("動画をアップロードしました");
      setSelectedTier(null);
    },
    onError: (error) => {
      toast.error("アップロードに失敗しました: " + error.message);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (video: AnimationVideo) => {
      // Delete from storage
      const path = video.video_url.split("/gacha-animations/")[1];
      if (path) {
        await supabase.storage.from("gacha-animations").remove([path]);
      }

      // Delete record
      const { error } = await supabase
        .from("gacha_animation_videos")
        .delete()
        .eq("id", video.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["animation-videos", gachaId] });
      toast.success("動画を削除しました");
      setDeleteTarget(null);
    },
    onError: (error) => {
      toast.error("削除に失敗しました: " + error.message);
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedTier) return;

    setIsUploading(true);
    try {
      await uploadMutation.mutateAsync({ file, tier: selectedTier });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleUploadClick = (tier: PrizeTierType) => {
    setSelectedTier(tier);
    fileInputRef.current?.click();
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)}KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  const totalVideoCount = videos?.length || 0;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1">
            <Film className="w-4 h-4" />
            演出動画
            {totalVideoCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                {totalVideoCount}
              </Badge>
            )}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Film className="w-5 h-5" />
              演出動画管理 - {gachaTitle}
            </DialogTitle>
          </DialogHeader>

          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={handleFileSelect}
          />

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-6">
              <p className="text-sm text-muted-foreground">
                各賞ごとに演出動画を複数アップロードできます。ガチャプレイ時にランダムで1つ選択されます。
              </p>

              {PRIZE_TIERS.map((tier) => (
                <Card key={tier} className="overflow-hidden">
                  <CardHeader className="py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className={`${TIER_STYLES[tier].bg} text-white border-0`}>
                          {TIER_STYLES[tier].label}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {videosByTier[tier].length}件の動画
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() => handleUploadClick(tier)}
                        disabled={isUploading && selectedTier === tier}
                      >
                        {isUploading && selectedTier === tier ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Plus className="w-4 h-4" />
                        )}
                        追加
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {videosByTier[tier].length === 0 ? (
                      <div className="text-center py-6 text-muted-foreground text-sm border border-dashed rounded-lg">
                        まだ動画がありません
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {videosByTier[tier].map((video) => (
                          <div
                            key={video.id}
                            className="relative group rounded-lg overflow-hidden border bg-muted/50"
                          >
                            <video
                              src={video.video_url}
                              className="w-full aspect-video object-cover"
                              muted
                              preload="metadata"
                            />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <Button
                                size="icon"
                                variant="secondary"
                                className="h-8 w-8"
                                onClick={() => setPreviewVideo(video.video_url)}
                              >
                                <Play className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="destructive"
                                className="h-8 w-8"
                                onClick={() => setDeleteTarget(video)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-2 py-1">
                              <p className="text-xs text-white truncate">
                                {video.file_name || "動画"}
                              </p>
                              {video.file_size && (
                                <p className="text-[10px] text-white/70">
                                  {formatFileSize(video.file_size)}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Video Preview Dialog */}
      <Dialog open={!!previewVideo} onOpenChange={() => setPreviewVideo(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          <div className="relative">
            <Button
              size="icon"
              variant="ghost"
              className="absolute top-2 right-2 z-10 bg-black/50 hover:bg-black/70 text-white"
              onClick={() => setPreviewVideo(null)}
            >
              <X className="w-4 h-4" />
            </Button>
            {previewVideo && (
              <video
                src={previewVideo}
                className="w-full"
                controls
                autoPlay
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>動画を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              「{deleteTarget?.file_name || "この動画"}」を削除します。この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
            >
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
