# パチログ 実装タスク

参照: リポジトリのコミット履歴と design.md も合わせて参照。
主要機能: チャンネル登録者数・再生数トラッカー、投票、Xシェア、新台バズ指数。
データ収集はYouTube Data API(無料枠)。n8nから /api/collect/run と /api/collect-machines/run をCronで叩く運用。

詳細はRunableサンドボックス側のtask.mdを参照(このコミットはスナップショット)。
