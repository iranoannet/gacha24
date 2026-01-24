import MainLayout from "@/components/layout/MainLayout";
import { MessageSquare } from "lucide-react";

const Reports = () => {
  return (
    <MainLayout>
      <div className="container px-4 py-6">
        <h1 className="text-xl font-bold mb-4 flex items-center gap-2">
          みんなの当選報告 <span>🎉</span>
        </h1>

        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <MessageSquare className="h-16 w-16 mb-4 opacity-30" />
          <p className="text-sm text-center">
            まだ当選報告がありません
            <br />
            ガチャを引いてSNSにシェアしよう！
          </p>
        </div>
      </div>
    </MainLayout>
  );
};

export default Reports;
