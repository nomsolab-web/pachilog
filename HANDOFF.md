# 引継ぎメモ (HANDOFF)

他のAIツール(Codex, Gemini等)やエンジニアがこのプロジェクトを引き継ぐ際に読むドキュメント。
まず [SPEC.md](./SPEC.md)(仕様)、[README.md](./README.md)(セットアップ)、[design.md](./design.md)(デザイン方針)を参照。このファイルは「現状のスナップショットと次にやること」に特化。

## プロジェクトの一言要約

パチスロ・パチンコ系YouTuberのチャンネル登録者数・再生数の推移と、新台の話題性(バズ)を自動収集して可視化するデータトラッカーサイト「パチログ」。**攻略・期待値・立ち回りは一切扱わない**(投機・ギャンブル助長NGという運営者の方針)。収益はGoogle AdSenseを想定。

## 現状のステータス(2026-07-12時点)

- **開発環境:** Runable(Bun + Vite + React + Hono + Drizzle のマネージドテンプレート)上で構築、動作確認済み
- **コード管理:** GitHub `nomsolab-web/pachilog`(private)にプッシュ済み。最新状態
- **データ収集:** YouTube Data API v3で17チャンネル分の登録者数収集済み、新台バズ機能も5機種で動作確認済み(1機種で実際にバズデータ検出)
- **公開:** まだ本番公開していない。Runable上のプレビュー環境で動作確認のみ
- **移行方針決定:** RunableのStarterプラン($25/月)を更新せず、**Google Cloud Run(無料枠) + Turso(既存DBそのまま)への移行**で進める方針が確定。[DEPLOY_GCP.md](./DEPLOY_GCP.md)に手順書あり(min-instances=0, max-instances=1, budget alert必須)。**ただし未実施・Dockerfileはビルド未検証**
- 投票API(`POST /api/channels/:id/votes`, `POST /api/machines/:id/votes`)には簡易レート制限(1IPあたり1分5回)を追加済み(`packages/web/src/api/middleware/rate-limit.ts`)。max-instances=1前提のシングルインスタンス簡易実装なので、将来スケールする場合は共有ストア(Redis/Upstash等)への置き換えが必要

## アーキテクチャ概要

```
packages/web/
  src/api/            Hono API (.basePath('api'))
    database/schema.ts  Drizzleスキーマ(6テーブル)
    routes/             channels, rankings, collect, machines, collect-machines
    lib/youtube.ts       YouTube Data API v3 クライアント(検索API不使用、quota節約設計)
    data/                シード・メンテナンススクリプト群
  src/web/            Reactフロントエンド(Wouter routing, TanStack Query, Tailwind4)
    pages/index.tsx      チャンネル推移ランキング(トップページ)
    pages/channel.tsx    チャンネル詳細(グラフ・投票・Xシェア)
    pages/machines.tsx   新台バズランキング
    pages/machine.tsx    新台詳細(関連動画・投票)
```

DB: Turso(libSQL)。`DATABASE_URL` / `DATABASE_AUTH_TOKEN` で接続(GCPに移行してもTursoはそのまま使える)。

## 必須の環境変数(`.env`、リポジトリには含まれていない)

| 変数 | 用途 | 備考 |
|---|---|---|
| `DATABASE_URL` / `DATABASE_AUTH_TOKEN` | Turso接続 | Runable発行のものをそのまま使用中 |
| `YOUTUBE_API_KEY` | YouTube Data API v3 | Google Cloud Consoleで取得済み(無料枠運用) |
| `COLLECT_SECRET_TOKEN` | 収集バッチ認証用トークン | ランダム生成済み。値は運営者(のむさん)が保持 |

**値そのものはこのファイルに書いていない。** 実際の値は運営者の手元の`.env`、またはRunableのプロジェクト設定から取得すること。

## 今すぐ引き継いで着手できるタスク

優先度順:

1. **n8nでの定期実行設定(未完了)**
   - `POST /api/collect/run` と `POST /api/collect-machines/run` を毎日1回叩くCronワークフローがまだ設定されていない
   - ヘッダー `x-collect-secret` に `.env` の `COLLECT_SECRET_TOKEN` と同じ値を設定
   - 現状は手動でcurlを叩いて動作確認しただけ

2. **新台マスターデータの拡充**
   - 今は`packages/web/src/api/data/seed-machines.ts`に5件のみ手動シード
   - メーカー公式サイト(SANKYO, SANYO, サンセイR&D等)から新台情報を収集し、週次で追加する運用が必要
   - 自動化する場合は各メーカーサイトのHTML構造調査が別途必要(未着手)

3. **Cloud Run移行の実施(方針確定・未実施)**
   - [DEPLOY_GCP.md](./DEPLOY_GCP.md)に手順書あり(min-instances=0, max-instances=1, budget alert必須)
   - `Dockerfile`はサンドボックスにDockerが無く**ビルド未検証**。まずローカルで`docker build`が通るか確認すること
   - Runableの契約更新はしない方針。契約が切れるまでの残り日数次第で優先度が変わる可能性がある

4. **本番公開(未実施)**
   - Runableのままいくなら「公開(Deploy)」ボタンから本番URL発行 → 環境変数を本番側に設定
   - GCPに移すならDEPLOY_GCP.mdの手順で実施

5. **独自ドメイン取得(AdSense申請の前提)**
   - 無料サブドメインのままだとAdSense審査が通りにくいため、コンテンツとアクセスが育ってきたら取得を検討

## 既知の課題・注意点

- `packages/web/src/api/data/seed-channels.ts` に登録したチャンネルの`@handle`は、Web検索調査ベースで初期登録したため一部誤りがあった。`fix-handles.ts` / `fix-handles-2.ts` で修正済みだが、新規追加時は必ず実際のYouTube URLからhandleを確認すること
- `collect-machines`の動画タイトル⇔機種名マッチングは単純な部分一致。表記ゆれで取りこぼす可能性がある(現状1/5機種のみヒット)
- YouTube検索API(`search.list`、100ユニット/回)は意図的に不使用。`channels.list`/`playlistItems.list`/`videos.list`(各1ユニット/回)のみで構成し、無料枠(1日10,000ユニット)内に収める設計。新機能追加時もこの制約を意識すること
- 決済機能(Stripe等)は未実装・不要(広告収益のみの設計)
- モバイルアプリ化・マイルストーン表示機能はバックログ(未着手)

## 運営者(依頼者)の制約・方針(重要)

- 投機・ギャンブル助長・攻略情報は一切扱わない方針。機能追加時もこの方針を厳守すること
- 初期投資ほぼゼロ、1日1〜2時間の作業時間という制約があるため、運用の手間が増える提案(自前インフラ管理など)は必ずメリット・デメリットを明示すること
- リスクを取れない状況(自己破産手続き中)のため、課金・契約に関わる提案は特に慎重に、正直に伝えること
