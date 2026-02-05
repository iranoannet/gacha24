import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Film, Plus, Trash2, Upload, Play, ChevronDown, ChevronRight, Edit2, Check, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";

interface AnimationPattern {
  id: string;
  name: string;
  description: string | null;
  tenant_id: string | null;
  created_at: string;
}

interface AnimationVideo {
  id: string;
  pattern_id: string | null;
  prize_tier: string;
  video_url: string;
  file_name: string | null;
  file_size: number | null;
}

const PRIZE_TIERS = [
  { value: "S", label: "S賞", color: "bg-yellow-500" },
  { value: "A", label: "A賞", color: "bg-purple-500" },
  { value: "B", label: "B賞", color: "bg-blue-500" },
  { value: "C", label: "C賞", color: "bg-green-500" },
  { value: "D", label: "D賞", color: "bg-gray-500" },
  { value: "E", label: "E賞（ハズレ）", color: "bg-red-500" },
];

export default function AnimationSettings() {
  const { tenant } = useTenant();
  const { tenantId: authTenantId } = useAuth();
  const queryClient = useQueryClient();
  
  // Use tenant from URL if available, otherwise use tenant from auth
  const effectiveTenantId = tenant?.id || authTenantId;
  
  const [newPatternName, setNewPatternName] = useState("");
  const [newPatternDescription, setNewPatternDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [expandedPatterns, setExpandedPatterns] = useState<Set<string>>(new Set());
  const [uploadingTier, setUploadingTier] = useState<{ patternId: string; tier: string } | null>(null);
  const [previewVideo, setPreviewVideo] = useState<string | null>(null);
  const [editingPattern, setEditingPattern] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  // Fetch patterns
  const { data: patterns, isLoading: patternsLoading } = useQuery({
    queryKey: ["animation-patterns", effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return [];
      const { data, error } = await supabase
        .from("gacha_animation_patterns")
        .select("*")
        .eq("tenant_id", effectiveTenantId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as AnimationPattern[];
    },
    enabled: !!effectiveTenantId,
  });

  // Fetch all videos for this tenant's patterns
  const { data: videos } = useQuery({
    queryKey: ["animation-videos", effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return [];
      const { data, error } = await supabase
        .from("gacha_animation_videos")
        .select("*")
        .eq("tenant_id", effectiveTenantId)
        .not("pattern_id", "is", null)
        .order("prize_tier", { ascending: true });
      if (error) throw error;
      return data as AnimationVideo[];
    },
    enabled: !!effectiveTenantId,
  });

  const handleCreatePattern = async () => {
    if (!newPatternName.trim()) {
      toast.error("パターン名を入力してください");
      return;
    }
    if (!effectiveTenantId) {
      toast.error("テナント情報が取得できません。ページを再読み込みしてください。");
      return;
    }

    setIsCreating(true);
    try {
      const { error } = await supabase
        .from("gacha_animation_patterns")
        .insert({
          tenant_id: effectiveTenantId,
          name: newPatternName.trim(),
          description: newPatternDescription.trim() || null,
        });

      if (error) throw error;

      toast.success("演出パターンを作成しました");
      setNewPatternName("");
      setNewPatternDescription("");
      queryClient.invalidateQueries({ queryKey: ["animation-patterns", effectiveTenantId] });
    } catch (error) {
      toast.error("作成に失敗しました");
      console.error(error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeletePattern = async (patternId: string) => {
    if (!confirm("この演出パターンを削除しますか？関連する全ての動画も削除されます。")) return;

    try {
      const { error } = await supabase
        .from("gacha_animation_patterns")
        .delete()
        .eq("id", patternId);

      if (error) throw error;

      toast.success("演出パターンを削除しました");
      queryClient.invalidateQueries({ queryKey: ["animation-patterns", effectiveTenantId] });
      queryClient.invalidateQueries({ queryKey: ["animation-videos", effectiveTenantId] });
    } catch (error) {
      toast.error("削除に失敗しました");
      console.error(error);
    }
  };

  const handleUpdatePatternName = async (patternId: string) => {
    if (!editName.trim()) {
      toast.error("パターン名を入力してください");
      return;
    }

    try {
      const { error } = await supabase
        .from("gacha_animation_patterns")
        .update({ name: editName.trim() })
        .eq("id", patternId);

      if (error) throw error;

      toast.success("パターン名を更新しました");
      setEditingPattern(null);
      queryClient.invalidateQueries({ queryKey: ["animation-patterns", effectiveTenantId] });
    } catch (error) {
      toast.error("更新に失敗しました");
      console.error(error);
    }
  };

  const handleVideoUpload = async (patternId: string, tier: string, file: File) => {
    if (!effectiveTenantId) return;

    if (file.size > 100 * 1024 * 1024) {
      toast.error("ファイルサイズは100MB以下にしてください");
      return;
    }

    setUploadingTier({ patternId, tier });

    try {
      const fileName = `${effectiveTenantId}/${patternId}/${tier}/${Date.now()}_${file.name}`;
      
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
          tenant_id: effectiveTenantId,
          pattern_id: patternId,
          prize_tier: tier,
          video_url: publicUrl,
          file_name: file.name,
          file_size: file.size,
        });

      if (dbError) throw dbError;

      toast.success(`${tier}賞の動画をアップロードしました`);
      queryClient.invalidateQueries({ queryKey: ["animation-videos", effectiveTenantId] });
    } catch (error) {
      toast.error("アップロードに失敗しました");
      console.error(error);
    } finally {
      setUploadingTier(null);
    }
  };

  const handleDeleteVideo = async (videoId: string, videoUrl: string) => {
    if (!confirm("この動画を削除しますか？")) return;

    try {
      const urlParts = videoUrl.split("/gacha-animations/");
      if (urlParts.length > 1) {
        const filePath = urlParts[1];
        await supabase.storage.from("gacha-animations").remove([filePath]);
      }

      const { error } = await supabase
        .from("gacha_animation_videos")
        .delete()
        .eq("id", videoId);

      if (error) throw error;

      toast.success("動画を削除しました");
      queryClient.invalidateQueries({ queryKey: ["animation-videos", effectiveTenantId] });
    } catch (error) {
      toast.error("削除に失敗しました");
      console.error(error);
    }
  };

  const togglePattern = (patternId: string) => {
    setExpandedPatterns(prev => {
      const next = new Set(prev);
      if (next.has(patternId)) {
        next.delete(patternId);
      } else {
        next.add(patternId);
      }
      return next;
    });
  };

  const getVideosForPattern = (patternId: string) => {
    return videos?.filter(v => v.pattern_id === patternId) || [];
  };

  const getVideosForTier = (patternId: string, tier: string) => {
    return videos?.filter(v => v.pattern_id === patternId && v.prize_tier === tier) || [];
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "不明";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <AdminLayout title="演出設定">
      <div className="space-y-6">
        {/* Create New Pattern */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              新規演出パターン作成
            </CardTitle>
            <CardDescription>
              ガチャで使用する演出パターンを作成します。ガチャ作成時にここで登録したパターンから選択できます。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 items-end flex-wrap">
              <div className="flex-1 min-w-48">
                <Label htmlFor="pattern-name">パターン名</Label>
                <Input
                  id="pattern-name"
                  placeholder="例：炎演出、王道パチンコ風"
                  value={newPatternName}
                  onChange={(e) => setNewPatternName(e.target.value)}
                />
              </div>
              <div className="flex-1 min-w-48">
                <Label htmlFor="pattern-desc">説明（任意）</Label>
                <Input
                  id="pattern-desc"
                  placeholder="例：高級感のある演出"
                  value={newPatternDescription}
                  onChange={(e) => setNewPatternDescription(e.target.value)}
                />
              </div>
              <Button onClick={handleCreatePattern} disabled={isCreating || !newPatternName.trim()}>
                <Plus className="h-4 w-4 mr-2" />
                作成
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Pattern List */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Film className="h-5 w-5" />
            登録済み演出パターン
          </h2>

          {patternsLoading ? (
            <p className="text-muted-foreground">読み込み中...</p>
          ) : patterns?.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                演出パターンがまだありません。上のフォームから作成してください。
              </CardContent>
            </Card>
          ) : (
            patterns?.map((pattern) => {
              const patternVideos = getVideosForPattern(pattern.id);
              const isExpanded = expandedPatterns.has(pattern.id);

              return (
                <Collapsible
                  key={pattern.id}
                  open={isExpanded}
                  onOpenChange={() => togglePattern(pattern.id)}
                >
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CollapsibleTrigger asChild>
                          <button className="flex items-center gap-3 text-left hover:opacity-80">
                            {isExpanded ? (
                              <ChevronDown className="h-5 w-5" />
                            ) : (
                              <ChevronRight className="h-5 w-5" />
                            )}
                            {editingPattern === pattern.id ? (
                              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                <Input
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  className="h-8 w-48"
                                  autoFocus
                                />
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleUpdatePatternName(pattern.id)}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setEditingPattern(null)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <div>
                                <CardTitle className="text-base">{pattern.name}</CardTitle>
                                {pattern.description && (
                                  <CardDescription className="text-sm">{pattern.description}</CardDescription>
                                )}
                              </div>
                            )}
                          </button>
                        </CollapsibleTrigger>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">
                            {patternVideos.length} 動画
                          </Badge>
                          {editingPattern !== pattern.id && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingPattern(pattern.id);
                                setEditName(pattern.name);
                              }}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDeletePattern(pattern.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>

                    <CollapsibleContent>
                      <CardContent className="pt-0">
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                          {PRIZE_TIERS.map((tier) => {
                            const tierVideos = getVideosForTier(pattern.id, tier.value);
                            const isUploading = uploadingTier?.patternId === pattern.id && uploadingTier?.tier === tier.value;

                            return (
                              <Card key={tier.value} className="bg-muted/30">
                                <CardHeader className="pb-2">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <div className={`w-3 h-3 rounded-full ${tier.color}`} />
                                      <span className="font-medium">{tier.label}</span>
                                    </div>
                                    <Badge variant="secondary">{tierVideos.length}本</Badge>
                                  </div>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                  {tierVideos.map((video) => (
                                    <div
                                      key={video.id}
                                      className="flex items-center justify-between p-2 bg-background rounded-md text-sm"
                                    >
                                      <div className="truncate flex-1 mr-2">
                                        <p className="truncate">{video.file_name || "動画"}</p>
                                        <p className="text-xs text-muted-foreground">
                                          {formatFileSize(video.file_size)}
                                        </p>
                                      </div>
                                      <div className="flex gap-1">
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => setPreviewVideo(video.video_url)}
                                        >
                                          <Play className="h-3 w-3" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="text-destructive"
                                          onClick={() => handleDeleteVideo(video.id, video.video_url)}
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </div>
                                  ))}

                                  <label className="flex items-center justify-center gap-2 p-2 border-2 border-dashed rounded-md cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors">
                                    <input
                                      type="file"
                                      accept="video/mp4,video/webm"
                                      className="hidden"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          handleVideoUpload(pattern.id, tier.value, file);
                                        }
                                        e.target.value = "";
                                      }}
                                      disabled={isUploading}
                                    />
                                    {isUploading ? (
                                      <span className="text-sm text-muted-foreground">アップロード中...</span>
                                    ) : (
                                      <>
                                        <Upload className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-sm text-muted-foreground">追加</span>
                                      </>
                                    )}
                                  </label>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              );
            })
          )}
        </div>

        {/* Info Card */}
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <h4 className="font-medium mb-2">使用方法</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• 演出パターンを作成し、各賞ごとに動画をアップロードします</li>
              <li>• 同じ賞に複数の動画を登録すると、ランダムで1つが再生されます</li>
              <li>• ガチャ作成時に、使用する演出パターンを選択します</li>
              <li>• 推奨フォーマット: MP4 (H.264), 最大100MB</li>
            </ul>
          </CardContent>
        </Card>

        {/* Video Preview Dialog */}
        <Dialog open={!!previewVideo} onOpenChange={() => setPreviewVideo(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>動画プレビュー</DialogTitle>
            </DialogHeader>
            {previewVideo && (
              <video
                src={previewVideo}
                controls
                autoPlay
                className="w-full rounded-lg"
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
