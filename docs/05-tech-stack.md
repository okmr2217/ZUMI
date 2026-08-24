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
| シェア画像生成 | `workers-og`（Satori ベース、Workers 上で動作） |
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
import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { user } from "./auth-schema"; // better-auth が管理

export const userSettings = sqliteTable("user_settings", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().unique().references(() => user.id, { onDelete: "cascade" }),
  timezone: text("timezone").notNull().default("Asia/Tokyo"),
  morningNotifyEnabled: integer("morning_notify_enabled", { mode: "boolean" }).notNull().default(false),
  morningNotifyAt: text("morning_notify_at"),            // "08:00"
  eveningNotifyEnabled: integer("evening_notify_enabled", { mode: "boolean" }).notNull().default(false),
  eveningNotifyAt: text("evening_notify_at"),            // "21:00"
  weeklySummaryEnabled: integer("weekly_summary_enabled", { mode: "boolean" }).notNull().default(true),
  weeklySummaryWeekday: integer("weekly_summary_weekday").notNull().default(0), // 0=日
  weeklySummaryAt: text("weekly_summary_at").notNull().default("20:00"),
  channel: text("channel").$type<"WEB_PUSH" | "EMAIL" | "LINE">().notNull().default("WEB_PUSH"),
  lineUserId: text("line_user_id"),                      // Pro のみ
});

export const pushSubscriptions = sqliteTable("push_subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

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
}, (t) => ({
  byUserStatus: index("duties_user_status_idx").on(t.userId, t.status),
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
