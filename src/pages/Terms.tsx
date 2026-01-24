import MainLayout from "@/components/layout/MainLayout";
import { Card } from "@/components/ui/card";

const Terms = () => {
  return (
    <MainLayout>
      <div className="container px-4 py-6 max-w-2xl mx-auto">
        <h1 className="text-xl font-bold mb-6">利用規約</h1>

        <Card className="p-6">
          <div className="prose prose-sm max-w-none text-foreground">
            <p className="text-muted-foreground mb-6">
              この利用規約（以下「本規約」）は、当サービス（以下「本サービス」）の利用条件を定めるものです。ユーザーの皆様には、本規約に従って本サービスをご利用いただきます。
            </p>

            <section className="mb-6">
              <h2 className="text-lg font-bold mb-3">第1条（適用）</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                本規約は、ユーザーと当社との間の本サービスの利用に関わる一切の関係に適用されるものとします。
              </p>
            </section>

            <section className="mb-6">
              <h2 className="text-lg font-bold mb-3">第2条（利用登録）</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                登録希望者が当社の定める方法によって利用登録を申請し、当社がこれを承認することによって、利用登録が完了するものとします。当社は、以下の場合には利用登録を拒否することがあります。
              </p>
              <ul className="list-disc pl-5 mt-2 text-sm text-muted-foreground space-y-1">
                <li>虚偽の事項を届け出た場合</li>
                <li>本規約に違反したことがある者からの申請である場合</li>
                <li>その他、当社が利用登録を相当でないと判断した場合</li>
              </ul>
            </section>

            <section className="mb-6">
              <h2 className="text-lg font-bold mb-3">第3条（禁止事項）</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                ユーザーは、本サービスの利用にあたり、以下の行為をしてはなりません。
              </p>
              <ul className="list-disc pl-5 mt-2 text-sm text-muted-foreground space-y-1">
                <li>法令または公序良俗に違反する行為</li>
                <li>犯罪行為に関連する行為</li>
                <li>当社のサーバーまたはネットワークの機能を破壊したり、妨害したりする行為</li>
                <li>当社のサービスの運営を妨害するおそれのある行為</li>
                <li>他のユーザーに関する個人情報等を収集または蓄積する行為</li>
                <li>他のユーザーに成りすます行為</li>
                <li>当社のサービスに関連して、反社会的勢力に対して直接または間接に利益を供与する行為</li>
                <li>その他、当社が不適切と判断する行為</li>
              </ul>
            </section>

            <section className="mb-6">
              <h2 className="text-lg font-bold mb-3">第4条（本サービスの提供の停止等）</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                当社は、以下のいずれかの事由があると判断した場合、ユーザーに事前に通知することなく本サービスの全部または一部の提供を停止または中断することができるものとします。
              </p>
              <ul className="list-disc pl-5 mt-2 text-sm text-muted-foreground space-y-1">
                <li>本サービスにかかるコンピュータシステムの保守点検または更新を行う場合</li>
                <li>地震、落雷、火災、停電または天災などの不可抗力により、本サービスの提供が困難となった場合</li>
                <li>コンピュータまたは通信回線等が事故により停止した場合</li>
                <li>その他、当社が本サービスの提供が困難と判断した場合</li>
              </ul>
            </section>

            <section className="mb-6">
              <h2 className="text-lg font-bold mb-3">第5条（免責事項）</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                当社は、本サービスに事実上または法律上の瑕疵（安全性、信頼性、正確性、完全性、有効性、特定の目的への適合性、セキュリティなどに関する欠陥、エラーやバグ、権利侵害などを含みます。）がないことを明示的にも黙示的にも保証しておりません。
              </p>
            </section>

            <section className="mb-6">
              <h2 className="text-lg font-bold mb-3">第6条（サービス内容の変更等）</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                当社は、ユーザーに通知することなく、本サービスの内容を変更しまたは本サービスの提供を中止することができるものとし、これによってユーザーに生じた損害について一切の責任を負いません。
              </p>
            </section>

            <section className="mb-6">
              <h2 className="text-lg font-bold mb-3">第7条（利用規約の変更）</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                当社は、必要と判断した場合には、ユーザーに通知することなくいつでも本規約を変更することができるものとします。変更後の利用規約は、当社ウェブサイトに掲載したときから効力を生じるものとします。
              </p>
            </section>

            <section className="mb-6">
              <h2 className="text-lg font-bold mb-3">第8条（準拠法・裁判管轄）</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                本規約の解釈にあたっては、日本法を準拠法とします。本サービスに関して紛争が生じた場合には、当社の本店所在地を管轄する裁判所を専属的合意管轄とします。
              </p>
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

export default Terms;
