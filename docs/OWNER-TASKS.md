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
- ✅ **3 better-auth**: `BETTER_AUTH_SECRET` を生成し `zumi-web` に登録済み（better-auth 自体の実設定はフェーズ1で行う）
- ✅ **4 Resend**: API Key を `zumi-web` に `RESEND_API_KEY` として登録済み
- ✅ **apps/web・apps/notify の初回デプロイ**:
  - https://zumi.paritto.dev （zumi-web、カスタムドメイン。`workers.dev` のプレビューURLは `routes` 設定により無効化される仕様のため使用不可）
  - https://zumi-notify.okumuradaichi2007.workers.dev （zumi-notify、毎分 Cron 動作中）

## 未完了

### LINE Messaging API（Pro機能・後回し可）

フェーズ4（通知）でも MVP は Web Push のみのため急ぎではない。必要になったら
LINE Developers コンソールでチャネル作成 → `LINE_CHANNEL_ACCESS_TOKEN` /
`LINE_CHANNEL_SECRET` を取得し、`wrangler secret put` で登録する。

### Sentry ソースマップアップロード（任意）

現状 `SENTRY_AUTH_TOKEN` は未設定のため、ビルド時のソースマップアップロードは
無効（`apps/web/next.config.ts` の `sourcemaps.disable` 参照）。有効化したい場合:

1. Sentry の `Settings > Auth Tokens` で Auth Token を発行
2. `SENTRY_AUTH_TOKEN` / `SENTRY_ORG=parittodev` / `SENTRY_PROJECT=zumi-web` を
   ローカル `.env.local` に設定してビルドするか、デプロイCIを追加する場合は
   GitHub Secrets に登録する

### GitHub Actions からの自動デプロイ

現在の `.github/workflows/ci.yml` は lint/typecheck/build のみで、Cloudflareへの
自動デプロイは行っていない（今回はこの場から手動で `wrangler deploy` した）。
自動デプロイを追加したい場合は、リポジトリの `Settings > Secrets and variables
> Actions` に以下を登録すること。

| Secret名 | 値 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token |
| `CLOUDFLARE_ACCOUNT_ID` | `55b4467be01cbb1f5104758b2a728da9` |

デプロイ時、`apps/web` は `NEXT_PUBLIC_SENTRY_DSN` を**ビルド時の環境変数**として
渡す必要がある点に注意（Next.js の `NEXT_PUBLIC_*` はビルド時にクライアント
バンドルへ埋め込まれるため、Workers の実行時シークレットだけでは反映されない）。

### better-auth の実設定・再マイグレーション（フェーズ1）

`packages/db/src/auth-schema.ts` は better-auth の標準スキーマを手書きした
プレースホルダー。フェーズ1で `apps/web/lib/auth.ts` の実設定（メール送信元、
セッション有効期限など）を詰めたら、`npx @better-auth/cli generate` 相当の
コマンドで内容を確定させ、マイグレーションを再生成・適用すること。

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
