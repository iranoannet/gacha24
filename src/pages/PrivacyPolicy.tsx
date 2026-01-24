import MainLayout from "@/components/layout/MainLayout";
import { Card } from "@/components/ui/card";

const PrivacyPolicy = () => {
  return (
    <MainLayout>
      <div className="container px-4 py-6 max-w-2xl mx-auto">
        <h1 className="text-xl font-bold mb-6">プライバシーポリシー</h1>

        <Card className="p-6">
          <div className="prose prose-sm max-w-none text-foreground">
            <p className="text-muted-foreground mb-6">
              本プライバシーポリシーは、当サービス（以下「本サービス」）における、ユーザーの個人情報の取扱いについて定めるものです。
            </p>

            <section className="mb-6">
              <h2 className="text-lg font-bold mb-3">第1条（個人情報の収集）</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                当社は、本サービスの提供にあたり、以下の個人情報を収集することがあります。
              </p>
              <ul className="list-disc pl-5 mt-2 text-sm text-muted-foreground space-y-1">
                <li>氏名、住所、電話番号、メールアドレス等の連絡先情報</li>
                <li>生年月日、性別等の属性情報</li>
                <li>クレジットカード情報等の決済に関する情報</li>
                <li>サービスの利用履歴、購入履歴</li>
                <li>IPアドレス、Cookie情報、端末情報</li>
              </ul>
            </section>

            <section className="mb-6">
              <h2 className="text-lg font-bold mb-3">第2条（個人情報の利用目的）</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                当社は、収集した個人情報を以下の目的で利用します。
              </p>
              <ul className="list-disc pl-5 mt-2 text-sm text-muted-foreground space-y-1">
                <li>本サービスの提供・運営</li>
                <li>ユーザーからのお問い合わせへの対応</li>
                <li>商品の配送、決済処理</li>
                <li>利用規約に違反したユーザーの特定および利用停止</li>
                <li>サービス改善のための分析</li>
                <li>新機能、キャンペーン等のお知らせ</li>
              </ul>
            </section>

            <section className="mb-6">
              <h2 className="text-lg font-bold mb-3">第3条（個人情報の第三者提供）</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                当社は、以下の場合を除き、ユーザーの同意なく個人情報を第三者に提供することはありません。
              </p>
              <ul className="list-disc pl-5 mt-2 text-sm text-muted-foreground space-y-1">
                <li>法令に基づく場合</li>
                <li>人の生命、身体または財産の保護のために必要な場合</li>
                <li>公衆衛生の向上または児童の健全な育成の推進のために必要な場合</li>
                <li>国の機関等への協力が必要な場合</li>
              </ul>
            </section>

            <section className="mb-6">
              <h2 className="text-lg font-bold mb-3">第4条（個人情報の安全管理）</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                当社は、個人情報の漏洩、滅失、毀損の防止その他の安全管理のために、必要かつ適切な措置を講じます。また、個人情報を取り扱う従業員に対して、適切な監督を行います。
              </p>
            </section>

            <section className="mb-6">
              <h2 className="text-lg font-bold mb-3">第5条（個人情報の開示・訂正・削除）</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                ユーザーは、当社に対し、自己の個人情報の開示、訂正、削除を請求することができます。請求があった場合、当社は本人確認を行った上で、合理的な期間内に対応いたします。
              </p>
            </section>

            <section className="mb-6">
              <h2 className="text-lg font-bold mb-3">第6条（Cookieの使用）</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                本サービスでは、サービス向上のためCookieを使用することがあります。ユーザーはブラウザの設定によりCookieを無効にすることができますが、一部のサービスが利用できなくなる場合があります。
              </p>
            </section>

            <section className="mb-6">
              <h2 className="text-lg font-bold mb-3">第7条（プライバシーポリシーの変更）</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                当社は、必要に応じて本ポリシーを変更することがあります。変更後のプライバシーポリシーは、本サービス上に掲載した時点から効力を生じるものとします。
              </p>
            </section>

            <section className="mb-6">
              <h2 className="text-lg font-bold mb-3">第8条（お問い合わせ窓口）</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                本ポリシーに関するお問い合わせは、下記の窓口までお願いいたします。
              </p>
              <div className="mt-3 p-4 bg-muted rounded-lg text-sm">
                <p className="text-foreground">運営事務局</p>
                <p className="text-muted-foreground">メール: support@example.com</p>
              </div>
            </section>

            <p className="text-xs text-muted-foreground text-right mt-8">
              制定日：2024年1月1日<br />
              最終改定日：2024年1月1日
            </p>
          </div>
        </Card>
      </div>
    </MainLayout>
  );
};

export default PrivacyPolicy;
