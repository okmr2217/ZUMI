# CLAUDE.md

このファイルは、このリポジトリで作業する Claude Code (claude.ai/code) 向けのガイドです。

## プロジェクト概要

ZUMI（済）は、定期的にやってくる活動（ゴミ出し・お風呂・プロテイン摂取など）をリマインド・記録する Web アプリ（Next.js / PWA）。動機が「なりたい自分」でも「やらなきゃいけないこと」でも問わず、定期的に繰り返すことだけを対象とし、完了操作は「済」の朱印をワンタップで押すだけという体験に絞る。連続記録（ストリーク）は扱わず、週単位の達成率を主指標とする。

前身は Habito（Vercel + Supabase + Prisma 構成）で、ZUMI では Cloudflare（Workers + D1 + Drizzle）に全面移行する。

**現在の進捗: フェーズ0（基盤構築）・フェーズ1（認証+DBスキーマ）・フェーズ8（LP・OGP画像）が完了し、`zumi.paritto.dev` に本番デプロイ済み。アプリ本体（フェーズ2〜7）は未着手で、次はフェーズ2。** 進捗の詳細は `docs/09-implementation-tasks.md` を参照。各フェーズに着手する際は、まず該当する `docs/` ファイルを読むこと。再開前の未決事項（テンプレート・オンボーディング・期日計算の境界ルール・スキーマ変更など）は 2026/11 に確定し、各 docs に「2026/11 確定」として反映済み。

## ドキュメント構成

要件定義は章単位で `docs/` 配下に分割されている。作業内容に応じて該当ファイルを参照する。

| ファイル | 内容 |
|---|---|
| `docs/00-overview.md` | プロダクト概要・対象活動・ターゲット・デザイン方針 |
| `docs/01-glossary.md` | 用語定義（Duty・ログ・催促 など） |
| `docs/02-notifications.md` | 通知要件（朝夜2通・週次サマリー） |
| `docs/03-duty-log-review-account.md` | Duty管理・記録（Log）・振り返り/シェア・アカウント |
| `docs/04-screens.md` | 画面構成（今日／振り返り／Duty の3タブ）。冒頭に画面モックのArtifact（Design canvas）へのリンクとアートボード対応表あり |
| `docs/05-tech-stack.md` | 技術スタック・インフラ・DB設計（Drizzleスキーマ）・通知配信設計・リポジトリ構成 |
| `docs/06-billing.md` | 課金（無料 / Pro プラン） |
| `docs/07-roadmap.md` | 実装優先順位（MVPスコープ・フェーズ） |
| `docs/08-lp-draft.md` | LP下書き |
| `docs/09-implementation-tasks.md` | MVP実装タスク一覧（フェーズ別チェックリスト） |

コードを書く前に、関連する docs ファイルの「なぜそう設計したか」の記述（各節の理由書き）を必ず踏まえること。設計判断には理由が明記されていることが多く、それを無視した実装は要件と矛盾しやすい。

画面（UI）を実装する際は、`docs/04-screens.md` 冒頭の画面モックArtifact（Design canvas、URL: https://claude.ai/code/artifact/1fa990f3-52f8-4f6b-8cee-805f5409f512）を Artifact ツールの `action: "read"` で参照し、レイアウト・余白・配色・コンポーネント構成の実装リファレンスとすること。要件文書とモックの見た目が食い違う場合、機能要件は要件文書を優先し、UI構造・スタイルの解釈はモックを優先する。

## 技術スタック（予定）

- **フレームワーク**: Next.js（App Router）+ TypeScript
- **ホスティング**: Cloudflare Workers（`@opennextjs/cloudflare` アダプタ）
- **DB**: Cloudflare D1（SQLite）+ Drizzle ORM / drizzle-kit
- **認証**: better-auth（メール＋パスワード、Drizzle アダプタ）
- **スタイリング**: Tailwind CSS + shadcn/ui（LP はカスタム実装）
- **DnD**: `@dnd-kit/sortable`
- **通知**: Cloudflare Workers（Cron Trigger）+ Web Push（VAPID）/ Resend（メール）/ LINE Messaging API（Pro）
- **シェア画像生成**: `next/og`（Satori ベース。LP の OGP 画像で Workers 上の動作確認済み）
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

- **Duty**: ユーザーが登録する、定期的に繰り返す活動の単位（Habito の Activity に相当）
- **ログ（Log）**: Duty に対して1対象日に1回行う「済／スキップ」の記録。`(dutyId, targetDate)` でユニーク制約
- **繰り返しタイプ（6種）**: `DAILY` / `WEEKDAYS` / `NTH_WEEK` / `MONTHLY` / `WEEKLY_COUNT` / `SINCE_LAST`
  - 期日確定型（`DAILY`/`WEEKDAYS`/`NTH_WEEK`/`MONTHLY`）と期日不確定型（`WEEKLY_COUNT`/`SINCE_LAST`）に分かれる
  - `SINCE_LAST`（前回完了からN日）が中核の差別化点。専用カラムは持たず `logs` から `MAX(target_date) WHERE status = 'DONE'` で導出する
- **催促**: 期日不確定型で「そろそろやるべき」状態に入ること。バックエンド用語であり、UI には出さず「そろそろ」等に言い換える
- 期日計算ロジック（6タイプの「今日が対象か」「催促発生中か」「週の残回数」判定）は `packages/types` 側に純粋関数として切り出し、`web` と `notify` の双方から同じ実装を使う。ここがズレると「通知は来たのに画面に出ていない」という不整合が起きるため、実装時は特に注意する

## 設計上の明示的な非対応事項（誤って実装しないこと）

- **カスタムフィールド**（活動ごとの追加入力項目）は実装しない。「1タップで済」という主訴求と衝突するため
- **ストリーク（連続記録日数）** は表示・保持しない。コンセプトの根幹に関わる意図的な設計
- **絵文字アイコン**は使わない。シェア画像生成（`next/og`/Satori）での描画崩れを避け、単色の線アイコンでトーンを揃えるため、lucide のプリセットアイコンに限定する（通知本文に絵文字を出す案も 2026/11 に検討し不採用）
- **`dueTime`（時刻指定）** は v1 では持たない
- **年次イベント**（車検・健康診断など）はスコープ外。`YEARLY` は存在しない

## MVP スコープ

`docs/07-roadmap.md` 参照。繰り返しタイプ6種はMVPでフルスコープ実装するが、以下は v1.1 以降に後回し: Duty のDnD並び替えUI、月次カレンダーヒートマップ、通知のメールフォールバック、前夜通知（Duty単位）、データエクスポート、メールアドレス変更。

フェーズ順: 1. 認証+DBスキーマ → 2. Duty CRUD → 3. 今日タブ（期日計算ロジック） → 4. 通知 → 5. 振り返りタブ → 6. シェア画像生成 → 7. 設定/オンボーディング → 8. LP

## セッション運用（フェーズ2以降）

フェーズ2以降の実装は、**指揮役セッション1つ**と**複数の作業セッション**で進める。自分がどちらかは、セッション開始時のプロンプトで指定される。

### 役割

- **指揮役**: 自分では実装しない。作業セッションを `spawn_task` で起動し、PR のレビュー、`development` へのマージ、`main` へのリリース、本番 D1 の migration 適用、この CLAUDE.md の「現在の進捗」の更新を担当する。起動プロンプトは単体で読んで分かるように書く（担当セッション名、読む docs、スコープと触らない範囲、完了条件、推奨エフォート）
- **作業セッション**: 1セッション＝1ブランチ＝1PR。`development` から切り、PR 先も `development`。担当範囲外のファイルには手を出さず、必要になったら PR 本文に書いて指揮役に任せる

### 分割と依存関係

| セッション | 内容 | 着手条件 | 推奨エフォート |
|---|---|---|---|
| S1 土台 | フェーズ2のスキーマ変更 migration、`user_settings` 作成フック、`ScheduleConfig` 型 + zod、アイコン/テンプレート定数、vitest 導入 + turbo/CI に test タスク追加 | なし（最初に直列で） | high |
| S2 Duty CRUD | フェーズ2の API・一覧・追加シート・テンプレート画面・編集フォーム・上限チェック | S1 | medium |
| S3 期日計算ロジック | フェーズ3の純粋関数とユニットテスト。`packages/types` のみ触る | S1 | xhigh |
| S4 サインアップ制限 | 横断「公開前のサインアップ制限」 | なし（すぐ並行可） | low〜medium |
| S5 PWA 基盤 | `manifest.json`・iOS 用 meta・アイコン。Service Worker の中身は S7 で扱う | なし（すぐ並行可） | medium |
| S6 今日タブ | フェーズ3の画面・押印 API・長押しモーダル・折りたたみ | S2・S3 | high |
| S7 Web Push | フェーズ4の Service Worker・購読フロー・通知設定 UI | S1 | medium |
| S8 notify Cron | フェーズ4の Cron・朝/夜/週次の通知判定（S3 の共有ロジックを使う） | S3 | high |
| S9 振り返り | フェーズ5 | S6 | medium |
| S10 シェア画像 | フェーズ6 | S9 | medium |
| S11 設定・オンボーディング | フェーズ7 | S2・S7 | medium |

QA・法務などの残りの横断タスクは S1〜S11 の完了後に指揮役が切り出す。

### ルール

- **スキーマ**: `packages/db/src/schema.ts` と `migrations/` を変更するのは一度に1セッションだけ（`drizzle-kit generate` の番号衝突を避けるため）。S1 以外でスキーマ変更が必要になったら、指揮役に報告して直列の小さな PR にする
- **進捗の記録**: 作業セッションは `docs/09-implementation-tasks.md` のうち**自分の担当範囲のチェックボックスだけ**を更新する。CLAUDE.md の「現在の進捗」は指揮役がマージ時に更新する（並行セッションが同じ行を書き換えて衝突するのを避けるため）
- **完了条件**: lint・typecheck・test・build が通る。UI の変更はモック Artifact と照らし合わせ、実際の画面で確認する（`/run` や Chrome）。PR 前に `/code-review` を実行する
- **サブエージェント**: モック Artifact の読み取りはサブエージェントに任せ、必要なアートボードの寸法・配色・構成だけを受け取る。S3 のテストケースは、実装を見ていないサブエージェントに docs/03 の境界ルールだけを渡して書かせる（実装と同じ思い込みがテストに入るのを防ぐため）。コンポーネントを共有する UI 実装は複数のエージェントに分けない
- **リリース**: `main` への push は本番（`zumi.paritto.dev`）に自動デプロイされる。`main` へのマージは指揮役が区切りのよいところで行う
- **本番 D1 の migration**: 作業セッションはローカル D1 への適用（`npm run db:migrate:local`）と動作確認までを行う。本番への適用は指揮役が、該当 PR を `main` にマージする**前に** `npm run migrate:remote --workspace=@zumi/db` で行う（逆順だと新しいカラムを参照するコードが先にデプロイされ、本番でエラーになる）。列の削除やテーブルの作り直しを含む場合は、先に `npx wrangler d1 time-travel info zumi-db` で復元ポイントを控える。適用後は `docs/OWNER-TASKS.md` に記録する
