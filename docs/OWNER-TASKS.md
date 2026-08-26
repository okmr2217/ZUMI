# オーナーが手動で行う必要があるタスク

フェーズ0のインフラ構築状況。実装が進むにつれて増減するため、フェーズが
進むたびに更新すること。

## 完了済み

- ✅ **1-1 D1データベース作成**: `zumi-db`（database_id: `3201b980-daf5-4a39-a458-54196917f777`）を作成し、
  `apps/web` / `apps/notify` / `packages/db` の各 `wrangler.toml` に反映済み
- ✅ **1-2 マイグレーション適用**: 初期マイグレーション（`packages/db/migrations/0000_bouncy_roxanne_simpson.sql`）を本番 D1 に適用済み
- ✅ **1-3 Cloudflare API Token / Account ID**: 環境変数 `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` として設定済み（account: `okmr2217`）
- ✅ **1-4 カスタムドメイン**: `zumi-web` Worker をデプロイし、`zumi.paritto.dev` にカスタムドメインとして紐付け済み（`apps/web/wrangler.toml` の `routes` で管理）。動作確認済み（200 OK）
- ✅ **1-5 VAPID鍵**: 生成し、`zumi-web`・`zumi-notify` 両方に `wrangler secret put` で登録済み
- ✅ **2 Sentry**: `zumi-web` / `zumi-notify` の DSN を取得し、両 Worker に `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` として登録済み。`zumi-web` の本番ビルドは DSN を埋め込んだ状態でデプロイ済み
- ✅ **2-補足 Sentry ソースマップアップロード**: `SENTRY_AUTH_TOKEN` / `SENTRY_ORG` / `SENTRY_PROJECT` を GitHub Actions Secrets に登録済み。`deploy.yml` の `zumi-web` ビルドステップ（`next build` 実行箇所）で読み込み、ソースマップをアップロードする
- ✅ **3-a better-auth の `BETTER_AUTH_SECRET`**: 生成し `zumi-web` に登録済み
- ✅ **4 Resend**: API Key を `zumi-web` に `RESEND_API_KEY` として登録済み
- ✅ **3-b better-auth の実設定**: メール+パスワード、メール認証必須、パスワードリセット、
  退会確認メールを `apps/web/lib/auth.ts` に実装済み。認証系メールは `apps/web/lib/email.ts`
  経由で Resend から送信する（送信元: `noreply@paritto.dev`。ドメイン認証済み）
- ✅ **フェーズ1のマイグレーション（`0001_curly_puma.sql`）を本番 D1 に適用**: `wrangler d1
  migrations apply zumi-db --remote` で適用済み。`user`/`session`/`account`/`verification`
  のインデックス追加・タイムスタンプ列の `timestamp_ms` 化を反映
- ✅ **apps/web・apps/notify の初回デプロイ**:
  - https://zumi.paritto.dev （zumi-web、カスタムドメイン。`workers.dev` のプレビューURLは `routes` 設定により無効化される仕様のため使用不可）
  - https://zumi-notify.okumuradaichi2007.workers.dev （zumi-notify、毎分 Cron 動作中）
- ✅ **GitHub Actions からの自動デプロイ**: `.github/workflows/deploy.yml` を追加し、`CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` を GitHub Actions Secrets に登録済み。`main` への push（または手動実行）で `zumi-notify`・`zumi-web` が自動デプロイされることを確認済み

## 未完了（着手時期が決まっているもの）

### LINE Messaging API 連携 → **MVP以降（v1.1、Proプラン実装時）に実施**

MVPでは Web Push のみで通知を成立させる方針のため、フェーズ4（通知）では対応しない。
Pro プランの課金連携（[06-billing.md](./06-billing.md)）を実装するタイミングで、
LINE Developers コンソールでチャネル作成 → `LINE_CHANNEL_ACCESS_TOKEN` /
`LINE_CHANNEL_SECRET` を取得し、両 Worker に `wrangler secret put` で登録する。
（[09-implementation-tasks.md](./09-implementation-tasks.md) のフェーズ4節に明記済み）

### 課金（Stripe等）

MVPでは決済連携を実装しない前提のため、本フェーズ・次フェーズでは対応不要。
無料プランの制約（Duty5件・履歴3ヶ月）はコード側のロジックのみで実装する。
決済導線が必要になった時点（v1.1以降）で Stripe アカウント作成・Webhook設定
などが必要になる。

## 参考: 各リソースの識別子

| リソース | 値 |
|---|---|
| Cloudflare Account | `okmr2217` (`55b4467be01cbb1f5104758b2a728da9`) |
| D1 database_id | `3201b980-daf5-4a39-a458-54196917f777` |
| Sentry Org | `parittodev` |
| Sentry Project (web) | `zumi-web` |
| Sentry Project (notify) | `zumi-notify` |
| 本番URL | https://zumi.paritto.dev |
| notify Worker URL | https://zumi-notify.okumuradaichi2007.workers.dev |
