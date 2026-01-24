import MainLayout from "@/components/layout/MainLayout";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const LegalNotice = () => {
  return (
    <MainLayout>
      <div className="container px-4 py-6 max-w-2xl mx-auto">
        <h1 className="text-xl font-bold mb-6">法令に基づく表記</h1>

        <Tabs defaultValue="commercial" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="commercial" className="text-xs">特定商取引法</TabsTrigger>
            <TabsTrigger value="antique" className="text-xs">古物営業法</TabsTrigger>
          </TabsList>

          <TabsContent value="commercial">
            <Card className="p-6">
              <h2 className="text-lg font-bold mb-4">特定商取引法に基づく表記</h2>
              
              <div className="space-y-4 text-sm">
                <div className="border-b pb-3">
                  <p className="text-muted-foreground text-xs mb-1">販売業者</p>
                  <p className="text-foreground">株式会社〇〇〇〇</p>
                </div>

                <div className="border-b pb-3">
                  <p className="text-muted-foreground text-xs mb-1">運営統括責任者</p>
                  <p className="text-foreground">〇〇 〇〇</p>
                </div>

                <div className="border-b pb-3">
                  <p className="text-muted-foreground text-xs mb-1">所在地</p>
                  <p className="text-foreground">〒000-0000<br />東京都〇〇区〇〇 0-0-0</p>
                </div>

                <div className="border-b pb-3">
                  <p className="text-muted-foreground text-xs mb-1">電話番号</p>
                  <p className="text-foreground">03-0000-0000</p>
                  <p className="text-xs text-muted-foreground">※お問い合わせはメールにてお願いいたします</p>
                </div>

                <div className="border-b pb-3">
                  <p className="text-muted-foreground text-xs mb-1">メールアドレス</p>
                  <p className="text-foreground">support@example.com</p>
                </div>

                <div className="border-b pb-3">
                  <p className="text-muted-foreground text-xs mb-1">販売URL</p>
                  <p className="text-foreground">https://example.com</p>
                </div>

                <div className="border-b pb-3">
                  <p className="text-muted-foreground text-xs mb-1">販売価格</p>
                  <p className="text-foreground">各商品ページに表示された金額（税込）</p>
                </div>

                <div className="border-b pb-3">
                  <p className="text-muted-foreground text-xs mb-1">商品代金以外の必要料金</p>
                  <p className="text-foreground">
                    ・消費税（税込価格に含む）<br />
                    ・配送料（発送依頼時に別途必要）<br />
                    ・決済手数料（決済方法により異なる）
                  </p>
                </div>

                <div className="border-b pb-3">
                  <p className="text-muted-foreground text-xs mb-1">お支払い方法</p>
                  <p className="text-foreground">
                    ・クレジットカード決済<br />
                    ・ポイント決済
                  </p>
                </div>

                <div className="border-b pb-3">
                  <p className="text-muted-foreground text-xs mb-1">お支払い時期</p>
                  <p className="text-foreground">ガチャ購入時に即時決済</p>
                </div>

                <div className="border-b pb-3">
                  <p className="text-muted-foreground text-xs mb-1">商品の引渡し時期</p>
                  <p className="text-foreground">
                    【デジタルコンテンツ】購入後即時<br />
                    【実物商品】発送依頼後、7営業日以内に発送
                  </p>
                </div>

                <div className="border-b pb-3">
                  <p className="text-muted-foreground text-xs mb-1">返品・キャンセルについて</p>
                  <p className="text-foreground">
                    デジタルコンテンツの性質上、購入後の返品・キャンセルはお受けできません。<br />
                    実物商品については、商品の破損・汚損があった場合のみ交換対応いたします。
                  </p>
                </div>

                <div>
                  <p className="text-muted-foreground text-xs mb-1">動作環境</p>
                  <p className="text-foreground">
                    【推奨ブラウザ】<br />
                    ・Chrome（最新版）<br />
                    ・Safari（最新版）<br />
                    ・Firefox（最新版）<br />
                    ・Edge（最新版）
                  </p>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="antique">
            <Card className="p-6">
              <h2 className="text-lg font-bold mb-4">古物営業法に基づく表記</h2>
              
              <div className="space-y-4 text-sm">
                <div className="border-b pb-3">
                  <p className="text-muted-foreground text-xs mb-1">古物商許可番号</p>
                  <p className="text-foreground">第〇〇〇〇〇〇〇〇〇〇〇号</p>
                </div>

                <div className="border-b pb-3">
                  <p className="text-muted-foreground text-xs mb-1">許可公安委員会</p>
                  <p className="text-foreground">東京都公安委員会</p>
                </div>

                <div className="border-b pb-3">
                  <p className="text-muted-foreground text-xs mb-1">古物商名称</p>
                  <p className="text-foreground">株式会社〇〇〇〇</p>
                </div>

                <div className="border-b pb-3">
                  <p className="text-muted-foreground text-xs mb-1">取扱品目</p>
                  <p className="text-foreground">道具類</p>
                </div>

                <div>
                  <p className="text-muted-foreground text-xs mb-1">古物営業の届出</p>
                  <p className="text-foreground">
                    当社は古物営業法に基づき、適正な古物商としての営業を行っております。
                    中古品の買取・販売にあたっては、法令を遵守し、本人確認等の必要な手続きを実施しております。
                  </p>
                </div>
              </div>

              <div className="mt-6 p-4 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">
                  ※古物営業法に基づき、取引の際には本人確認を実施させていただく場合がございます。
                </p>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default LegalNotice;
