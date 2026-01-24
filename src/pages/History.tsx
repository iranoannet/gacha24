import MainLayout from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { History as HistoryIcon } from "lucide-react";

const History = () => {
  return (
    <MainLayout>
      <div className="container px-4 py-6">
        <h1 className="text-xl font-bold mb-4">当選履歴</h1>

        <Tabs defaultValue="list" className="w-full">
          <TabsList className="w-full grid grid-cols-2 bg-muted">
            <TabsTrigger value="list" className="text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <span className="flex items-center gap-1">
                ☰ リスト表示
              </span>
            </TabsTrigger>
            <TabsTrigger value="new" className="text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <span className="flex items-center gap-1">
                ↑ 新しい順
              </span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="mt-6">
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <HistoryIcon className="h-16 w-16 mb-4 opacity-30" />
              <p className="text-sm text-center">
                まだ当選商品がありません
                <br />
                2等以上の商品を獲得した場合に表示されます
              </p>
            </div>
          </TabsContent>

          <TabsContent value="new" className="mt-6">
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <HistoryIcon className="h-16 w-16 mb-4 opacity-30" />
              <p className="text-sm text-center">
                まだ当選商品がありません
                <br />
                2等以上の商品を獲得した場合に表示されます
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default History;
