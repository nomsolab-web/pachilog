function PrivacyPage() {
  return (
    <article className="max-w-3xl">
      <h1 className="font-display font-extrabold text-3xl mb-4">プライバシーポリシー</h1>
      <div className="space-y-5 text-sm leading-7 text-muted-foreground">
        <section>
          <h2 className="font-display font-semibold text-lg text-foreground mb-2">取得する情報</h2>
          <p>
            当サイトは、投票機能の重複防止や不正利用対策のため、ブラウザから生成される識別情報を利用する場合があります。
          </p>
        </section>
        <section>
          <h2 className="font-display font-semibold text-lg text-foreground mb-2">利用目的</h2>
          <p>
            取得した情報は、サイト機能の提供、集計精度の維持、アクセス状況の把握、障害調査の目的で利用します。
          </p>
        </section>
        <section>
          <h2 className="font-display font-semibold text-lg text-foreground mb-2">第三者提供</h2>
          <p>
            法令に基づく場合を除き、取得した情報を本人の同意なく第三者へ提供しません。
          </p>
        </section>
      </div>
    </article>
  );
}

export default PrivacyPage;
