import { useNavigate } from "react-router-dom";
import MainLayout from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, ExternalLink, Gift, Bell, Ticket } from "lucide-react";

const LineFriend = () => {
  const navigate = useNavigate();

  const benefits = [
    {
      icon: Gift,
      title: "友達登録限定クーポン",
      description: "友達登録で使えるお得なクーポンをプレゼント",
    },
    {
      icon: Bell,
      title: "新着情報をお届け",
      description: "新しいガチャやキャンペーン情報をいち早くお届け",
    },
    {
      icon: Ticket,
      title: "限定イベント参加権",
      description: "LINE友達限定のイベントに参加できます",
    },
  ];

  return (
    <MainLayout>
      <div className="container px-4 py-6 max-w-2xl mx-auto">
        <button
          onClick={() => navigate("/mypage")}
          className="flex items-center gap-2 text-muted-foreground mb-4 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="text-sm">マイページに戻る</span>
        </button>

        <h1 className="text-xl font-bold mb-6">LINE友達登録</h1>

        <Card className="p-6 mb-6">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[#00B900] mb-4">
              <svg viewBox="0 0 24 24" className="w-12 h-12 text-white fill-current">
                <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-foreground mb-2">公式LINEを友達追加</h2>
            <p className="text-sm text-muted-foreground">
              友達登録でお得な情報をゲット！
            </p>
          </div>

          {/* QR Code placeholder */}
          <div className="bg-white p-4 rounded-lg mb-6 mx-auto w-fit">
            <div className="w-40 h-40 bg-muted flex items-center justify-center rounded">
              <p className="text-xs text-muted-foreground text-center">
                QRコード<br />準備中
              </p>
            </div>
          </div>

          <Button className="w-full bg-[#00B900] hover:bg-[#00A000]" asChild>
            <a href="https://line.me" target="_blank" rel="noopener noreferrer">
              LINEで友達追加
              <ExternalLink className="h-4 w-4 ml-2" />
            </a>
          </Button>
        </Card>

        <h2 className="text-sm font-bold text-foreground mb-3">友達登録の特典</h2>
        <div className="space-y-3">
          {benefits.map((benefit, index) => (
            <Card key={index} className="p-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <benefit.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">{benefit.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{benefit.description}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </MainLayout>
  );
};

export default LineFriend;
