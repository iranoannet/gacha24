import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Plus, Trash2, GripVertical, Image, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface HeroBanner {
  id: string;
  title: string | null;
  image_url: string;
  link_url: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

const BannerManagement = () => {
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<HeroBanner | null>(null);
  const [newBanner, setNewBanner] = useState({
    title: "",
    link_url: "",
    is_active: true,
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const { data: banners, isLoading } = useQuery({
    queryKey: ["hero-banners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hero_banners")
        .select("*")
        .order("display_order", { ascending: true });

      if (error) throw error;
      return data as HeroBanner[];
    },
  });

  const uploadImage = async (file: File): Promise<string> => {
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("hero-banners")
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from("hero-banners")
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  };

  const addBannerMutation = useMutation({
    mutationFn: async () => {
      if (!imageFile) throw new Error("画像を選択してください");

      const imageUrl = await uploadImage(imageFile);
      const maxOrder = banners?.length ? Math.max(...banners.map((b) => b.display_order)) + 1 : 0;

      const { error } = await supabase.from("hero_banners").insert({
        title: newBanner.title || null,
        image_url: imageUrl,
        link_url: newBanner.link_url || null,
        display_order: maxOrder,
        is_active: newBanner.is_active,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hero-banners"] });
      toast.success("バナーを追加しました");
      setIsAddDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("hero_banners")
        .update({ is_active })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hero-banners"] });
      toast.success("ステータスを更新しました");
    },
    onError: () => {
      toast.error("更新に失敗しました");
    },
  });

  const deleteBannerMutation = useMutation({
    mutationFn: async (banner: HeroBanner) => {
      // Delete image from storage
      const fileName = banner.image_url.split("/").pop();
      if (fileName) {
        await supabase.storage.from("hero-banners").remove([fileName]);
      }

      // Delete record
      const { error } = await supabase
        .from("hero_banners")
        .delete()
        .eq("id", banner.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hero-banners"] });
      toast.success("バナーを削除しました");
      setDeleteTarget(null);
    },
    onError: () => {
      toast.error("削除に失敗しました");
    },
  });

  const updateOrderMutation = useMutation({
    mutationFn: async (updates: { id: string; display_order: number }[]) => {
      for (const update of updates) {
        const { error } = await supabase
          .from("hero_banners")
          .update({ display_order: update.display_order })
          .eq("id", update.id);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hero-banners"] });
      toast.success("順番を更新しました");
    },
    onError: () => {
      toast.error("順番の更新に失敗しました");
    },
  });

  const resetForm = () => {
    setNewBanner({ title: "", link_url: "", is_active: true });
    setImageFile(null);
    setImagePreview(null);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("ファイルサイズは5MB以下にしてください");
        return;
      }
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const moveOrder = (index: number, direction: "up" | "down") => {
    if (!banners) return;
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= banners.length) return;

    const updates = [
      { id: banners[index].id, display_order: banners[newIndex].display_order },
      { id: banners[newIndex].id, display_order: banners[index].display_order },
    ];

    updateOrderMutation.mutate(updates);
  };

  const activeBannerCount = banners?.filter((b) => b.is_active).length || 0;

  return (
    <AdminLayout title="バナー管理">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">バナー管理</h1>
            <p className="text-sm text-muted-foreground mt-1">
              トップページのスライドバナーを管理します（最大5枚、5秒間隔で自動スライド）
            </p>
          </div>

          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button disabled={banners && banners.length >= 5}>
                <Plus className="h-4 w-4 mr-2" />
                バナー追加
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>新規バナー追加</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>バナー画像 *</Label>
                  <div className="border-2 border-dashed rounded-lg p-4 text-center">
                    {imagePreview ? (
                      <div className="space-y-2">
                        <img
                          src={imagePreview}
                          alt="Preview"
                          className="w-full aspect-[21/9] object-cover rounded"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setImageFile(null);
                            setImagePreview(null);
                          }}
                        >
                          画像を変更
                        </Button>
                      </div>
                    ) : (
                      <label className="cursor-pointer block">
                        <div className="py-8">
                          <Image className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">
                            クリックして画像を選択
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            推奨サイズ: 1920×800px / 最大5MB
                          </p>
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleImageChange}
                        />
                      </label>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">タイトル（任意）</Label>
                  <Input
                    id="title"
                    value={newBanner.title}
                    onChange={(e) =>
                      setNewBanner({ ...newBanner, title: e.target.value })
                    }
                    placeholder="バナーのタイトル"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="link_url">リンク先URL（任意）</Label>
                  <Input
                    id="link_url"
                    value={newBanner.link_url}
                    onChange={(e) =>
                      setNewBanner({ ...newBanner, link_url: e.target.value })
                    }
                    placeholder="https://..."
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="is_active">公開する</Label>
                  <Switch
                    id="is_active"
                    checked={newBanner.is_active}
                    onCheckedChange={(checked) =>
                      setNewBanner({ ...newBanner, is_active: checked })
                    }
                  />
                </div>

                <Button
                  className="w-full"
                  onClick={() => addBannerMutation.mutate()}
                  disabled={!imageFile || addBannerMutation.isPending}
                >
                  {addBannerMutation.isPending ? "アップロード中..." : "追加する"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="p-4">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>
              登録バナー: <strong className="text-foreground">{banners?.length || 0}/5</strong>
            </span>
            <span>
              公開中: <strong className="text-foreground">{activeBannerCount}</strong>
            </span>
          </div>
        </Card>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">順番</TableHead>
                <TableHead className="w-32">画像</TableHead>
                <TableHead>タイトル</TableHead>
                <TableHead>リンク</TableHead>
                <TableHead className="w-24">公開</TableHead>
                <TableHead className="w-24">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    読み込み中...
                  </TableCell>
                </TableRow>
              ) : banners?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    バナーがありません
                  </TableCell>
                </TableRow>
              ) : (
                banners?.map((banner, index) => (
                  <TableRow key={banner.id}>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        <div className="flex flex-col">
                          <button
                            className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
                            onClick={() => moveOrder(index, "up")}
                            disabled={index === 0}
                          >
                            ▲
                          </button>
                          <button
                            className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
                            onClick={() => moveOrder(index, "down")}
                            disabled={index === (banners?.length || 0) - 1}
                          >
                            ▼
                          </button>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <img
                        src={banner.image_url}
                        alt={banner.title || "Banner"}
                        className="w-24 aspect-[21/9] object-cover rounded"
                      />
                    </TableCell>
                    <TableCell>
                      <span className="text-foreground">
                        {banner.title || <span className="text-muted-foreground">-</span>}
                      </span>
                    </TableCell>
                    <TableCell>
                      {banner.link_url ? (
                        <a
                          href={banner.link_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          リンク
                        </a>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={banner.is_active}
                        onCheckedChange={(checked) =>
                          toggleActiveMutation.mutate({ id: banner.id, is_active: checked })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(banner)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>バナーを削除</AlertDialogTitle>
            <AlertDialogDescription>
              このバナーを削除してもよろしいですか？この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteBannerMutation.mutate(deleteTarget)}
            >
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default BannerManagement;
