# ZUMI（済） - 技術スタック・インフラ構成

> 関連: [Duty管理・記録・振り返り・アカウント](./03-duty-log-review-account.md) / [通知](./02-notifications.md)

## 5. 技術スタック・インフラ構成

| 用途 | 技術 |
|---|---|
| フレームワーク | Next.js（App Router）+ TypeScript |
| ホスティング（本体） | Cloudflare Workers（`@opennextjs/cloudflare` アダプタ経由） |
| スタイリング | Tailwind CSS + shadcn/ui（LP はカスタム実装） |
| DB | Cloudflare D1（ネイティブバインディングでアクセス） |
| ORM / マイグレーション | Drizzle ORM + drizzle-kit |
| 認証 | better-auth（メール＋パスワード、Drizzle アダプタ） |
| DnD | `@dnd-kit/sortable` |
| 通知スケジューラ | Cloudflare Workers（Cron Trigger） |
| プッシュ送信 | Web Push（VAPID）/ Resend（メール）/ LINE Messaging API（Pro） |
| 配信キュー | Cloudflare Queues（配信数が増えた段階で導入。初期は不要） |
| シェア画像生成 | `next/og`（Satori ベース。LP の OGP 画像で Workers 上での動作を確認済み。当初の `workers-og` から変更） |
| エラー監視 | Sentry |
| モノレポ管理 | Turborepo |

### Habito（Vercel + Supabase + Prisma）からの移行

Cloudflare に寄せる判断をした理由と、それに伴う制約。

**採用理由**

- 本体・通知 Worker・シェア画像生成がすべて Workers 上に載り、ベンダーが1つで済む
- D1 は Worker からネイティブバインディングで叩けるため、外部 DB への TCP 接続やコネクションプーリングの問題が発生しない。Supabase を Workers から使う場合はここが常に面倒になる
- notify Worker が本体と同じバインディングで DB を参照できる
- Vercel 無料プランの Cron 制約（1日1回）を回避できる。Cloudflare Cron Trigger は無料プランで1分間隔まで対応

**移行に伴う制約**

- D1 は SQLite。**enum 型・Date 型・Json 型がない**ため、すべて `text` で保持し、Drizzle の `$type<>()` で TypeScript 側の型を担保する
- 日付は `YYYY-MM-DD` の text、日時は Unix timestamp（integer）で持つ
- Prisma は D1 サポートが弱いため Drizzle に置き換える。マイグレーションは `drizzle-kit generate` → `wrangler d1 migrations apply`
- D1 には DB サイズ上限があるため、ログの肥大化を監視する。無料プランの履歴3ヶ月制限はこの観点でも合理性がある
- better-auth は Drizzle アダプタ経由で D1 に対応する。`user` / `session` / `account` / `verification` テーブルは better-auth 側が管理する

### DB 設計（Drizzle / D1）

`packages/db/schema.ts` に定義し、`apps/web` と `apps/notify` の双方から参照する。

```ts
import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { user } from "./auth-schema"; // better-auth が管理

export const userSettings = sqliteTable("user_settings", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().unique().references(() => user.id, { onDelete: "cascade" }),
  timezone: text("timezone").notNull().default("Asia/Tokyo"),
  timezoneAuto: integer("timezone_auto", { mode: "boolean" }).notNull().default(true), // false = 設定画面で手で選んだ
  morningNotifyEnabled: integer("morning_notify_enabled", { mode: "boolean" }).notNull().default(false),
  morningNotifyAt: text("morning_notify_at"),            // "08:00"
  eveningNotifyEnabled: integer("evening_notify_enabled", { mode: "boolean" }).notNull().default(false),
  eveningNotifyAt: text("evening_notify_at"),            // "21:00"
  weeklySummaryEnabled: integer("weekly_summary_enabled", { mode: "boolean" }).notNull().default(true),
  weeklySummaryAt: text("weekly_summary_at").notNull().default("20:00"), // 送るのは週の最終日固定
  weekStart: integer("week_start").notNull().default(1), // 1=月 / 0=日
  onboardedAt: integer("onboarded_at", { mode: "timestamp" }), // null = オンボーディング未完了
  channel: text("channel").$type<"WEB_PUSH" | "EMAIL" | "LINE">().notNull().default("WEB_PUSH"),
  lineUserId: text("line_user_id"),                      // Pro のみ
}, (t) => ({
  // notify の毎分の抽出用。OFF の行は入れない部分インデックス
  morningNotify: index("user_settings_morning_notify_idx").on(t.morningNotifyAt).where(sql`${t.morningNotifyEnabled} = 1`),
  eveningNotify: index("user_settings_evening_notify_idx").on(t.eveningNotifyAt).where(sql`${t.eveningNotifyEnabled} = 1`),
  weeklySummary: index("user_settings_weekly_summary_idx").on(t.weeklySummaryAt).where(sql`${t.weeklySummaryEnabled} = 1`),
}));

export const pushSubscriptions = sqliteTable("push_subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
}, (t) => ({
  byUser: index("push_subscriptions_user_idx").on(t.userId),
}));

export type ScheduleConfig =
  | { type: "DAILY" }
  | { type: "WEEKDAYS"; weekdays: number[] }
  | { type: "NTH_WEEK"; weekdays: number[]; every: number; anchor: string }
  | { type: "MONTHLY"; dayOfMonth?: number; nth?: number; weekday?: number }
  | { type: "WEEKLY_COUNT"; timesPerWeek: number }
  | { type: "SINCE_LAST"; days: number };

export const duties = sqliteTable("duties", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  icon: text("icon").notNull(),
  scheduleType: text("schedule_type")
    .$type<"DAILY" | "WEEKDAYS" | "NTH_WEEK" | "MONTHLY" | "WEEKLY_COUNT" | "SINCE_LAST">()
    .notNull(),
  scheduleConfig: text("schedule_config", { mode: "json" }).$type<ScheduleConfig>().notNull(),
  notifyPrevNight: integer("notify_prev_night", { mode: "boolean" }).notNull().default(false),
  noteEnabled: integer("note_enabled", { mode: "boolean" }).notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  status: text("status").$type<"ACTIVE" | "PAUSED" | "ARCHIVED">().notNull().default("ACTIVE"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  archivedAt: integer("archived_at", { mode: "timestamp" }),
}, (t) => ({
  byUserStatus: index("duties_user_status_idx").on(t.userId, t.status),
}));

// 一時停止の期間。過去の週の分母から PAUSED 期間を外すために使う
export const dutyPauses = sqliteTable("duty_pauses", {
  id: text("id").primaryKey(),
  dutyId: text("duty_id").notNull().references(() => duties.id, { onDelete: "cascade" }),
  startDate: text("start_date").notNull(),               // "2026-08-24"
  endDate: text("end_date"),                             // null = 一時停止中
}, (t) => ({
  byDuty: index("duty_pauses_duty_idx").on(t.dutyId),
}));

export const logs = sqliteTable("logs", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  dutyId: text("duty_id").notNull().references(() => duties.id, { onDelete: "cascade" }),
  targetDate: text("target_date").notNull(),             // "2026-08-24"
  loggedAt: integer("logged_at", { mode: "timestamp" }).notNull(),
  status: text("status").$type<"DONE" | "SKIP">().notNull(),
  note: text("note"),
}, (t) => ({
  uniqDutyDate: uniqueIndex("logs_duty_date_uniq").on(t.dutyId, t.targetDate),
  byUserDate: index("logs_user_date_idx").on(t.userId, t.targetDate),
}));
```

**2026/11 のスキーマ変更（フェーズ2でマイグレーション）**: `user_settings` に `weekStart`・`onboardedAt` を追加し、`weeklySummaryWeekday` を削除する（送る曜日は週の最終日に固定したため）。`duties` に `archivedAt` を追加し、`duty_pauses` テーブルを新設する。理由は [Duty 管理](./03-duty-log-review-account.md#3-2-duty-管理) を参照。`user_settings` の行は、サインアップ時に better-auth の `databaseHooks` で作成する。

**2026/11 の追加（通知とタイムゾーン）**: `user_settings` に `timezoneAuto` を追加した。アプリを開くとブラウザのタイムゾーンで `timezone` を更新するが、設定画面で手で選んだら `false` にして、以後の同期では上書きしない（「自動」に戻すと `true` にし、その場でブラウザの値を入れる）。判定をサーバー側の列で持つのは、端末の localStorage に印を置くと、別の端末で開いたときにその端末の値で上書きされてしまうため。あわせて、notify が毎分読む `user_settings` の3つの時刻（`*_enabled = 1` の部分インデックス）と `push_subscriptions.user_id` にインデックスを張った。D1 は読んだ行数で課金されるため、毎分の抽出が全件を読むと数千人で無料枠を超える。部分インデックスにしたのは、週次サマリーは全員が既定の `20:00` を持ち、OFF の人まで索引から読まないようにするため。

`SINCE_LAST` の判定に「前回完了日」が要るが、専用カラムは持たず `logs` から `MAX(target_date) WHERE status = 'DONE'` で取る。非正規化キャッシュを持つと、遡り記録・取り消しのたびに整合を取る必要が出て割に合わない。ここが遅くなったら `logs_user_date_idx` の効きを確認する。

### 通知配信の設計

```
[Cloudflare Workers - Cron Trigger（毎分）]
  ↓
  user_settings を timezone + 各 notify_at で絞り込み、現在時刻に該当するユーザーを取得
  ↓
  各ユーザーの対象 Duty を集計（D1 バインディング経由）
  ↓
  Web Push / メール / LINE で送信
  ↓
[ブラウザの Service Worker]
  push イベント受信 → 通知を表示
```

Cron Trigger は UTC で動作するため、「ユーザーが設定した現地時刻」に配信するには **毎分 Cron を実行し、その時刻に該当するタイムゾーン・設定のユーザーだけを抽出して配信する** 方式を取る。ユーザーごとに Cron を作ることはできない。配信数が増えたら Cloudflare Queues を挟む。

### ドメイン構成

| 用途 | ドメイン |
|---|---|
| 本体（LP + アプリ） | `zumi.paritto.dev` |
| 通知 Worker | ドメイン不要（Cron Trigger 専用。デバッグ用に `notify-zumi.<account>.workers.dev`） |

LP はルート `/`、アプリ本体は `/app` 配下に置き、単一ドメインで完結させる。シェア画像の OG エンドポイントは `/og/w/:token`。

**公開前のサインアップ制限（2026/11 確定）**: 本番の LP はすでに公開されているが、アプリ本体と利用規約・プライバシーポリシーが完成するまでは、本番のサインアップを閉じておく。環境変数（例: `SIGNUP_ENABLED`）で切り替え、閉じている間はサインアップ画面と API の両方で受け付けない。LP の CTA にも準備中であることを表示する。中身のない規約に同意させた状態でユーザーを登録しないため。

### リポジトリ構成

Turborepo によるモノレポ。

```
/
├── apps/
│   ├── web/              # 本体（LP + アプリ + API）
│   │   ├── app/
│   │   ├── components/
│   │   ├── public/
│   │   │   └── sw.js     # Service Worker
│   │   └── wrangler.toml
│   └── notify/           # 通知（Cron Trigger Worker）
│       ├── src/index.ts
│       └── wrangler.toml
├── packages/
│   ├── db/               # Drizzle スキーマ・マイグレーション（web/notify 双方から参照）
│   └── types/            # 共有型定義（ScheduleConfig など）
├── package.json
└── turbo.json
```

`notify` Worker も DB に触るため、スキーマ定義を `packages/db` に切り出して二重管理を避ける。D1 バインディングは両 Worker の `wrangler.toml` で同じ database_id を指す。
