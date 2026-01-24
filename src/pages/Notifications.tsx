import { useState } from "react";
import { useNavigate } from "react-router-dom";
import MainLayout from "@/components/layout/MainLayout";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, ChevronRight, Megaphone } from "lucide-react";

interface Notification {
  id: string;
  title: string;
  date: string;
  isRead: boolean;
  type: "personal" | "public";
}

const Notifications = () => {
  const navigate = useNavigate();
  
  // Mock data - replace with actual data from Supabase
  const [notifications] = useState<Notification[]>([
    {
      id: "1",
      title: "【重要】メンテナンスのお知らせ",
      date: "2024/01/24",
      isRead: false,
      type: "public",
    },
    {
      id: "2",
      title: "新しいガチャが追加されました",
      date: "2024/01/23",
      isRead: true,
      type: "public",
    },
    {
      id: "3",
      title: "【期間限定】新春キャンペーン開催中！",
      date: "2024/01/20",
      isRead: true,
      type: "public",
    },
  ]);

  const personalNotifications = notifications.filter(n => n.type === "personal");
  const publicNotifications = notifications.filter(n => n.type === "public");

  const NotificationList = ({ items }: { items: Notification[] }) => (
    <div className="space-y-2">
      {items.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground text-sm">お知らせはありません</p>
        </Card>
      ) : (
        items.map((notification) => (
          <Card
            key={notification.id}
            className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => navigate(`/notifications/${notification.id}`)}
          >
            <div className="flex items-start gap-3">
              <div className={`h-2 w-2 rounded-full mt-2 flex-shrink-0 ${
                notification.isRead ? "bg-muted" : "bg-primary"
              }`} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${notification.isRead ? "text-muted-foreground" : "text-foreground font-medium"}`}>
                  {notification.title}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{notification.date}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </div>
          </Card>
        ))
      )}
    </div>
  );

  return (
    <MainLayout>
      <div className="container px-4 py-6 max-w-2xl mx-auto">
        <h1 className="text-xl font-bold mb-6">お知らせ</h1>

        <Tabs defaultValue="personal" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="personal" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              あなた宛て
            </TabsTrigger>
            <TabsTrigger value="public" className="flex items-center gap-2">
              <Megaphone className="h-4 w-4" />
              全体
            </TabsTrigger>
          </TabsList>

          <TabsContent value="personal">
            <NotificationList items={personalNotifications} />
          </TabsContent>

          <TabsContent value="public">
            <NotificationList items={publicNotifications} />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default Notifications;
