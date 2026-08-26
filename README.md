# ZUMI（済）

> 前身: Habito

なりたい自分のためでも、すでにやらなきゃいけないことでもいい。大事なのは定期的にやってくること。それだけを扱うリマインド＆記録アプリ。

## コンセプト

- ゴミ出し・お風呂・プロテイン摂取から、語学学習・筋トレのような自分磨きまで、動機は問わず「定期的に繰り返すか」だけで対象を決める
- 完了操作は「済」の朱印をワンタップで押すだけ。書くことはない
- 連続記録（ストリーク）は扱わない。主指標は週単位の達成率で、途切れても翌週から普通に再開できる

詳しい要件・仕様は [docs/](./docs) を参照してください。

## ドキュメント構成

| ファイル | 内容 |
|---|---|
| [docs/00-overview.md](./docs/00-overview.md) | プロダクト概要・対象活動・ターゲット・デザイン方針 |
| [docs/01-glossary.md](./docs/01-glossary.md) | 用語定義 |
| [docs/02-notifications.md](./docs/02-notifications.md) | 通知要件 |
| [docs/03-duty-log-review-account.md](./docs/03-duty-log-review-account.md) | Duty管理・記録（Log）・振り返り/シェア・アカウント |
| [docs/04-screens.md](./docs/04-screens.md) | 画面構成 |
| [docs/05-tech-stack.md](./docs/05-tech-stack.md) | 技術スタック・インフラ・DB設計・通知配信設計・リポジトリ構成 |
| [docs/06-billing.md](./docs/06-billing.md) | 課金 |
| [docs/07-roadmap.md](./docs/07-roadmap.md) | 実装優先順位 |
| [docs/08-lp-draft.md](./docs/08-lp-draft.md) | LP下書き |

## 技術スタック（予定）

| 用途 | 技術 |
|---|---|
| フレームワーク | Next.js（App Router）+ TypeScript |
| ホスティング | Cloudflare Workers（`@opennextjs/cloudflare`） |
| DB | Cloudflare D1 + Drizzle ORM |
| 認証 | better-auth（メール＋パスワード） |
| スタイリング | Tailwind CSS + shadcn/ui |
| 通知 | Web Push（VAPID）/ メール（Resend）/ LINE Messaging API（Pro） |
| シェア画像生成 | `workers-og`（Satori） |
| モノレポ管理 | Turborepo |

詳細は [docs/05-tech-stack.md](./docs/05-tech-stack.md) を参照。

## 現在の状況

フェーズ0（プロジェクト基盤構築）・フェーズ1（認証+DBスキーマ）完了。better-auth に
よるメール+パスワード認証（メール認証必須・パスワードリセット・退会）を実装済み。
実装は [docs/07-roadmap.md](./docs/07-roadmap.md) のフェーズ順
（認証・DB → Duty CRUD → 今日タブ → 通知 → 振り返り → シェア画像 → 設定/オンボーディング → LP）
に進める。次はフェーズ2（Duty タブ CRUD）。

## リポジトリ構成

```
/
├── apps/
│   ├── web/      # 本体（LP + アプリ + API） Next.js / Cloudflare Workers
│   └── notify/   # 通知配信（Cron Trigger Worker）
├── packages/
│   ├── db/       # Drizzle スキーマ・マイグレーション
│   └── types/    # 共有型定義（ScheduleConfig など）
└── docs/         # 要件定義
```

## 開発の始め方

```bash
npm install

# 開発サーバー（apps/web, apps/notify を並行起動）
npm run dev

# Lint / 型チェック / ビルド（Turborepo 経由で全ワークスペースに実行）
npm run lint
npm run typecheck
npm run build
```

### ローカル D1

```bash
# マイグレーション SQL 生成（packages/db/src/schema.ts を変更したら実行）
npm run db:generate

# ローカル D1（Miniflare）にマイグレーション適用
npm run db:migrate:local

# 開発用シードデータ投入
npm run db:seed
```

詳細は [packages/db/README.md](./packages/db/README.md) を参照。

## オーナーが手動で行う必要があるタスク

Cloudflare/Sentry/GitHub 側のアカウント操作が必要な項目は
[docs/OWNER-TASKS.md](./docs/OWNER-TASKS.md) にまとめてあります。
