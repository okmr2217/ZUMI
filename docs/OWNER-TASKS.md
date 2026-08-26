# オーナーが手動で行う必要があるタスク（フェーズ0完了時点）

フェーズ0ではコード側の雛形のみ用意した。以下はアカウント権限・APIキーが
必要でこの場では実行していない作業。実装が進むにつれて増減するため、
フェーズが進むたびに更新すること。

## 1. Cloudflare

### 1-1. D1 データベースの作成

```bash
npx wrangler login
npx wrangler d1 create zumi-db
```

出力される `database_id` を以下3ファイルの `REPLACE_WITH_D1_DATABASE_ID` に反映する。

- `apps/web/wrangler.toml`
- `apps/notify/wrangler.toml`
- `packages/db/wrangler.toml`

3ファイルとも同じ `database_id` を指す必要がある（`docs/05-tech-stack.md` の設計）。

### 1-2. マイグレーションの適用

```bash
npm run db:generate                 # migrations/ に SQL を生成
npx wrangler d1 migrations apply zumi-db --remote   # 本番 D1 に適用
```

better-auth のテーブル（`user`/`session`/`account`/`verification`）は
`packages/db/src/auth-schema.ts` のプレースホルダーを使っているため、
フェーズ1で better-auth の実設定確定後に `npx @better-auth/cli generate`
相当のコマンドで内容を確定させ、再度マイグレーションを生成すること。

### 1-3. アカウントID・APIトークンの取得（CI/CD用）

GitHub Actions からデプロイする場合に必要（現時点の CI は lint/typecheck/build
のみで、デプロイジョブは未追加）。

- **Account ID**: Cloudflare ダッシュボード右サイドバーに表示される
- **API Token**: `My Profile > API Tokens > Create Token` で
  「Edit Cloudflare Workers」テンプレートを使用して発行

デプロイワークフローを追加する際に GitHub Secrets へ以下を登録する。

| Secret名 | 値 | 取得元 |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | 上記で発行したトークン | Cloudflare ダッシュボード |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID | Cloudflare ダッシュボード |

### 1-4. カスタムドメイン設定

`docs/05-tech-stack.md` の想定ドメイン構成:

| 用途 | ドメイン |
|---|---|
| 本体（LP + アプリ） | `zumi.paritto.dev` |
| 通知 Worker | 不要（デバッグ用に `notify-zumi.<account>.workers.dev`） |

手順:

1. `paritto.dev` が Cloudflare でゾーン管理されていることを確認
2. `zumi-web` Worker（`apps/web`）に対して
   Cloudflare ダッシュボード → Workers & Pages → zumi-web → Settings →
   Domains & Routes から `zumi.paritto.dev` をカスタムドメインとして追加
   （`apps/web/wrangler.toml` の `routes` コメントアウトを有効化してもよい）
3. DNS レコードは Cloudflare が自動作成する（ゾーンが Cloudflare 管理下の場合）

### 1-5. Web Push 用 VAPID 鍵の生成

```bash
npx web-push generate-vapid-keys
```

生成した鍵は以下に設定する（フェーズ4で使用）。

- `apps/web` / `apps/notify` それぞれで `wrangler secret put VAPID_PUBLIC_KEY`
  / `wrangler secret put VAPID_PRIVATE_KEY`
- ローカル開発では `.dev.vars`（gitignore 対象）に記載

## 2. Sentry

1. https://sentry.io でプロジェクトを2つ作成（`zumi-web` / `zumi-notify` など、
   Next.js 用と Cloudflare Workers 用）
2. 発行された DSN を以下に設定する
   - ローカル: `apps/web/.env.local`（`.env.example` をコピー）の
     `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_DSN`
   - 本番: `wrangler secret put SENTRY_DSN`（Workers 側）、
     Cloudflare Pages/Workers の環境変数として `NEXT_PUBLIC_SENTRY_DSN` を設定
3. ソースマップアップロードを有効にする場合は Sentry の
   `Settings > Auth Tokens` で `SENTRY_AUTH_TOKEN` を発行し、
   GitHub Secrets とローカル `.env.local` の両方に設定
   （未設定でもビルド自体は通る。`apps/web/next.config.ts` 参照）

| Secret名 | 値 | 取得元 |
|---|---|---|
| `SENTRY_AUTH_TOKEN` | Auth Token | Sentry ダッシュボード |
| `SENTRY_ORG` | Organization slug | Sentry ダッシュボード |
| `SENTRY_PROJECT` | Project slug | Sentry ダッシュボード |

## 3. better-auth

- `BETTER_AUTH_SECRET`: `npx @better-auth/cli secret` 等で生成したランダム値。
  `wrangler secret put BETTER_AUTH_SECRET` で登録し、ローカルは `.env.local` へ。
- メール認証・パスワードリセットメールの送信元は Resend を使う想定
  （下記4章）。better-auth 側の設定は未着手（フェーズ1）。

## 4. メール送信（Resend）／LINE Messaging API（Pro機能・後回し可）

フェーズ4（通知）実装時に必要。MVPスコープではメールフォールバックは
v1.1以降のため、Web Push のみで先に進めてよい。

- Resend: https://resend.com でアカウント作成 → API Key 発行 →
  `RESEND_API_KEY` として登録
- LINE Messaging API: Pro機能のため後回し可。LINE Developers コンソールで
  チャネル作成 → `LINE_CHANNEL_ACCESS_TOKEN` / `LINE_CHANNEL_SECRET`

## 5. GitHub Actions Secrets（現時点でのCI）

現在の `.github/workflows/ci.yml` は lint/typecheck/build のみで、
Cloudflare へのデプロイや Sentry へのソースマップアップロードは行っていない
ため、**フェーズ0時点では追加の GitHub Secrets 設定は不要**。

デプロイワークフローを追加するタイミングで、1-3・Sentry章の表にある
Secrets をリポジトリの `Settings > Secrets and variables > Actions` に
登録すること。

## 6. 課金（Stripe等）

タスク依頼の前提通り、MVPでは決済連携を実装しないため本フェーズでは
何も設定不要。無料プランの制約（Duty5件・履歴3ヶ月）はコード側で
実装するが、決済導線が必要になった時点（v1.1以降）で Stripe アカウント
作成・Webhook設定などが必要になる。
