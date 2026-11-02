# オーナーが手動で行う必要があるタスク

フェーズ0のインフラ構築状況。実装が進むにつれて増減するため、フェーズが
進むたびに更新すること。

フェーズ2以降の本番 D1 への migration 適用はオーナータスクから外し、指揮役
セッション（Claude）が `main` へのマージ前に行う（2026/11 決定。手順は `CLAUDE.md`
の「セッション運用」）。適用したら下の「完了済み」に追記する。

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

### 公開時にサインアップを開く → **アプリ本体と利用規約・プライバシーポリシーの完成後**

サインアップを開く前に、規約・ポリシーについて次を済ませる（PR #32 の「オーナーに確認してほしい点」）:

- `apps/web/components/legal/legal-document.tsx` の `OPERATOR.name`・`OPERATOR.email` を埋める（空のあいだは本文に【運営者名】【連絡先メールアドレス】が出る）
- PR #32 の確認事項10項目を見る（住所の扱い、専属的合意管轄、免責の範囲、外国の事業者の扱い、外部送信規律など）。本文は専門家のレビューを経ていない下書き
- Sentry の `zumi-web`・`zumi-notify` で「Prevent Storing of IP Addresses」を有効にし、Sentry・Resend の保存期間を確認する（ポリシーは「IP をエラー情報に含めない」「各事業者の定める期間」と書いている）
- シェア URL を個別に無効にする機能はない。ポリシーでは「運営者に連絡」としたので、依頼が来たら本番 D1 の `share_tokens` の該当行を手で消す

本番のサインアップは `apps/web/wrangler.toml` の `[vars]` の `SIGNUP_ENABLED = "false"` で
閉じている（"true" 以外は閉じる側に倒す）。`wrangler deploy` は `[vars]` でダッシュボードの値を
上書きするため、ダッシュボードやシークレットではなく、`wrangler.toml` を `"true"` に変えて
`main` にマージ（自動デプロイ）することで開く。ローカルでは `apps/web/.dev.vars` に
`SIGNUP_ENABLED=true` を書く（`.dev.vars.example` 参照）。

### Web Push の VAPID 鍵の確認 → **通知（フェーズ4）を `main` にマージする前**

**方針（2026/11 決定）**: 登録済みの鍵が web と notify で同じ組か確かめられないため、リリース時に下の手順で作り直して両方に入れる。`zumi-web` の `VAPID_PRIVATE_KEY` も削除する。鍵が入ると、購読している人には週次サマリーが届き始める（`weekly_summary_enabled` は既定で ON）。

鍵の組は 1-5 で登録済み。購読（`zumi-web`）と送信（`zumi-notify`）で同じ組を使っていないと、
送信がすべて失敗する。次を確認する。

- `zumi-web` の `VAPID_PUBLIC_KEY` と、`zumi-notify` の `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` が
  同じ組であること。シークレットは値を読み出せないため、確信が持てなければ下の手順で作り直す
  （公開前で購読者がいないので、作り直しても影響はない）
- `zumi-web` の `VAPID_PRIVATE_KEY` は使わない（送信は notify だけが行う）。消してよい:
  `npx wrangler secret delete VAPID_PRIVATE_KEY --name zumi-web`

作り直す手順:

```bash
npx web-push generate-vapid-keys            # Public Key / Private Key が表示される
cd apps/web && npx wrangler secret put VAPID_PUBLIC_KEY      # 公開鍵
cd apps/notify && npx wrangler secret put VAPID_PUBLIC_KEY   # 同じ公開鍵
cd apps/notify && npx wrangler secret put VAPID_PRIVATE_KEY  # 秘密鍵
```

`zumi-web` は公開鍵を実行時に読む（`apps/web/lib/vapid.ts`）ので、再ビルドは要らない。公開後に
鍵を作り直すと既存の購読はすべて送れなくなる（端末側は次に設定画面で許可し直したときに作り直す）。
ローカル用の鍵は本番と分け、`apps/web/.dev.vars`（`.dev.vars.example` 参照）に書く。

### LINE Messaging API 連携 → **MVP以降（v1.1、Proプラン実装時）に実施**

MVPでは Web Push のみで通知を成立させる方針のため、フェーズ4（通知）では対応しない。
Pro プランの課金連携（[06-billing.md](./06-billing.md)）を実装するタイミングで、
LINE Developers コンソールでチャネル作成 → `LINE_CHANNEL_ACCESS_TOKEN` /
`LINE_CHANNEL_SECRET` を取得し、両 Worker に `wrangler secret put` で登録する。
（[09-implementation-tasks.md](./09-implementation-tasks.md) のフェーズ4節に明記済み）

### 課金（Stripe等）

MVPでは決済連携を実装しない前提のため、本フェーズ・次フェーズでは対応不要。
無料プランの制約（MVP中は Duty10件・履歴3ヶ月）はコード側のロジックのみで実装する。
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
