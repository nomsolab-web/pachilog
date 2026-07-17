# パチパルス！ (PachiPulse)

パチスロ・パチンコ系YouTube動画、チャンネル、新台の伸びを毎日集計するデータメディア。
ランキング、投票、Xシェア、新台バズ指数機能付き。攻略・期待値・立ち回りは一切扱わない。

詳しい仕様は [SPEC.md](./SPEC.md) を参照。デザイン方針は [design.md](./design.md) を参照。

## スタック

Bun workspaces + Turborepo によるモノレポ。

- **Web:** Vite 7 dev server — React フロントエンド(`/*`)と Hono API(`/api/*`)を単一ポートで配信
- **API:** Hono + Drizzle ORM + Turso (libSQL)
- **Frontend:** React 19 + Wouter + Tailwind CSS 4 + Recharts
- **Mobile/Desktop:** Expo / Electron の雛形あり(未使用、将来拡張用)

## セットアップ

```bash
git clone https://github.com/nomsolab-web/pachilog.git
cd pachilog
bun install
cp .env.template .env   # 下記の環境変数を埋める
cd packages/web && bun run db:push
cd ../.. && bun run dev
```

### 必要な環境変数 (`.env`)

| 変数 | 用途 |
|---|---|
| `DATABASE_URL` / `DATABASE_AUTH_TOKEN` | Turso(libSQL) DB接続情報 |
| `YOUTUBE_API_KEY` | YouTube Data API v3 キー(Google Cloud Consoleで取得、無料枠で十分) |
| `COLLECT_SECRET_TOKEN` | データ収集エンドポイントを外部(n8n等)から叩く際の認証トークン(任意の文字列) |

## 開発コマンド

```bash
bun run dev          # Web(API+フロントエンド)を起動
cd packages/web
bun run db:push       # スキーマをDBに反映
bun run db:studio     # Drizzle Studioでデータ確認
```

## データ投入・メンテナンススクリプト

`packages/web/src/api/data/` 配下。`bun --env-file=../../.env <file>` で実行。

- `seed.ts` — 初期チャンネルリストを投入
- `seed-machines.ts` / `seed-machines-run.ts` — 新台マスターデータを投入
- `fix-handles.ts` / `fix-handles-2.ts` — チャンネルの@handle誤り修正(履歴として残置)
- `clear-bad-snapshots.ts` — 誤収集したスナップショットの削除(履歴として残置)

## データ収集の運用

`POST /api/collect/run` と `POST /api/collect-machines/run` を、n8nなど外部のCronから毎日1回叩く。
ヘッダー `x-collect-secret` に `.env` の `COLLECT_SECRET_TOKEN` と同じ値を設定すること。詳細は [SPEC.md](./SPEC.md#データ収集運用) を参照。
