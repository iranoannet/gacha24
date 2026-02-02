import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Video, Upload, Trash2, Play, RefreshCw, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface AnimationVideo {
  id: string;
  prize_tier: string;
  video_url: string;
  file_name: string | null;
  file_size: number | null;
  created_at: string;
}

const PRIZE_TIERS = [
  { value: "S", label: "S等級", color: "bg-yellow-500/20 text-yellow-500 border-yellow-500/50" },
  { value: "A", label: "A等級", color: "bg-purple-500/20 text-purple-500 border-purple-500/50" },
  { value: "B", label: "B等級", color: "bg-blue-500/20 text-blue-500 border-blue-500/50" },
  { value: "miss", label: "ハズレ", color: "bg-gray-500/20 text-gray-400 border-gray-500/50" },
];

export default function AnimationSettings() {
  const { tenant } = useTenant();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState<string | null>(null);
  const [previewVideo, setPreviewVideo] = useState<string | null>(null);

  // Fetch tenant-wide animation videos (gacha_id = NULL for tenant-wide)
  const { data: videos, isLoading } = useQuery({
    queryKey: ["tenant-animation-videos", tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      
      const { data, error } = await supabase
        .from("gacha_animation_videos")
        .select("*")
        .eq("tenant_id", tenant.id)
        .is("gacha_id", null)
        .order("prize_tier", { ascending: true });

      if (error) throw error;
      return data as AnimationVideo[];
    },
    enabled: !!tenant?.id,
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ file, prizeTier }: { file: File; prizeTier: string }) => {
      if (!tenant?.id) throw new Error("テナント情報がありません");

      const fileExt = file.name.split(".").pop();
      const fileName = `${tenant.id}/global/${prizeTier}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("gacha-animations")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("gacha-animations")
        .getPublicUrl(fileName);

      const { error: dbError } = await supabase
        .from("gacha_animation_videos")
        .insert({
          tenant_id: tenant.id,
          gacha_id: null, // NULL means tenant-wide
          prize_tier: prizeTier,
          video_url: publicUrl,
          file_name: file.name,
          file_size: file.size,
        });

      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-animation-videos"] });
      toast.success("動画をアップロードしました");
      setUploading(null);
    },
    onError: (error: Error) => {
      toast.error(`アップロードエラー: ${error.message}`);
      setUploading(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (video: AnimationVideo) => {
      // Extract file path from URL
      const urlParts = video.video_url.split("/gacha-animations/");
      if (urlParts.length > 1) {
        await supabase.storage.from("gacha-animations").remove([urlParts[1]]);
      }

      const { error } = await supabase
        .from("gacha_animation_videos")
        .delete()
        .eq("id", video.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-animation-videos"] });
      toast.success("動画を削除しました");
    },
    onError: (error: Error) => {
      toast.error(`削除エラー: ${error.message}`);
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, prizeTier: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      toast.error("動画ファイルを選択してください");
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      toast.error("ファイルサイズは100MB以下にしてください");
      return;
    }

    setUploading(prizeTier);
    uploadMutation.mutate({ file, prizeTier });
  };

  const getVideosByTier = (tier: string) => {
    return videos?.filter((v) => v.prize_tier === tier) || [];
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "不明";
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  return (
    <AdminLayout title="演出設定">
      <div className="space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="w-5 h-5" />
              テナント共通演出動画
            </CardTitle>
            <CardDescription>
              このテナントの全ガチャで使用される演出動画を管理します。
              各等級で複数の動画を登録すると、ランダムに1つが再生されます。
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Prize Tier Cards */}
        <div className="grid gap-6">
          {PRIZE_TIERS.map((tier) => {
            const tierVideos = getVideosByTier(tier.value);
            
            return (
              <Card key={tier.value}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={tier.color}>
                        {tier.label}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {tierVideos.length}件の動画
                      </span>
                    </div>
                    <Label htmlFor={`upload-${tier.value}`} className="cursor-pointer">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={uploading === tier.value}
                        asChild
                      >
                        <span>
                          {uploading === tier.value ? (
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Plus className="w-4 h-4 mr-2" />
                          )}
                          動画を追加
                        </span>
                      </Button>
                      <Input
                        id={`upload-${tier.value}`}
                        type="file"
                        accept="video/*"
                        className="hidden"
                        onChange={(e) => handleFileUpload(e, tier.value)}
                        disabled={uploading === tier.value}
                      />
                    </Label>
                  </div>
                </CardHeader>
                <CardContent>
                  {tierVideos.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Video className="w-12 h-12 mx-auto mb-2 opacity-30" />
                      <p>動画がまだ登録されていません</p>
                    </div>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                      {tierVideos.map((video) => (
                        <div
                          key={video.id}
                          className="relative group rounded-lg border border-border bg-card overflow-hidden"
                        >
                          <video
                            src={video.video_url}
                            className="w-full aspect-video object-cover"
                            muted
                            preload="metadata"
                          />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => setPreviewVideo(video.video_url)}
                                >
                                  <Play className="w-4 h-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-3xl">
                                <DialogHeader>
                                  <DialogTitle>プレビュー - {tier.label}</DialogTitle>
                                </DialogHeader>
                                <video
                                  src={video.video_url}
                                  className="w-full aspect-video rounded-lg"
                                  controls
                                  autoPlay
                                />
                              </DialogContent>
                            </Dialog>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => deleteMutation.mutate(video)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                          <div className="p-2 text-xs text-muted-foreground truncate">
                            {video.file_name || "不明なファイル"} ({formatFileSize(video.file_size)})
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Info Card */}
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <h4 className="font-medium mb-2">使用方法</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• 各等級に複数の動画を登録すると、ガチャ結果時にランダムで1つが再生されます</li>
              <li>• 推奨フォーマット: MP4 (H.264), 最大100MB</li>
              <li>• 動画が登録されていない等級は、デフォルトのアニメーションが使用されます</li>
              <li>• ガチャ個別に演出を設定したい場合は、ガチャ管理から個別設定できます</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
