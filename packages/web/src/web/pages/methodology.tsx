function MethodologyPage() {
  return (
    <article className="max-w-3xl">
      <h1 className="font-display font-extrabold text-3xl mb-4">ランキングの集計方法</h1>
      <div className="space-y-5 text-sm leading-7 text-muted-foreground">
        <section>
          <h2 className="font-display font-semibold text-lg text-foreground mb-2">チャンネルランキング</h2>
          <p>
            登録対象チャンネルの公開されている登録者数を定期的に取得し、指定期間の最初のデータと最新データの差分で並べ替えています。
          </p>
        </section>
        <section>
          <h2 className="font-display font-semibold text-lg text-foreground mb-2">データ蓄積中の表示</h2>
          <p>
            初回取得分しかないチャンネルは期間内の比較対象がないため、増減率の代わりに「データ蓄積中」と表示します。
          </p>
        </section>
        <section>
          <h2 className="font-display font-semibold text-lg text-foreground mb-2">新台バズランキング</h2>
          <p>
            登録チャンネルの関連動画から新台名の言及を集計し、動画数や再生数をもとに話題量を整理しています。
          </p>
        </section>
        <section>
          <h2 className="font-display font-semibold text-lg text-foreground mb-2">注意事項</h2>
          <p>
            YouTube側の公開値の丸め、取得タイミング、チャンネル名や動画情報の変更により、表示値が実際の画面とずれる場合があります。
          </p>
        </section>
      </div>
    </article>
  );
}

export default MethodologyPage;
