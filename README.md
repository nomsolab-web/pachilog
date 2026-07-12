# パチログ (PachiLog)

パチスロ・パチンコ系YouTuberのチャンネル登録者数・再生数の推移を毎日自動収集して可視化するトラッカーサイト。ランキング、投票、Xシェア、新台バズ指数機能付き。

Monorepo: Bun workspaces + Turborepo (Bun, Vite, React, Hono, Drizzle).

## Setup

```bash
bun install
cp .env.template .env   # fill in DATABASE_URL / DATABASE_AUTH_TOKEN / YOUTUBE_API_KEY / COLLECT_SECRET_TOKEN
cd packages/web && bun run db:push
bun run dev
```

## Docs

- `design.md` — design system / トンマナ
- `task.md` — 実装ログ・残タスク

See `packages/web/README.md` for server details.
