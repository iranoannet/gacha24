import { useNavigate, useParams } from "react-router-dom";
import MainLayout from "@/components/layout/MainLayout";
import { Card } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

const NotificationDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();

  // Mock data - replace with actual data from Supabase
  const notification = {
    id: id,
    title: "【重要】メンテナンスのお知らせ",
    date: "2024/01/24",
    content: `いつもご利用いただきありがとうございます。

下記日程でサーバーメンテナンスを実施いたします。

■メンテナンス日時
2024年1月25日（木）02:00〜06:00

■影響範囲
メンテナンス中は全てのサービスをご利用いただけません。

■注意事項
・メンテナンス開始前にプレイ中のガチャは完了させてください
・メンテナンス終了時間は前後する場合があります

ご不便をおかけいたしますが、何卒ご理解のほどよろしくお願いいたします。`,
  };

  return (
    <MainLayout>
      <div className="container px-4 py-6 max-w-2xl mx-auto">
        <button
          onClick={() => navigate("/notifications")}
          className="flex items-center gap-2 text-muted-foreground mb-4 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="text-sm">お知らせ一覧に戻る</span>
        </button>

        <Card className="p-6">
          <div className="border-b pb-4 mb-4">
            <p className="text-xs text-muted-foreground mb-2">{notification.date}</p>
            <h1 className="text-lg font-bold text-foreground">{notification.title}</h1>
          </div>

          <div className="prose prose-sm max-w-none">
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
              {notification.content}
            </p>
          </div>
        </Card>
      </div>
    </MainLayout>
  );
};

export default NotificationDetail;
