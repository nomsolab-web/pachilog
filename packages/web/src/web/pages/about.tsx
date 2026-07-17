function AboutPage() {
  return (
    <article className="max-w-3xl">
      <h1 className="font-display font-extrabold text-3xl mb-4">パチパルス！について</h1>
      <div className="space-y-4 text-sm leading-7 text-muted-foreground">
        <p>
          パチパルス！(PachiPulse) は、パチンコ・パチスロ系YouTubeチャンネルの公開データを日次で記録し、登録者数や再生数の変化を見やすく整理するデータメディアです。
        </p>
        <p>
          ランキングはチャンネルの人気や価値を断定するものではありません。短期的な伸びや変化を把握するための参考情報として提供しています。
        </p>
        <p>当サイトでは、攻略情報、期待値情報、出玉結果、投資判断に関わる情報は扱いません。</p>
      </div>
    </article>
  );
}

export default AboutPage;
