import MainLayout from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package } from "lucide-react";

const Inventory = () => {
  return (
    <MainLayout>
      <div className="container px-4 py-6">
        <h1 className="text-xl font-bold mb-4">獲得商品</h1>

        <Tabs defaultValue="unselected" className="w-full">
          <TabsList className="w-full grid grid-cols-3 bg-muted">
            <TabsTrigger value="unselected" className="text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              未選択
            </TabsTrigger>
            <TabsTrigger value="pending" className="text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              発送待ち
            </TabsTrigger>
            <TabsTrigger value="shipped" className="text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              発送済み
            </TabsTrigger>
          </TabsList>

          <TabsContent value="unselected" className="mt-6">
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Package className="h-16 w-16 mb-4 opacity-30" />
              <p className="text-sm">未選択の獲得商品がありません</p>
            </div>
          </TabsContent>

          <TabsContent value="pending" className="mt-6">
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Package className="h-16 w-16 mb-4 opacity-30" />
              <p className="text-sm">発送待ちの商品がありません</p>
            </div>
          </TabsContent>

          <TabsContent value="shipped" className="mt-6">
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Package className="h-16 w-16 mb-4 opacity-30" />
              <p className="text-sm">発送済みの商品がありません</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default Inventory;
