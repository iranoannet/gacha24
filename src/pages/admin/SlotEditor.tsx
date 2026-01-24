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
import { Shuffle, Lock, Unlock, Save, Plus, Edit2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type GachaMaster = Database["public"]["Tables"]["gacha_masters"]["Row"];
type GachaSlot = Database["public"]["Tables"]["gacha_slots"]["Row"];
type CardType = Database["public"]["Tables"]["cards"]["Row"];
type CardRarity = Database["public"]["Enums"]["card_rarity"];

const rarityColors: Record<CardRarity, string> = {
  S: "bg-gradient-to-r from-yellow-400 to-amber-500 text-black",
  A: "bg-gradient-to-r from-purple-500 to-pink-500 text-white",
  B: "bg-gradient-to-r from-blue-500 to-cyan-500 text-white",
  C: "bg-gradient-to-r from-green-500 to-emerald-500 text-white",
  D: "bg-gray-500 text-white",
};

interface SlotWithCard extends GachaSlot {
  cards: CardType | null;
  isLocked?: boolean;
}

export default function SlotEditor() {
  const queryClient = useQueryClient();
  const [selectedGachaId, setSelectedGachaId] = useState<string>("");
  const [isAddCardOpen, setIsAddCardOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<SlotWithCard | null>(null);
  const [lockedSlots, setLockedSlots] = useState<Set<string>>(new Set());
  const [drawMode, setDrawMode] = useState<"random" | "ordered">("random");
  const [slotNumberEdits, setSlotNumberEdits] = useState<Record<string, number>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [goToPage, setGoToPage] = useState("");
  const itemsPerPage = 100;
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
      return data as SlotWithCard[];
    },
    enabled: !!selectedGachaId,
  });

  // Sort slots by points (high to low) for display - used in both modes
  const sortedSlots = slots ? [...slots].sort((a, b) => {
    const pointsA = a.cards?.conversion_points || 0;
    const pointsB = b.cards?.conversion_points || 0;
    return pointsB - pointsA;
  }) : [];

  // Initialize slot number edits when slots load
  useEffect(() => {
    if (slots) {
      const edits: Record<string, number> = {};
      slots.forEach(slot => {
        edits[slot.id] = slot.slot_number;
      });
      setSlotNumberEdits(edits);
    }
  }, [slots]);

  const selectedGacha = gachas?.find((g) => g.id === selectedGachaId);
  const isGachaActive = selectedGacha?.status === "active";

  const addCardMutation = useMutation({
    mutationFn: async (cardData: typeof newCard) => {
      if (isGachaActive) {
        throw new Error("公開中のガチャにはカードを追加できません");
      }
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

  const updateSlotNumbersMutation = useMutation({
    mutationFn: async (updates: { slotId: string; newSlotNumber: number }[]) => {
      for (const update of updates) {
        const { error } = await supabase
          .from("gacha_slots")
          .update({ slot_number: update.newSlotNumber })
          .eq("id", update.slotId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      refetchSlots();
      toast.success("スロット番号を更新しました");
    },
    onError: (error) => toast.error("エラー: " + error.message),
  });

  const updateSlotCardMutation = useMutation({
    mutationFn: async ({ slotId, cardId }: { slotId: string; cardId: string }) => {
      const { error } = await supabase
        .from("gacha_slots")
        .update({ card_id: cardId })
        .eq("id", slotId);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchSlots();
      setEditingSlot(null);
      toast.success("スロットを更新しました");
    },
    onError: (error) => toast.error("エラー: " + error.message),
  });

  const handleSlotNumberChange = (slotId: string, value: string) => {
    const num = parseInt(value) || 0;
    setSlotNumberEdits(prev => ({ ...prev, [slotId]: num }));
  };

  const handleSlotNumberBlur = (editedSlot: SlotWithCard) => {
    if (!slots) return;
    const newNumber = slotNumberEdits[editedSlot.id];
    if (newNumber === editedSlot.slot_number || newNumber <= 0 || editedSlot.is_drawn) return;

    // Check for duplicates and resolve them
    const updates: { slotId: string; newSlotNumber: number }[] = [];
    const usedNumbers = new Set<number>();
    
    // First, add the edited slot with its new number
    updates.push({ slotId: editedSlot.id, newSlotNumber: newNumber });
    usedNumbers.add(newNumber);

    // Then, process other slots and shift duplicates
    const otherSlots = slots
      .filter(s => s.id !== editedSlot.id && !s.is_drawn)
      .sort((a, b) => a.slot_number - b.slot_number);

    for (const slot of otherSlots) {
      let slotNum = slot.slot_number;
      // If this number conflicts, find the next available
      while (usedNumbers.has(slotNum)) {
        slotNum++;
      }
      if (slotNum !== slot.slot_number) {
        updates.push({ slotId: slot.id, newSlotNumber: slotNum });
      }
      usedNumbers.add(slotNum);
    }

    // Update local state immediately
    const newEdits = { ...slotNumberEdits };
    updates.forEach(u => {
      newEdits[u.slotId] = u.newSlotNumber;
    });
    setSlotNumberEdits(newEdits);

    // Save to database
    updateSlotNumbersMutation.mutate(updates);
  };

  const generateSlotsMutation = useMutation({
    mutationFn: async () => {
      if (!selectedGachaId || !cards) return;

      const gacha = gachas?.find((g) => g.id === selectedGachaId);
      if (!gacha) return;

      // Get current slots to preserve locked ones
      const currentSlots = slots || [];
      const lockedSlotData = currentSlots.filter(s => lockedSlots.has(s.id));
      const lockedSlotNumbers = new Set(lockedSlotData.map(s => s.slot_number));

      // Delete only unlocked slots
      if (lockedSlots.size > 0) {
        const unlockedSlotIds = currentSlots
          .filter(s => !lockedSlots.has(s.id))
          .map(s => s.id);
        
        if (unlockedSlotIds.length > 0) {
          await supabase
            .from("gacha_slots")
            .delete()
            .in("id", unlockedSlotIds);
        }
      } else {
        await supabase.from("gacha_slots").delete().eq("gacha_id", selectedGachaId);
      }

      // Create slot assignments for non-locked slots
      const slotAssignments: { gacha_id: string; slot_number: number; card_id: string }[] = [];
      const totalSlots = gacha.total_slots;
      const cardPool: CardType[] = [];

      // Create card pool
      cards.forEach((card) => {
        const count = Math.max(1, Math.floor(totalSlots / cards.length));
        for (let i = 0; i < count && cardPool.length < totalSlots; i++) {
          cardPool.push(card);
        }
      });

      while (cardPool.length < totalSlots) {
        const randomCard = cards[Math.floor(Math.random() * cards.length)];
        cardPool.push(randomCard);
      }

      // Shuffle the pool
      for (let i = cardPool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cardPool[i], cardPool[j]] = [cardPool[j], cardPool[i]];
      }

      // Generate random slot numbers within 1 to totalSlots (avoiding locked ones)
      const generateRandomSlotNumbers = (count: number, excludeNumbers: Set<number>): number[] => {
        const numbers: number[] = [];
        const availableNumbers: number[] = [];
        
        // Create pool of available numbers from 1 to totalSlots
        for (let i = 1; i <= totalSlots; i++) {
          if (!excludeNumbers.has(i)) {
            availableNumbers.push(i);
          }
        }
        
        // Shuffle and pick required count
        for (let i = availableNumbers.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [availableNumbers[i], availableNumbers[j]] = [availableNumbers[j], availableNumbers[i]];
        }
        
        return availableNumbers.slice(0, count);
      };

      const slotsNeeded = totalSlots - lockedSlotNumbers.size;
      const randomSlotNumbers = generateRandomSlotNumbers(slotsNeeded, lockedSlotNumbers);

      // Assign cards to random slot numbers
      for (let i = 0; i < slotsNeeded; i++) {
        slotAssignments.push({
          gacha_id: selectedGachaId,
          slot_number: randomSlotNumbers[i],
          card_id: cardPool[i].id,
        });
      }

      if (slotAssignments.length > 0) {
        const { error } = await supabase.from("gacha_slots").insert(slotAssignments);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      refetchSlots();
      toast.success("スロットを生成しました（ロック済みスロットは保持）");
    },
    onError: (error) => toast.error("エラー: " + error.message),
  });

  const toggleLock = (slotId: string) => {
    setLockedSlots(prev => {
      const newSet = new Set(prev);
      if (newSet.has(slotId)) {
        newSet.delete(slotId);
      } else {
        newSet.add(slotId);
      }
      return newSet;
    });
  };

  return (
    <AdminLayout title="スロット編集（排出順設定）">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>ガチャ選択</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedGachaId} onValueChange={(v) => {
              setSelectedGachaId(v);
              setLockedSlots(new Set());
            }}>
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
                <Button 
                  size="sm" 
                  onClick={() => setIsAddCardOpen(true)}
                  disabled={isGachaActive}
                  title={isGachaActive ? "公開中のガチャにはカードを追加できません" : ""}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  カード追加
                </Button>
              </CardHeader>
              <CardContent>
                {cards?.length === 0 ? (
                  <p className="text-muted-foreground">カードが登録されていません</p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {[...(cards || [])].sort((a, b) => b.conversion_points - a.conversion_points).map((card) => (
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
                <div>
                  <CardTitle>
                    スロット配置 ({slots?.length || 0}/{selectedGacha?.total_slots || 0})
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {drawMode === "random" 
                      ? "ランダムに排出されます。ポイントの高い順で表示。" 
                      : "スロット番号の小さい順に排出されます。番号を直接編集して排出順を設定できます。"}
                  </p>
                  {isGachaActive && (
                    <p className="text-sm text-destructive mt-1">
                      ※ 公開中のガチャのためカード追加・ランダム生成は無効です
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <div className="flex border rounded-lg overflow-hidden">
                    <Button
                      variant={drawMode === "random" ? "default" : "ghost"}
                      size="sm"
                      className="rounded-none"
                      onClick={() => setDrawMode("random")}
                    >
                      ランダム
                    </Button>
                    <Button
                      variant={drawMode === "ordered" ? "default" : "ghost"}
                      size="sm"
                      className="rounded-none"
                      onClick={() => setDrawMode("ordered")}
                    >
                      排出順
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => generateSlotsMutation.mutate()}
                    disabled={!cards?.length || generateSlotsMutation.isPending || isGachaActive}
                    title={isGachaActive ? "公開中のガチャでは使用できません" : ""}
                  >
                    <Shuffle className="w-4 h-4 mr-1" />
                    {generateSlotsMutation.isPending ? "生成中..." : "ランダム生成"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {lockedSlots.size > 0 && (
                  <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      <Lock className="w-4 h-4 inline mr-1" />
                      {lockedSlots.size}件のスロットがロックされています。ランダム生成時にこれらは保持されます。
                    </p>
                  </div>
                )}
                
                {slots?.length === 0 ? (
                  <p className="text-muted-foreground">
                    スロットがまだ生成されていません。カードを追加してからランダム生成してください。
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {drawMode === "ordered" && <TableHead className="w-24">スロット番号</TableHead>}
                          <TableHead>カード</TableHead>
                          <TableHead>レアリティ</TableHead>
                          <TableHead>還元pt</TableHead>
                          <TableHead>状態</TableHead>
                          {drawMode === "ordered" && <TableHead className="w-32">操作</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedSlots
                          .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                          .map((slot) => (
                          <TableRow 
                            key={slot.id}
                            className={drawMode === "ordered" && lockedSlots.has(slot.id) ? "bg-amber-50 dark:bg-amber-950/30" : ""}
                          >
                            {drawMode === "ordered" && (
                              <TableCell>
                                <Input
                                  type="number"
                                  className="w-20 font-mono text-center"
                                  value={slotNumberEdits[slot.id] ?? slot.slot_number}
                                  onChange={(e) => handleSlotNumberChange(slot.id, e.target.value)}
                                  onBlur={() => handleSlotNumberBlur(slot)}
                                  disabled={slot.is_drawn}
                                  min={1}
                                  max={selectedGacha?.total_slots || undefined}
                                />
                              </TableCell>
                            )}
                            <TableCell className="flex items-center gap-2">
                              {slot.cards?.image_url && (
                                <img 
                                  src={slot.cards.image_url} 
                                  alt={slot.cards.name} 
                                  className="w-8 h-10 object-cover rounded"
                                />
                              )}
                              {slot.cards?.name || "-"}
                            </TableCell>
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
                            {drawMode === "ordered" && (
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button
                                    variant={lockedSlots.has(slot.id) ? "default" : "ghost"}
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => toggleLock(slot.id)}
                                    disabled={slot.is_drawn}
                                    title={lockedSlots.has(slot.id) ? "ロック解除" : "ロック"}
                                  >
                                    {lockedSlots.has(slot.id) ? (
                                      <Lock className="w-4 h-4" />
                                    ) : (
                                      <Unlock className="w-4 h-4" />
                                    )}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => setEditingSlot(slot)}
                                    disabled={slot.is_drawn}
                                    title="カード変更"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {/* Pagination */}
                {sortedSlots.length > itemsPerPage && (
                  <div className="flex flex-wrap items-center justify-between gap-4 mt-4 pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, sortedSlots.length)} / 全{sortedSlots.length}件
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                      >
                        最初
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        前へ
                      </Button>
                      <span className="text-sm px-2">
                        {currentPage} / {Math.ceil(sortedSlots.length / itemsPerPage)}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.min(Math.ceil(sortedSlots.length / itemsPerPage), p + 1))}
                        disabled={currentPage >= Math.ceil(sortedSlots.length / itemsPerPage)}
                      >
                        次へ
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(Math.ceil(sortedSlots.length / itemsPerPage))}
                        disabled={currentPage >= Math.ceil(sortedSlots.length / itemsPerPage)}
                      >
                        最後
                      </Button>
                      <div className="flex items-center gap-1 ml-2">
                        <Input
                          type="number"
                          className="w-16 h-8 text-center"
                          placeholder="ページ"
                          value={goToPage}
                          onChange={(e) => setGoToPage(e.target.value)}
                          min={1}
                          max={Math.ceil(sortedSlots.length / itemsPerPage)}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const page = parseInt(goToPage);
                            const maxPage = Math.ceil(sortedSlots.length / itemsPerPage);
                            if (page >= 1 && page <= maxPage) {
                              setCurrentPage(page);
                              setGoToPage("");
                            }
                          }}
                        >
                          移動
                        </Button>
                      </div>
                    </div>
                  </div>
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

        {/* Edit Slot Card Dialog */}
        <Dialog open={!!editingSlot} onOpenChange={(open) => !open && setEditingSlot(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>スロット#{editingSlot?.slot_number} のカードを変更</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>カードを選択</Label>
                <Select
                  value={editingSlot?.card_id || ""}
                  onValueChange={(cardId) => {
                    if (editingSlot) {
                      updateSlotCardMutation.mutate({ slotId: editingSlot.id, cardId });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="カードを選択..." />
                  </SelectTrigger>
                  <SelectContent>
                    {cards?.map((card) => (
                      <SelectItem key={card.id} value={card.id}>
                        <div className="flex items-center gap-2">
                          <Badge className={rarityColors[card.rarity]}>{card.rarity}</Badge>
                          {card.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-sm text-muted-foreground">
                現在のカード: {editingSlot?.cards?.name || "未設定"}
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
