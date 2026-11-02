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
- ✅ **フェーズ2〜6のマイグレーション（`0002_nebulous_rattler.sql`・`0003_harsh_ben_parker.sql`・`0004_furry_prodigy.sql`）を本番 D1 に適用**（2026-11-02 20:28 UTC、指揮役）: `wrangler d1 migrations apply zumi-db --remote`。適用前の復元ポイント（time-travel のブックマーク）は `00000004-00000000-00005117-1d4d5d177f08695ffd9f8e1bd24c3ded`。どれも追加だけ（0002 は Duty・ログ・通知まわりのスキーマ変更、0003 は通知のインデックスと `timezone_auto`、0004 は `share_tokens`）
- ✅ **apps/web・apps/notify の初回デプロイ**:
  - https://zumi.paritto.dev （zumi-web、カスタムドメイン。`workers.dev` のプレビューURLは `routes` 設定により無効化される仕様のため使用不可）
  - https://zumi-notify.okumuradaichi2007.workers.dev （zumi-notify、毎分 Cron 動作中）
- ✅ **GitHub Actions からの自動デプロイ**: `.github/workflows/deploy.yml` を追加し、`CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` を GitHub Actions Secrets に登録済み。`main` への push（または手動実行）で `zumi-notify`・`zumi-web` が自動デプロイされることを確認済み
- ✅ **VAPID 鍵の作り直し**（2026-11-03、オーナー）: 1-5 の鍵が web と notify で同じ組か確かめられないため、新しい組を作り、`zumi-web` の `VAPID_PUBLIC_KEY`、`zumi-notify` の `VAPID_PUBLIC_KEY`・`VAPID_PRIVATE_KEY` に入れ直した。`zumi-web` の `VAPID_PRIVATE_KEY` は削除済み。`wrangler secret list` でシークレット名がそろっていることを確認した（指揮役）。本番にはまだ購読がなかったので影響なし。実機で通知が届くかは、[09](./09-implementation-tasks.md) の「実機での確認」で見る

## 未完了（着手時期が決まっているもの）

### 公開時にサインアップを開く → **アプリ本体と利用規約・プライバシーポリシーの完成後**

サインアップを開く前に、規約・ポリシーについて次を済ませる（PR #32 の「オーナーに確認してほしい点」）:

- `apps/web/components/legal/legal-document.tsx` の `OPERATOR.name`・`OPERATOR.email` を埋める（空のあいだは本文に【運営者名】【連絡先メールアドレス】が出る）
- PR #32 の確認事項10項目を見る（住所の扱い、専属的合意管轄、免責の範囲、外国の事業者の扱い、外部送信規律など）。本文は専門家のレビューを経ていない下書き
- Sentry の `zumi-web`・`zumi-notify` で「Prevent Storing of IP Addresses」を有効にし、Sentry・Resend の保存期間を確認する（ポリシーは「IP をエラー情報に含めない」「各事業者の定める期間」と書いている）
- Cloudflare ダッシュボード（`paritto.dev` → セキュリティ → WAF → レート制限ルール）で、認証の API にレート制限ルールを1本作る。対象は `/api/auth/sign-in`・`/api/auth/sign-up`・`/api/auth/request-password-reset`・`/api/auth/send-verification-email`（パスが `/api/auth/` で始まる POST にまとめてもよい）。無料プランでも1本作れる。better-auth の rate limit はメモリに置かれ、Workers の isolate ごとに分かれるのでベストエフォートにしかならないため（2026/11 確定。D1 に持たせる方法はスキーマ変更が要るので採らない）
- シェア URL を個別に無効にする機能はない。ポリシーでは「運営者に連絡」としたので、依頼が来たら本番 D1 の `share_tokens` の該当行を手で消す。ただし今は行を消しても画像がエッジのキャッシュに残る（[09](./09-implementation-tasks.md) の「QA・リリース準備」の「シェア画像のキャッシュと削除」）

本番のサインアップは `apps/web/wrangler.toml` の `[vars]` の `SIGNUP_ENABLED = "false"` で
閉じている（"true" 以外は閉じる側に倒す）。`wrangler deploy` は `[vars]` でダッシュボードの値を
上書きするため、ダッシュボードやシークレットではなく、`wrangler.toml` を `"true"` に変えて
`main` にマージ（自動デプロイ）することで開く。ローカルでは `apps/web/.dev.vars` に
`SIGNUP_ENABLED=true` を書く（`.dev.vars.example` 参照）。

### 契約プランと上限・本番データの確認 → **サインアップを開く前**

2026/11 のリリース前の見直しで追加。どれも Claude の権限では確認できなかった（Cloudflare の契約情報は API トークンの権限外、本番 D1 の読み取りは許可していない）。

- **Workers のプラン**: 無料プランだと CPU 時間が1リクエスト 10ms まで、外部への fetch が1回の起動で 50 件までに制限される。シェア画像（Satori）や Next.js の SSR は 10ms を超えやすい。notify は1分ごとの Cron 1回で該当する全員に送るので、既定の朝 7:00 に人が集まると数十人で 50 件を超えて送れなくなる。有料プラン（Workers Paid）なら問題にならない。無料プランのままにするなら、notify を分割して送る作りに変える必要がある
- **Resend のプラン**: 無料プランは1日 100 通・月 3,000 通まで。確認メールとパスワード再設定がこれを使うので、公開直後に申し込みが集中すると確認メールが届かず登録できない人が出る。上限に達したときに気づけるよう、Resend の通知か Sentry で送信の失敗を見る
- **D1 のバックアップ**: Time Travel で戻せるのは無料プランで 7 日、有料で 30 日まで。それより前に戻す必要が出たときのために、定期的な `wrangler d1 export` が要るかを決める
- **本番 D1 に残っているデータ**: フェーズ1のころの検証用アカウントやデータが残っていないかを見て、公開前に消すかどうか決める（`user_settings` の行がないユーザーは、アプリを開いたときに作り直される）

### Web Push の VAPID 鍵（参考: 作り直す場合）

2026-11-03 に作り直し済み（上の「完了済み」）。購読（`zumi-web`）と送信（`zumi-notify`）で同じ組を
使っていないと、送信がすべて失敗する。`zumi-web` には公開鍵だけを置く（送信は notify だけが行う）。
シークレットの書き込みは Claude の権限判定で止められるため、オーナーが実行する。

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
