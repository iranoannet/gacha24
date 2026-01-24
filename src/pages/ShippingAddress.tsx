import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import MainLayout from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const PREFECTURES = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
  "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
  "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県",
  "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
  "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
];

interface AddressForm {
  lastName: string;
  firstName: string;
  lastNameKana: string;
  firstNameKana: string;
  postalCode: string;
  prefecture: string;
  city: string;
  addressLine1: string;
  addressLine2: string;
  phoneNumber: string;
  allowDm: boolean;
}

const ShippingAddress = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<AddressForm>({
    lastName: "",
    firstName: "",
    lastNameKana: "",
    firstNameKana: "",
    postalCode: "",
    prefecture: "",
    city: "",
    addressLine1: "",
    addressLine2: "",
    phoneNumber: "",
    allowDm: false,
  });

  // Fetch existing address
  const { data: profile, isLoading } = useQuery({
    queryKey: ["user-address", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("last_name, first_name, last_name_kana, first_name_kana, postal_code, prefecture, city, address_line1, address_line2, phone_number, allow_dm")
        .eq("user_id", user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Populate form with existing data
  useEffect(() => {
    if (profile) {
      setForm({
        lastName: profile.last_name || "",
        firstName: profile.first_name || "",
        lastNameKana: profile.last_name_kana || "",
        firstNameKana: profile.first_name_kana || "",
        postalCode: profile.postal_code || "",
        prefecture: profile.prefecture || "",
        city: profile.city || "",
        addressLine1: profile.address_line1 || "",
        addressLine2: profile.address_line2 || "",
        phoneNumber: profile.phone_number || "",
        allowDm: profile.allow_dm || false,
      });
    }
  }, [profile]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: AddressForm) => {
      if (!user) throw new Error("ログインが必要です");

      const { error } = await supabase
        .from("profiles")
        .update({
          last_name: data.lastName,
          first_name: data.firstName,
          last_name_kana: data.lastNameKana,
          first_name_kana: data.firstNameKana,
          postal_code: data.postalCode,
          prefecture: data.prefecture,
          city: data.city,
          address_line1: data.addressLine1,
          address_line2: data.addressLine2,
          phone_number: data.phoneNumber,
          allow_dm: data.allowDm,
        })
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-address"] });
      toast.success("住所を登録しました");
      navigate(-1);
    },
    onError: (error) => {
      toast.error("エラー: " + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!form.lastName || !form.firstName) {
      toast.error("姓名を入力してください");
      return;
    }
    if (!form.lastNameKana || !form.firstNameKana) {
      toast.error("セイメイを入力してください");
      return;
    }
    if (!form.postalCode || !/^\d{7}$/.test(form.postalCode.replace("-", ""))) {
      toast.error("正しい郵便番号を入力してください");
      return;
    }
    if (!form.prefecture) {
      toast.error("都道府県を選択してください");
      return;
    }
    if (!form.city) {
      toast.error("市区町村を入力してください");
      return;
    }
    if (!form.addressLine1) {
      toast.error("番地を入力してください");
      return;
    }
    if (!form.phoneNumber || !/^\d{10,11}$/.test(form.phoneNumber.replace(/-/g, ""))) {
      toast.error("正しい電話番号を入力してください");
      return;
    }

    saveMutation.mutate(form);
  };

  if (!user) {
    return (
      <MainLayout>
        <div className="container px-4 py-6">
          <p className="text-center text-muted-foreground">ログインしてください</p>
        </div>
      </MainLayout>
    );
  }

  if (isLoading) {
    return (
      <MainLayout>
        <div className="container px-4 py-6 flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container px-4 py-6 max-w-lg mx-auto">
        {/* Back button */}
        <button 
          onClick={() => navigate(-1)} 
          className="flex items-center gap-1 text-sm text-muted-foreground mb-4 hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          マイページ
        </button>

        <h1 className="text-xl font-bold mb-6">お届け先の登録</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 姓 */}
          <div>
            <Label htmlFor="lastName" className="text-sm text-muted-foreground">姓</Label>
            <Input
              id="lastName"
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              className="mt-1"
              placeholder="山田"
            />
          </div>

          {/* 名 */}
          <div>
            <Label htmlFor="firstName" className="text-sm text-muted-foreground">名</Label>
            <Input
              id="firstName"
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              className="mt-1"
              placeholder="太郎"
            />
          </div>

          {/* セイ */}
          <div>
            <Label htmlFor="lastNameKana" className="text-sm text-muted-foreground">セイ</Label>
            <Input
              id="lastNameKana"
              value={form.lastNameKana}
              onChange={(e) => setForm({ ...form, lastNameKana: e.target.value })}
              className="mt-1"
              placeholder="ヤマダ"
            />
          </div>

          {/* メイ */}
          <div>
            <Label htmlFor="firstNameKana" className="text-sm text-muted-foreground">メイ</Label>
            <Input
              id="firstNameKana"
              value={form.firstNameKana}
              onChange={(e) => setForm({ ...form, firstNameKana: e.target.value })}
              className="mt-1"
              placeholder="タロウ"
            />
          </div>

          {/* 郵便番号 */}
          <div>
            <Label htmlFor="postalCode" className="text-sm text-muted-foreground">郵便番号</Label>
            <Input
              id="postalCode"
              value={form.postalCode}
              onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
              className="mt-1"
              placeholder="1234567"
              maxLength={8}
            />
          </div>

          {/* 都道府県 */}
          <div>
            <Label htmlFor="prefecture" className="text-sm text-muted-foreground">都道府県</Label>
            <Select 
              value={form.prefecture} 
              onValueChange={(v) => setForm({ ...form, prefecture: v })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="都道府県" />
              </SelectTrigger>
              <SelectContent>
                {PREFECTURES.map((pref) => (
                  <SelectItem key={pref} value={pref}>
                    {pref}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 市区町村 */}
          <div>
            <Label htmlFor="city" className="text-sm text-muted-foreground">市区町村</Label>
            <Input
              id="city"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              className="mt-1"
              placeholder="渋谷区"
            />
          </div>

          {/* 番地 */}
          <div>
            <Label htmlFor="addressLine1" className="text-sm text-muted-foreground">番地</Label>
            <Input
              id="addressLine1"
              value={form.addressLine1}
              onChange={(e) => setForm({ ...form, addressLine1: e.target.value })}
              className="mt-1"
              placeholder="1-2-3"
            />
          </div>

          {/* 建物名や部屋番号 */}
          <div>
            <Label htmlFor="addressLine2" className="text-sm text-muted-foreground">建物名や部屋番号</Label>
            <Input
              id="addressLine2"
              value={form.addressLine2}
              onChange={(e) => setForm({ ...form, addressLine2: e.target.value })}
              className="mt-1"
              placeholder="○○マンション 101号室"
            />
          </div>

          {/* 電話番号 */}
          <div>
            <Label htmlFor="phoneNumber" className="text-sm text-muted-foreground">電話番号</Label>
            <Input
              id="phoneNumber"
              value={form.phoneNumber}
              onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
              className="mt-1"
              placeholder="09012345678"
              maxLength={13}
            />
          </div>

          {/* DM許可 */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="allowDm"
              checked={form.allowDm}
              onCheckedChange={(checked) => setForm({ ...form, allowDm: !!checked })}
            />
            <Label htmlFor="allowDm" className="text-sm">ポスティングを許可する</Label>
          </div>

          <p className="text-xs text-muted-foreground">
            ※DMやお知らせハガキの投函可否です。配送方法には関係ありません。
          </p>

          <p className="text-xs text-muted-foreground">
            ご本人以外の住所を登録された場合は、利用規約違反となりますのでご注意ください。
          </p>

          {/* Submit */}
          <Button
            type="submit"
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                保存中...
              </>
            ) : (
              "住所を登録する"
            )}
          </Button>
        </form>
      </div>
    </MainLayout>
  );
};

export default ShippingAddress;
