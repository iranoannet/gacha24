import { useNavigate } from "react-router-dom";
import MainLayout from "@/components/layout/MainLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { HelpCircle, Mail, MessageCircle } from "lucide-react";

const FAQ = () => {
  const navigate = useNavigate();

  const faqCategories = [
    {
      title: "ガチャについて",
      items: [
        {
          question: "ガチャの仕組みを教えてください",
          answer: "ガチャは1回ごとにポイントを消費して抽選を行います。各ガチャには設定された排出確率があり、その確率に基づいてカードが排出されます。",
        },
        {
          question: "当たったカードはどうなりますか？",
          answer: "当たったカードはインベントリに保存されます。インベントリから「発送依頼」「ポイント変換」を選択できます。",
        },
        {
          question: "確率はどこで確認できますか？",
          answer: "各ガチャの詳細ページに排出確率が表示されています。ガチャを回す前に必ずご確認ください。",
        },
      ],
    },
    {
      title: "ポイントについて",
      items: [
        {
          question: "ポイントの購入方法を教えてください",
          answer: "マイページから「ポイント購入」を選択し、クレジットカードまたは各種決済方法でポイントを購入できます。",
        },
        {
          question: "ポイントの有効期限はありますか？",
          answer: "購入したポイントに有効期限はありません。ただし、キャンペーン等で付与されたボーナスポイントには有効期限がある場合があります。",
        },
        {
          question: "ポイントの返金はできますか？",
          answer: "購入済みのポイントは原則として返金できません。詳しくは利用規約をご確認ください。",
        },
      ],
    },
    {
      title: "配送について",
      items: [
        {
          question: "配送にかかる日数を教えてください",
          answer: "発送依頼後、通常7営業日以内に発送いたします。配送状況はマイページの「購入履歴」からご確認いただけます。",
        },
        {
          question: "配送先を変更したいです",
          answer: "発送依頼前であれば、マイページの「お届け先の登録」から配送先を変更できます。発送依頼後の変更はお問い合わせください。",
        },
        {
          question: "海外への配送は対応していますか？",
          answer: "現在、海外への配送は対応しておりません。日本国内のみの配送となります。",
        },
      ],
    },
    {
      title: "アカウントについて",
      items: [
        {
          question: "パスワードを忘れました",
          answer: "ログイン画面の「パスワードをお忘れの方」から、メールアドレスを入力してパスワードリセットを行ってください。",
        },
        {
          question: "退会したいです",
          answer: "退会をご希望の場合は、お問い合わせフォームよりご連絡ください。退会後はデータの復旧ができませんのでご注意ください。",
        },
        {
          question: "メールアドレスを変更したいです",
          answer: "マイページの「メールアドレス変更」から変更手続きを行ってください。変更後、新しいメールアドレスに確認メールが送信されます。",
        },
      ],
    },
  ];

  return (
    <MainLayout>
      <div className="container px-4 py-6 max-w-2xl mx-auto">
        <h1 className="text-xl font-bold mb-6">よくある質問</h1>

        <div className="space-y-6">
          {faqCategories.map((category, categoryIndex) => (
            <div key={categoryIndex}>
              <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-primary" />
                {category.title}
              </h2>
              <Card>
                <Accordion type="single" collapsible className="w-full">
                  {category.items.map((item, itemIndex) => (
                    <AccordionItem key={itemIndex} value={`${categoryIndex}-${itemIndex}`}>
                      <AccordionTrigger className="px-4 text-left text-sm">
                        {item.question}
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4 text-sm text-muted-foreground">
                        {item.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </Card>
            </div>
          ))}
        </div>

        <Card className="p-6 mt-8">
          <div className="text-center">
            <MessageCircle className="h-10 w-10 text-primary mx-auto mb-3" />
            <h3 className="font-bold text-foreground mb-2">解決しない場合</h3>
            <p className="text-sm text-muted-foreground mb-4">
              お問い合わせフォームからご連絡ください
            </p>
            <Button asChild className="w-full">
              <a href="mailto:support@example.com">
                <Mail className="h-4 w-4 mr-2" />
                お問い合わせ
              </a>
            </Button>
          </div>
        </Card>
      </div>
    </MainLayout>
  );
};

export default FAQ;
