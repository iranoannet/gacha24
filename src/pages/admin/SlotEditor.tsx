import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
} from "@/components/ui/dialog";
import { Shuffle, Lock, Save, Plus, Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type GachaMaster = Database["public"]["Tables"]["gacha_masters"]["Row"];
type GachaSlot = Database["public"]["Tables"]["gacha_slots"]["Row"];
type Card = Database["public"]["Tables"]["cards"]["Row"];
type CardRarity = Database["public"]["Enums"]["card_rarity"];

const rarityColors: Record<CardRarity, string> = {
  S: "bg-gradient-to-r from-yellow-400 to-amber-500 text-black",
  A: "bg-gradient-to-r from-purple-500 to-pink-500 text-white",
  B: "bg-gradient-to-r from-blue-500 to-cyan-500 text-white",
  C: "bg-gradient-to-r from-green-500 to-emerald-500 text-white",
  D: "bg-gray-500 text-white",
};

export default function SlotEditor() {
  const queryClient = useQueryClient();
  const [selectedGachaId, setSelectedGachaId] = useState<string>("");
  const [isAddCardOpen, setIsAddCardOpen] = useState(false);
  const [newCard, setNewCard] = useState({
    name: "",
    rarity: "C" as CardRarity,
    image_url: "",
    conversion_points: 0,
    quantity: 1,
  });

  const { data: gachas } = useQuery({
    queryKey: ["admin-gachas-for-slots"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gacha_masters")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: cards, refetch: refetchCards } = useQuery({
    queryKey: ["admin-cards", selectedGachaId],
    queryFn: async () => {
      if (!selectedGachaId) return [];
      const { data, error } = await supabase
        .from("cards")
        .select("*")
        .eq("gacha_id", selectedGachaId)
        .order("rarity", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedGachaId,
  });

  const { data: slots, refetch: refetchSlots } = useQuery({
    queryKey: ["admin-slots", selectedGachaId],
    queryFn: async () => {
      if (!selectedGachaId) return [];
      const { data, error } = await supabase
        .from("gacha_slots")
        .select("*, cards(*)")
        .eq("gacha_id", selectedGachaId)
        .order("slot_number", { ascending: true });
      if (error) throw error;
      return data as (GachaSlot & { cards: Card | null })[];
    },
    enabled: !!selectedGachaId,
  });

  const addCardMutation = useMutation({
    mutationFn: async (cardData: typeof newCard) => {
      const { error } = await supabase.from("cards").insert({
        gacha_id: selectedGachaId,
        name: cardData.name,
        rarity: cardData.rarity,
        image_url: cardData.image_url || null,
        conversion_points: cardData.conversion_points,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      refetchCards();
      setIsAddCardOpen(false);
      setNewCard({ name: "", rarity: "C", image_url: "", conversion_points: 0, quantity: 1 });
      toast.success("カードを追加しました");
    },
    onError: (error) => toast.error("エラー: " + error.message),
  });

  const generateSlotsMutation = useMutation({
    mutationFn: async () => {
      if (!selectedGachaId || !cards) return;

      const gacha = gachas?.find((g) => g.id === selectedGachaId);
      if (!gacha) return;

      // Delete existing slots
      await supabase.from("gacha_slots").delete().eq("gacha_id", selectedGachaId);

      // Create slot assignments
      const slotAssignments: { gacha_id: string; slot_number: number; card_id: string }[] = [];
      let slotNumber = 1;

      // For now, distribute cards evenly across slots
      const totalSlots = gacha.total_slots;
      const cardPool: Card[] = [];

      // Create card pool based on rough distribution
      cards.forEach((card) => {
        const count = Math.max(1, Math.floor(totalSlots / cards.length));
        for (let i = 0; i < count && cardPool.length < totalSlots; i++) {
          cardPool.push(card);
        }
      });

      // Fill remaining slots with random cards
      while (cardPool.length < totalSlots) {
        const randomCard = cards[Math.floor(Math.random() * cards.length)];
        cardPool.push(randomCard);
      }

      // Shuffle the pool
      for (let i = cardPool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cardPool[i], cardPool[j]] = [cardPool[j], cardPool[i]];
      }

      // Assign to slots
      cardPool.forEach((card) => {
        slotAssignments.push({
          gacha_id: selectedGachaId,
          slot_number: slotNumber++,
          card_id: card.id,
        });
      });

      const { error } = await supabase.from("gacha_slots").insert(slotAssignments);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchSlots();
      toast.success("スロットを生成しました");
    },
    onError: (error) => toast.error("エラー: " + error.message),
  });

  const selectedGacha = gachas?.find((g) => g.id === selectedGachaId);

  return (
    <AdminLayout title="スロット編集">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>ガチャ選択</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedGachaId} onValueChange={setSelectedGachaId}>
              <SelectTrigger className="w-full max-w-md">
                <SelectValue placeholder="ガチャを選択..." />
              </SelectTrigger>
              <SelectContent>
                {gachas?.map((gacha) => (
                  <SelectItem key={gacha.id} value={gacha.id}>
                    {gacha.title} ({gacha.remaining_slots}/{gacha.total_slots})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {selectedGachaId && (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>カードラインナップ ({cards?.length || 0}種類)</CardTitle>
                <Button size="sm" onClick={() => setIsAddCardOpen(true)}>
                  <Plus className="w-4 h-4 mr-1" />
                  カード追加
                </Button>
              </CardHeader>
              <CardContent>
                {cards?.length === 0 ? (
                  <p className="text-muted-foreground">カードが登録されていません</p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {cards?.map((card) => (
                      <div key={card.id} className="border rounded-lg p-3 space-y-2">
                        {card.image_url ? (
                          <img
                            src={card.image_url}
                            alt={card.name}
                            className="w-full aspect-[3/4] object-cover rounded"
                          />
                        ) : (
                          <div className="w-full aspect-[3/4] bg-muted rounded flex items-center justify-center text-muted-foreground text-xs">
                            No Image
                          </div>
                        )}
                        <Badge className={rarityColors[card.rarity]}>{card.rarity}</Badge>
                        <p className="text-sm font-medium truncate">{card.name}</p>
                        <p className="text-xs text-muted-foreground">{card.conversion_points}pt</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>
                  スロット配置 ({slots?.length || 0}/{selectedGacha?.total_slots || 0})
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => generateSlotsMutation.mutate()}
                    disabled={!cards?.length || generateSlotsMutation.isPending}
                  >
                    <Shuffle className="w-4 h-4 mr-1" />
                    {generateSlotsMutation.isPending ? "生成中..." : "ランダム生成"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {slots?.length === 0 ? (
                  <p className="text-muted-foreground">
                    スロットがまだ生成されていません。カードを追加してからランダム生成してください。
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20">スロット#</TableHead>
                        <TableHead>カード</TableHead>
                        <TableHead>レアリティ</TableHead>
                        <TableHead>還元pt</TableHead>
                        <TableHead>状態</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {slots?.slice(0, 50).map((slot) => (
                        <TableRow key={slot.id}>
                          <TableCell className="font-mono">{slot.slot_number}</TableCell>
                          <TableCell>{slot.cards?.name || "-"}</TableCell>
                          <TableCell>
                            {slot.cards && (
                              <Badge className={rarityColors[slot.cards.rarity]}>
                                {slot.cards.rarity}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>{slot.cards?.conversion_points || 0}pt</TableCell>
                          <TableCell>
                            {slot.is_drawn ? (
                              <Badge variant="secondary">排出済み</Badge>
                            ) : (
                              <Badge variant="outline">未排出</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                {slots && slots.length > 50 && (
                  <p className="text-sm text-muted-foreground mt-4">
                    先頭50件を表示中（全{slots.length}件）
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Add Card Dialog */}
        <Dialog open={isAddCardOpen} onOpenChange={setIsAddCardOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>カード追加</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>カード名</Label>
                <Input
                  value={newCard.name}
                  onChange={(e) => setNewCard({ ...newCard, name: e.target.value })}
                  placeholder="リザードン"
                />
              </div>
              <div>
                <Label>レアリティ</Label>
                <Select
                  value={newCard.rarity}
                  onValueChange={(v: CardRarity) => setNewCard({ ...newCard, rarity: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["S", "A", "B", "C", "D"] as CardRarity[]).map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>画像URL</Label>
                <Input
                  value={newCard.image_url}
                  onChange={(e) => setNewCard({ ...newCard, image_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div>
                <Label>還元ポイント</Label>
                <Input
                  type="number"
                  value={newCard.conversion_points}
                  onChange={(e) => setNewCard({ ...newCard, conversion_points: parseInt(e.target.value) || 0 })}
                />
              </div>
              <Button
                className="w-full"
                onClick={() => addCardMutation.mutate(newCard)}
                disabled={!newCard.name || addCardMutation.isPending}
              >
                {addCardMutation.isPending ? "追加中..." : "追加"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
