# パチログ (PachiLog) 仕様書

## 1. 概要

パチスロ・パチンコ系YouTuberの「チャンネル登録者数・再生数の推移」と「新台の話題性(バズ)」を自動収集・可視化するデータトラッカーサイト。

**明確な非対象:** 攻略・期待値・設定判別・立ち回りは一切扱わない。扱うのは公開されている統計データ(登録者数・再生数・投稿数)と、来訪者による任意のアンケート投票のみ。

**モデルの着想元:** 「ソーシャルXP」(X/Twitterのフォロワー推移を自動収集し、Xシェア機能でバイラルループを作るサイト)の構造を、パチスロ・パチンコ系YouTuberというニッチに転用したもの。SEOに依存せず、X上でのシェアから回遊するのが集客の主軸。

## 2. ターゲットとポジショニング

- 大手新台情報サイト(P-WORLD、DMMぱちタウン等)は「スペック・導入日・攻略情報」を扱うが、「YouTuber個人の登録者数推移」「動画の話題性」「来訪者の生の関心度」は扱っていない
- 本サイトはその隙間を埋める、"データ分析ダッシュボード"としてのポジション
- 収益モデル: Google AdSense(将来)。ユーザーの入力・APIキー等は一切預からないため、セキュリティ・プライバシー面のリスクが低い設計

## 3. 機能一覧

### 3.1 チャンネル推移トラッカー(v1)
- トップページ: 急上昇/急降下ランキング(7日/30日/90日切替)
- チャンネル個別ページ: 登録者数・再生数の推移グラフ(Recharts)
- 好き/嫌い/わからない投票(チャンネルに対する任意アンケート、localStorage発行のfingerprintで簡易重複防止)
- Xシェア: canvas生成した画像のダウンロード + X intent URLでのポスト

### 3.2 新台バズ指数(v2で追加)
- 新台(機種)ごとに、対象YouTuberチャンネルの動画がどれだけ再生されているかを集計し「バズランキング」として表示
- 機種詳細ページ: 関連動画一覧(再生数・いいね・コメント数)、「打ってみたい/様子見/興味なし」投票
- 機種のマスターデータ(名称・メーカー・導入日)は事実情報のみ。期待値・攻略情報は含めない

## 4. データベース設計 (`packages/web/src/api/database/schema.ts`)

| テーブル | 役割 |
|---|---|
| `channels` | 追跡対象チャンネル。`youtube_channel_id`(APIから解決), `handle`(@ハンドル), `name`, `thumbnail_url`, `active` |
| `channel_snapshots` | 日次スナップショット。`channel_id` + `date` でユニーク。登録者数・再生数・動画数 |
| `votes` | チャンネルへの投票(good/bad/unknown)。`voter_fingerprint` で1人1票を緩く担保 |
| `machines` | 新台マスター。`name`, `maker`, `release_date`, `source_url`(メーカー公式) |
| `machine_mentions` | 新台と動画の紐付け。`machine_id` + `video_id` でユニーク。再生数・いいね・コメント数を保持 |
| `machine_votes` | 新台への投票(want_to_play/wait_and_see/not_interested) |

## 5. API ルート (`packages/web/src/api/index.ts` から `.route()` で分割)

| メソッド/パス | 説明 |
|---|---|
| `GET /api/channels` | チャンネル一覧+直近の増減 |
| `GET /api/channels/:id` | チャンネル詳細+全スナップショット履歴 |
| `GET /api/channels/:id/votes` / `POST` | 投票の取得・登録 |
| `GET /api/rankings?period=7\|30\|90` | 急上昇/急降下ランキング |
| `POST /api/collect/run` | **チャンネル収集バッチ**(要 `x-collect-secret` ヘッダー) |
| `GET /api/machines` | 新台一覧+バズ指数(合計再生数・動画数) |
| `GET /api/machines/:id` | 新台詳細+関連動画一覧 |
| `GET /api/machines/:id/votes` / `POST` | 新台投票の取得・登録 |
| `POST /api/collect-machines/run` | **新台バズ収集バッチ**(要 `x-collect-secret` ヘッダー) |

## 6. データ収集運用

### 6.1 チャンネル収集 (`/api/collect/run`)
1. `youtube_channel_id` 未解決のアクティブチャンネルを `channels.list?forHandle=` で解決(1ユニット/件)
2. 解決済み全チャンネルを最大50件ずつ `channels.list?id=` でバッチ取得(1ユニット/50件)
3. 当日分の `channel_snapshots` が無ければ挿入。重複挿入は防止(unique制約)

### 6.2 新台バズ収集 (`/api/collect-machines/run`)
1. 各アクティブチャンネルの「アップロード再生リストID」を取得(`channels.list?part=contentDetails`)
2. `playlistItems.list` で直近動画(既定25件)のタイトル一覧を取得
3. `machines.name` がタイトルに部分一致する動画を抽出
4. 該当動画の統計(再生数・いいね・コメント数)を `videos.list` でバッチ取得し `machine_mentions` にupsert

**quota設計の意図:** YouTube検索API(`search.list`)は100ユニット/回と高額なため一切使用しない。すべて `channels.list`(1) / `playlistItems.list`(1) / `videos.list`(1) の安価なエンドポイントのみで構成し、無料枠(1日10,000ユニット)に確実に収まるようにしている。

### 6.3 外部からの起動(n8n想定)
n8nでワークフローを作成:
- Cronノード(毎日1回) → HTTP RequestノードでPOST
  - `https://<公開URL>/api/collect/run`
  - `https://<公開URL>/api/collect-machines/run`
  - ヘッダー: `x-collect-secret: <.envのCOLLECT_SECRET_TOKENと同じ値>`

## 7. デザイン方針

`design.md` を参照。ダークテーマ+ネオンアクセント(急上昇=緑、急降下=赤、強調=金)。フォントは Noto Sans JP(本文) + Poppins(数値)。ギャンブル的な演出は避け、データ分析ツールとしてのクリーンなトーンを維持。

## 8. 既知の制約・今後の課題

- 新台マスターデータ(`machines`)は手動シード。メーカー公式サイトを週次で確認して追加する運用(自動化する場合は各メーカーサイトのHTML構造調査が別途必要)
- 動画タイトルと機種名のマッチングは単純な部分一致。表記ゆれ(略称・スペース有無)による取りこぼしがあるため、運用しながらエイリアス対応の追加を検討
- チャンネルの@handleは検索調査ベースで初期登録しており、一部誤りがあった(`fix-handles.ts` / `fix-handles-2.ts` で修正済み)。追加時は実際のYouTube URLから正確なhandleを確認すること
- AdSense等の収益化は本実装のスコープ外。サイト運用開始後、コンテンツ量とアクセスが蓄積してから申請する想定
