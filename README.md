# ZUMI（済）

> 前身: Habito

「やりたいこと」ではなく「やらなきゃいけないこと」だけを扱う、義務専用のリマインド＆記録アプリ。

## コンセプト

- ゴミ出し・お風呂・プロテイン摂取のような、生活を最低限回すための反復作業を対象にする
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

現時点ではコードは未着手で、`docs/` 配下の要件定義のみが存在します。実装は [docs/07-roadmap.md](./docs/07-roadmap.md) のフェーズ順（認証・DB → Duty CRUD → 今日タブ → 通知 → 振り返り → シェア画像 → 設定/オンボーディング → LP）に進める予定です。
