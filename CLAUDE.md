# CLAUDE.md

このファイルは、このリポジトリで作業する Claude Code (claude.ai/code) 向けのガイドです。

## プロジェクト概要

ZUMI（済）は、定期的な義務的活動（ゴミ出し・お風呂・プロテイン摂取など）をリマインド・記録する Web アプリ（Next.js / PWA）。「やりたいこと」ではなく「やらなきゃいけないこと」だけを扱い、完了操作は「済」の朱印をワンタップで押すだけという体験に絞る。連続記録（ストリーク）は扱わず、週単位の達成率を主指標とする。

前身は Habito（Vercel + Supabase + Prisma 構成）で、ZUMI では Cloudflare（Workers + D1 + Drizzle）に全面移行する。

**現時点でこのリポジトリには `docs/` 配下の要件定義ドキュメントのみが存在し、実装コードは未着手。** 実装を始める際は、まず該当する `docs/` ファイルを読んでから着手すること。

## ドキュメント構成

要件定義は章単位で `docs/` 配下に分割されている。作業内容に応じて該当ファイルを参照する。

| ファイル | 内容 |
|---|---|
| `docs/00-overview.md` | プロダクト概要・対象活動・ターゲット・デザイン方針 |
| `docs/01-glossary.md` | 用語定義（Duty・ログ・催促 など） |
| `docs/02-notifications.md` | 通知要件（朝夜2通・週次サマリー） |
| `docs/03-duty-log-review-account.md` | Duty管理・記録（Log）・振り返り/シェア・アカウント |
| `docs/04-screens.md` | 画面構成（今日／振り返り／Duty の3タブ） |
| `docs/05-tech-stack.md` | 技術スタック・インフラ・DB設計（Drizzleスキーマ）・通知配信設計・リポジトリ構成 |
| `docs/06-billing.md` | 課金（無料 / Pro プラン） |
| `docs/07-roadmap.md` | 実装優先順位（MVPスコープ・フェーズ） |
| `docs/08-lp-draft.md` | LP下書き |

コードを書く前に、関連する docs ファイルの「なぜそう設計したか」の記述（各節の理由書き）を必ず踏まえること。設計判断には理由が明記されていることが多く、それを無視した実装は要件と矛盾しやすい。

## 技術スタック（予定）

- **フレームワーク**: Next.js（App Router）+ TypeScript
- **ホスティング**: Cloudflare Workers（`@opennextjs/cloudflare` アダプタ）
- **DB**: Cloudflare D1（SQLite）+ Drizzle ORM / drizzle-kit
- **認証**: better-auth（メール＋パスワード、Drizzle アダプタ）
- **スタイリング**: Tailwind CSS + shadcn/ui（LP はカスタム実装）
- **DnD**: `@dnd-kit/sortable`
- **通知**: Cloudflare Workers（Cron Trigger）+ Web Push（VAPID）/ Resend（メール）/ LINE Messaging API（Pro）
- **シェア画像生成**: `workers-og`（Satori ベース）
- **エラー監視**: Sentry
- **モノレポ管理**: Turborepo

詳細・移行理由は `docs/05-tech-stack.md` を参照。

### 想定リポジトリ構成

```
/
├── apps/
│   ├── web/              # 本体（LP + アプリ + API）
│   └── notify/           # 通知（Cron Trigger Worker）
├── packages/
│   ├── db/               # Drizzle スキーマ・マイグレーション（web/notify 双方から参照）
│   └── types/             # 共有型定義（ScheduleConfig など）
├── package.json
└── turbo.json
```

D1 には enum・Date・Json 型がないため、すべて `text` で保持し Drizzle の `$type<>()` で TypeScript 側の型を担保する。日付は `YYYY-MM-DD` の text、日時は Unix timestamp（integer）。

## コアドメインの重要概念

- **Duty**: ユーザーが登録する義務的活動の単位（Habito の Activity に相当）
- **ログ（Log）**: Duty に対して1対象日に1回行う「済／スキップ」の記録。`(dutyId, targetDate)` でユニーク制約
- **繰り返しタイプ（6種）**: `DAILY` / `WEEKDAYS` / `NTH_WEEK` / `MONTHLY` / `WEEKLY_COUNT` / `SINCE_LAST`
  - 期日確定型（`DAILY`/`WEEKDAYS`/`NTH_WEEK`/`MONTHLY`）と期日不確定型（`WEEKLY_COUNT`/`SINCE_LAST`）に分かれる
  - `SINCE_LAST`（前回完了からN日）が中核の差別化点。専用カラムは持たず `logs` から `MAX(target_date) WHERE status = 'DONE'` で導出する
- **催促**: 期日不確定型で「そろそろやるべき」状態に入ること。バックエンド用語であり、UI には出さず「そろそろ」等に言い換える
- 期日計算ロジック（6タイプの「今日が対象か」「催促発生中か」「週の残回数」判定）は `packages/types` 側に純粋関数として切り出し、`web` と `notify` の双方から同じ実装を使う。ここがズレると「通知は来たのに画面に出ていない」という不整合が起きるため、実装時は特に注意する

## 設計上の明示的な非対応事項（誤って実装しないこと）

- **カスタムフィールド**（活動ごとの追加入力項目）は実装しない。「1タップで済」という主訴求と衝突するため
- **ストリーク（連続記録日数）** は表示・保持しない。コンセプトの根幹に関わる意図的な設計
- **絵文字アイコン**は使わない。シェア画像生成（`workers-og`/Satori）でのフォント埋め込み崩れを避けるため、プリセットアイコンに限定する
- **`dueTime`（時刻指定）** は v1 では持たない
- **年次イベント**（車検・健康診断など）はスコープ外。`YEARLY` は存在しない

## MVP スコープ

`docs/07-roadmap.md` 参照。繰り返しタイプ6種はMVPでフルスコープ実装するが、以下は v1.1 以降に後回し: Duty のDnD並び替えUI、月次カレンダーヒートマップ、通知のメールフォールバック、前夜通知（Duty単位）、データエクスポート、メールアドレス変更。

フェーズ順: 1. 認証+DBスキーマ → 2. Duty CRUD → 3. 今日タブ（期日計算ロジック） → 4. 通知 → 5. 振り返りタブ → 6. シェア画像生成 → 7. 設定/オンボーディング → 8. LP
