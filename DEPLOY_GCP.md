# Google Cloud (Cloud Run) デプロイ手順

パチログをRunableの外、Google Cloud Runの無料枠で動かすための手順書。
DBは引き続き Turso(libSQL) を使う想定(GCPに依存しないので、そのまま接続できる)。

> **注意:** この`Dockerfile`はサンドボックス内にDockerが無いためビルド検証していません。
> ローカル(Windows PCならWSL推奨)で `docker build` が通ることを確認してからCloud Runにデプロイしてください。

## 前提

- Googleアカウント(GCPプロジェクト作成用)
- ローカルにDocker Desktop(またはWSL+Docker)がインストール済み
- `gcloud` CLI がインストール済み([公式手順](https://cloud.google.com/sdk/docs/install))
- 既存の `.env`(YOUTUBE_API_KEY, COLLECT_SECRET_TOKEN, DATABASE_URL, DATABASE_AUTH_TOKEN)

## 1. GCPプロジェクト作成 & 課金アラート設定(必須)

1. https://console.cloud.google.com/ で新規プロジェクト作成
2. **「お支払い」→「予算とアラート」で課金アラートを必ず設定**(例: 500円超えたら通知)。無料枠内でも設定ミスで課金が発生するリスクを避けるため
3. 「Cloud Run API」「Artifact Registry API」を有効化

## 2. ローカルでDockerイメージをビルド・確認

```bash
cd pachilog
docker build -t pachilog .
docker run -p 8080:8080 --env-file .env pachilog
# http://localhost:8080 で動作確認
```

## 3. Artifact Registry にイメージをpush

```bash
gcloud auth login
gcloud config set project <あなたのプロジェクトID>

gcloud artifacts repositories create pachilog-repo \
  --repository-format=docker --location=asia-northeast1

gcloud auth configure-docker asia-northeast1-docker.pkg.dev

docker tag pachilog asia-northeast1-docker.pkg.dev/<プロジェクトID>/pachilog-repo/pachilog
docker push asia-northeast1-docker.pkg.dev/<プロジェクトID>/pachilog-repo/pachilog
```

## 4. Cloud Runにデプロイ(無料運用を狙う設定)

```bash
gcloud run deploy pachilog \
  --image=asia-northeast1-docker.pkg.dev/<プロジェクトID>/pachilog-repo/pachilog \
  --region=asia-northeast1 \
  --platform=managed \
  --allow-unauthenticated \
  --min-instances=0 \
  --max-instances=1 \
  --cpu=1 \
  --memory=512Mi \
  --set-env-vars="DATABASE_URL=<値>,DATABASE_AUTH_TOKEN=<値>,YOUTUBE_API_KEY=<値>,COLLECT_SECRET_TOKEN=<値>"
```

- **`--min-instances=0`**: アクセスが無い間はインスタンス0台=課金ゼロ
- **`--max-instances=1`**: 急なアクセス集中やDoS的なアクセスでインスタンスが増殖して課金が跳ねるのを防ぐ(この規模のMVPでは1台で十分)。コードの投票API側にも簡易レート制限(1IPあたり1分5回まで、`packages/web/src/api/middleware/rate-limit.ts`)を入れて二重に防御している

デプロイ完了後、`https://pachilog-xxxxx-an.a.run.app` のようなURLが発行される。

### 予算アラートの設定(必須)

Cloud Consoleの「お支払い」→「予算とアラート」で、100円・500円・1,000円の3段階でアラートを設定する。
**予算アラートは通知するだけで、請求を自動停止する機能ではない。** 実際の防御は上記の`--max-instances=1`とAPIのレート制限で行う。

## 5. n8nの収集エンドポイントURLを更新

これまでRunableのプレビューURLを叩いていた設定を、Cloud RunのURLに差し替える:
- `https://<Cloud RunのURL>/api/collect/run`
- `https://<Cloud RunのURL>/api/collect-machines/run`
- ヘッダー `x-collect-secret` は変更不要(同じ値のまま)

## 6. 独自ドメインの接続(AdSense申請前に推奨)

```bash
gcloud run domain-mappings create --service=pachilog --domain=your-domain.com --region=asia-northeast1
```
表示されるDNSレコードをドメイン管理画面(お名前.com等)に設定する。

## 無料枠の目安

Cloud Runの無料枠(2026年時点の一般的な水準):
- 月200万リクエストまで無料
- 月18万vCPU秒、月36万GiB秒のメモリまで無料
- 北米リージョンからの外向き通信1GBまで無料(東京リージョンは条件が異なる場合があるので注意)

パチログの構成(DBはTurso無料枠、YouTube APIも無料枠、画像/動画は自前配信しない、AI処理なし、min-instances=0)なら、月額0円にかなり近づけられる。ただし完全な0円保証ではなく、以下は少額発生し得る:

- Artifact Registryのコンテナ保存容量(月0.5GiBまでは無料)
- Cloud Buildのビルド時間(月2,500分までは無料)
- Cloud Loggingの大量ログ
- Cloud RunからTursoへの通信
- 独自ドメインの購入代(年1,000円〜)

小規模な個人サイト1つなら、これらもほぼ無料枠に収まる規模。**現実的な目標値は「月0〜数百円」**として見ておくのが正確。

## Runableとの違い(移行判断の参考)

| 項目 | Runable | Cloud Run自前ホスティング |
|---|---|---|
| 月額固定費 | Starterプラン $25/月〜(クレジット制、サイト運用自体は無料枠込み) | $0〜(従量課金、使った分だけ) |
| セットアップ | 不要(この場で完結) | Docker/gcloud CLI/DNS設定など自分で対応 |
| 運用の手間 | ほぼゼロ | デプロイ・監視・アップデートを自分で管理 |
| 請求の予測しやすさ | 高い(定額) | 低い(従量、予算アラート必須) |
